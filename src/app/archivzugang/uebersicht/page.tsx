"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminHeader, AdminPerson, formatAdminDate, RenameUser } from "@/components/AdminConsole";
import { PageLoading, PageReveal } from "@/components/LoadingState";
import { Avatar } from "@/components/Nav";

type ClassOverview = {
  id: string;
  name: string;
  description?: string | null;
  school?: string | null;
  gradYear?: string | null;
  joinCode: string;
  createdAt: string;
  archivedAt?: string | null;
  owner: AdminPerson;
  _count: {
    memberships: number;
    posts: number;
    polls: number;
    teachers: number;
    topics: number;
    importBatches: number;
    importItems: number;
  };
  insights: {
    quotes: number;
    notes: number;
    images: number;
    anonymousPosts: number;
    comments: number;
    likes: number;
    pollVotes: number;
    lastActivityAt: string;
  };
};

type UserOverview = AdminPerson & {
  email?: string | null;
  createdAt: string;
  lastActivityAt?: string | null;
  memberships: Array<{
    id: string;
    role: string;
    memberType: string;
    aminaMode: boolean;
    leftAt: string | null;
    class: { id: string; name: string };
  }>;
  _count: { posts: number; comments: number; polls: number; pollVotes: number };
};

type ActivityEvent = {
  id: string;
  type: string;
  at: string;
  title: string;
  detail?: string | null;
  class: { id: string; name: string };
  person: AdminPerson;
};

type DailyActivity = { day: string; posts: number; comments: number; polls: number; votes: number };

type OverviewData = {
  stats: {
    classes: number;
    activeClasses: number;
    users: number;
    activeMemberships: number;
    posts: number;
    quotes: number;
    notes: number;
    images: number;
    anonymousPosts: number;
    comments: number;
    likes: number;
    polls: number;
    pollVotes: number;
    importBatches: number;
    pendingImports: number;
  };
  classes: ClassOverview[];
  users: UserOverview[];
  recentActivity: ActivityEvent[];
  dailyActivity: DailyActivity[];
};

type ClassSort = "activity" | "members" | "posts" | "name";

export default function InternalOverviewPage() {
  const router = useRouter();
  const [data, setData] = useState<OverviewData | null>(null);
  const [tab, setTab] = useState<"classes" | "users">("classes");
  const [query, setQuery] = useState("");
  const [classSort, setClassSort] = useState<ClassSort>("activity");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/overview", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/archivzugang");
          return null;
        }
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error || "Übersicht konnte nicht geladen werden.");
        return body;
      })
      .then((next) => {
        if (next) setData(next);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Übersicht konnte nicht geladen werden."));
  }, [router]);

  const visibleClasses = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("de-CH");
    const filtered = (data?.classes ?? []).filter((item) =>
      !needle || [item.name, item.school, item.gradYear, item.owner.name, item.joinCode]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("de-CH").includes(needle)),
    );
    return [...filtered].sort((a, b) => {
      if (classSort === "name") return a.name.localeCompare(b.name, "de-CH");
      if (classSort === "members") return b._count.memberships - a._count.memberships;
      if (classSort === "posts") return b._count.posts - a._count.posts;
      return new Date(b.insights.lastActivityAt).getTime() - new Date(a.insights.lastActivityAt).getTime();
    });
  }, [classSort, data, query]);

  const visibleUsers = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("de-CH");
    if (!data) return [];
    return data.users.filter((user) =>
      !needle || [user.name, user.email, ...user.memberships.map((membership) => membership.class.name)]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("de-CH").includes(needle)),
    );
  }, [data, query]);

  function updateUser(updated: AdminPerson) {
    setData((current) => current ? {
      ...current,
      users: current.users.map((user) => user.id === updated.id ? { ...user, ...updated } : user),
      classes: current.classes.map((klass) => klass.owner.id === updated.id
        ? { ...klass, owner: { ...klass.owner, ...updated } }
        : klass),
    } : current);
  }

  if (!data && !error) return <PageLoading label="Interne Übersicht lädt" />;

  return (
    <PageReveal>
      <AdminHeader />
      {error ? <div className="admin-alert is-error">{error}</div> : null}
      {data ? (
        <>
          <section className="admin-page-head">
            <div>
              <p className="admin-kicker">Systemweite Übersicht</p>
              <h1>Kontrollzentrum</h1>
              <p>Klassen, Personen, Inhalte, Aktivität und Importe an einem Ort. Anonyme Inhalte bleiben für diese geschützte Sitzung intern nachvollziehbar.</p>
            </div>
            <div className="admin-page-meta">
              <div><span>Aktive Klassen</span><strong>{data.stats.activeClasses}/{data.stats.classes}</strong></div>
              <div><span>Offene Importe</span><strong>{data.stats.pendingImports}</strong></div>
            </div>
          </section>

          <Stats data={data} />

          <section className="admin-dashboard-grid mb-6">
            <div className="admin-panel">
              <div className="admin-panel-head">
                <div><p className="admin-kicker">Letzte 14 Tage</p><h2>Aktivität</h2></div>
                <span className="admin-badge">Live</span>
              </div>
              <ActivityChart days={data.dailyActivity} />
            </div>
            <div className="admin-panel">
              <div className="admin-panel-head">
                <div><p className="admin-kicker">Klassenübergreifend</p><h2>Neueste Vorgänge</h2></div>
              </div>
              <ActivityList events={data.recentActivity.slice(0, 9)} />
            </div>
          </section>

          <div className="admin-tabs">
            <button type="button" className={`admin-tab ${tab === "classes" ? "is-active" : ""}`} onClick={() => { setTab("classes"); setQuery(""); }}>
              Klassen <span className="admin-tab-count">{data.classes.length}</span>
            </button>
            <button type="button" className={`admin-tab ${tab === "users" ? "is-active" : ""}`} onClick={() => { setTab("users"); setQuery(""); }}>
              Personen <span className="admin-tab-count">{data.users.length}</span>
            </button>
          </div>

          <div className="admin-toolbar">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "classes" ? "Klasse, Schule, Owner oder Code suchen" : "Name, E-Mail oder Klasse suchen"} type="search" />
            {tab === "classes" ? (
              <select value={classSort} onChange={(event) => setClassSort(event.target.value as ClassSort)} aria-label="Klassen sortieren">
                <option value="activity">Neueste Aktivität</option>
                <option value="members">Meiste Personen</option>
                <option value="posts">Meiste Beiträge</option>
                <option value="name">Name</option>
              </select>
            ) : null}
            <span className="admin-toolbar-result">{tab === "classes" ? visibleClasses.length : visibleUsers.length} sichtbar</span>
          </div>

          {tab === "classes" ? (
            <ClassTable classes={visibleClasses} />
          ) : (
            <UserTable users={visibleUsers} onUserSaved={updateUser} />
          )}
        </>
      ) : null}
    </PageReveal>
  );
}

function Stats({ data }: { data: OverviewData }) {
  const cards = [
    { label: "Klassen", value: data.stats.classes, detail: `${data.stats.activeMemberships} aktive Mitgliedschaften`, color: "#1f6f55" },
    { label: "Personen", value: data.stats.users, detail: "Registrierte Konten", color: "#486a93" },
    { label: "Beiträge", value: data.stats.posts, detail: `${data.stats.quotes} Zitate · ${data.stats.notes} Notizen`, color: "#8a6b9b" },
    { label: "Bilder", value: data.stats.images, detail: `${data.stats.anonymousPosts} anonyme Beiträge`, color: "#b87858" },
    { label: "Reaktionen", value: data.stats.likes + data.stats.comments, detail: `${data.stats.likes} Likes · ${data.stats.comments} Kommentare`, color: "#b94a55" },
    { label: "Umfrage-Stimmen", value: data.stats.pollVotes, detail: `${data.stats.polls} Umfragen`, color: "#c18a50" },
  ];
  return (
    <section className="admin-stat-grid">
      {cards.map((card) => (
        <article key={card.label} className="admin-stat-card" style={{ "--stat-color": card.color } as CSSProperties}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <small>{card.detail}</small>
        </article>
      ))}
    </section>
  );
}

function ActivityChart({ days }: { days: DailyActivity[] }) {
  const max = Math.max(1, ...days.flatMap((day) => [day.posts, day.comments, day.polls, day.votes]));
  const height = (value: number) => `${Math.max(2, Math.round((value / max) * 142))}px`;
  return (
    <>
      <div className="admin-chart">
        {days.map((day) => (
          <div key={day.day} className="admin-chart-day" title={`${day.posts} Beiträge, ${day.comments} Kommentare, ${day.polls} Umfragen, ${day.votes} Stimmen`}>
            <div className="admin-chart-bars">
              <i style={{ height: height(day.posts) }} />
              <i style={{ height: height(day.comments) }} />
              <i style={{ height: height(day.polls) }} />
              <i style={{ height: height(day.votes) }} />
            </div>
            <span>{new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit" }).format(new Date(day.day))}</span>
          </div>
        ))}
      </div>
      <div className="admin-chart-legend">
        <span style={{ "--legend": "#1f6f55" } as CSSProperties}>Beiträge</span>
        <span style={{ "--legend": "#486a93" } as CSSProperties}>Kommentare</span>
        <span style={{ "--legend": "#8a6b9b" } as CSSProperties}>Umfragen</span>
        <span style={{ "--legend": "#c18a50" } as CSSProperties}>Stimmen</span>
      </div>
    </>
  );
}

function ActivityList({ events }: { events: ActivityEvent[] }) {
  if (!events.length) return <div className="admin-empty"><strong>Noch keine Aktivität</strong></div>;
  return (
    <div className="admin-activity-list">
      {events.map((event) => (
        <Link key={event.id} href={`/archivzugang/klasse/${event.class.id}`} className="admin-activity-item">
          <span className="admin-activity-icon">{event.type.slice(0, 2)}</span>
          <div className="min-w-0">
            <strong>{event.title}</strong>
            <p>{event.person.name} · {event.class.name}{event.detail ? ` · ${event.detail}` : ""}</p>
          </div>
          <time>{formatAdminDate(event.at)}</time>
        </Link>
      ))}
    </div>
  );
}

function ClassTable({ classes }: { classes: ClassOverview[] }) {
  if (!classes.length) return <div className="admin-empty"><strong>Keine passende Klasse</strong><span>Ändere die Suche oder Sortierung.</span></div>;
  return (
    <section className="admin-table">
      <div className="admin-table-head"><span>Klasse</span><span>Status & Personen</span><span>Inhalte</span><span>Interaktion & Importe</span><span /></div>
      {classes.map((klass) => (
        <Link key={klass.id} href={`/archivzugang/klasse/${klass.id}`} className="admin-table-row">
          <div className="admin-table-primary">
            <Avatar name={klass.owner.name} url={klass.owner.avatarUrl} accent={klass.owner.accentColor} size={40} ring={false} />
            <div className="min-w-0">
              <h2>{klass.name}</h2>
              <p>{klass.school || "Keine Schule"}{klass.gradYear ? ` · ${klass.gradYear}` : ""} · Owner {klass.owner.name}</p>
            </div>
          </div>
          <div className="admin-table-metrics">
            <span><strong>{klass._count.memberships}</strong> Personen</span>
            <span>{klass.archivedAt ? "Archiviert" : "Aktiv"}</span>
            <span>Code <strong>{klass.joinCode}</strong></span>
          </div>
          <div className="admin-table-metrics">
            <span><strong>{klass._count.posts}</strong> gesamt</span>
            <span>{klass.insights.quotes} Zitate</span>
            <span>{klass.insights.notes} Notizen</span>
            <span>{klass.insights.images} Bilder</span>
            <span>{klass.insights.anonymousPosts} anonym</span>
          </div>
          <div>
            <div className="admin-table-metrics">
              <span>{klass.insights.likes} Likes</span>
              <span>{klass.insights.comments} Kommentare</span>
              <span>{klass.insights.pollVotes} Stimmen</span>
              <span>{klass._count.importBatches} Importe</span>
              {klass._count.importItems ? <span><strong>{klass._count.importItems}</strong> offen</span> : null}
            </div>
            <p className="admin-table-date mt-2">Zuletzt {formatAdminDate(klass.insights.lastActivityAt)}</p>
          </div>
          <span className="admin-row-arrow">→</span>
        </Link>
      ))}
    </section>
  );
}

function UserTable({ users, onUserSaved }: { users: UserOverview[]; onUserSaved: (user: AdminPerson) => void }) {
  if (!users.length) return <div className="admin-empty"><strong>Keine passende Person</strong><span>Ändere den Suchbegriff.</span></div>;
  return (
    <section className="admin-table">
      <div className="admin-table-head"><span>Person</span><span>Klassen</span><span>Aktivität</span><span>Letzter Vorgang</span><span /></div>
      {users.map((user) => {
        const firstMembership = user.memberships.find((membership) => !membership.leftAt) || user.memberships[0];
        const href = firstMembership ? `/archivzugang/klasse/${firstMembership.class.id}/person/${firstMembership.id}` : null;
        return (
          <article key={user.id} className="admin-table-row">
            <div className="admin-table-primary">
              {href ? <Link href={href}><Avatar name={user.name} url={user.avatarUrl} accent={user.accentColor} size={40} ring={false} /></Link> : <Avatar name={user.name} url={user.avatarUrl} accent={user.accentColor} size={40} ring={false} />}
              <div className="min-w-0">
                <h3>{href ? <Link href={href}>{user.name}</Link> : user.name}</h3>
                <p>{user.email || "Keine E-Mail"}</p>
                <RenameUser user={user} onSaved={onUserSaved} />
              </div>
            </div>
            <div className="admin-table-metrics">
              {user.memberships.length ? user.memberships.map((membership) => (
                <Link key={membership.id} href={`/archivzugang/klasse/${membership.class.id}/person/${membership.id}`} className="admin-badge">
                  {membership.class.name} · {membership.role === "OWNER" ? "Owner" : membership.role === "MODERATOR" ? "Mod" : "Mitglied"}
                </Link>
              )) : <span>Ohne Klasse</span>}
            </div>
            <div className="admin-table-metrics">
              <span><strong>{user._count.posts}</strong> Beiträge</span>
              <span>{user._count.comments} Kommentare</span>
              <span>{user._count.polls} Umfragen</span>
              <span>{user._count.pollVotes} Stimmen</span>
            </div>
            <p className="admin-table-date">{user.lastActivityAt ? formatAdminDate(user.lastActivityAt) : "Noch keine Aktivität"}</p>
            {href ? <Link href={href} className="admin-row-arrow" aria-label={`${user.name} öffnen`}>→</Link> : <span />}
          </article>
        );
      })}
    </section>
  );
}
