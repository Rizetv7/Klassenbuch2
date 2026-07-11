"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AdminHeader,
  AdminPerson,
  AdminPoll,
  AdminPollEntry,
  AdminPost,
  AdminPostEntry,
  formatAdminDate,
  RenameUser,
  ResetPassword,
} from "@/components/AdminConsole";
import { AdminImportBatches, type AdminImportBatch } from "@/components/AdminImportBatches";
import { PageLoading, PageReveal } from "@/components/LoadingState";
import { Avatar } from "@/components/Nav";
import { AdminClassSettings } from "@/components/AdminClassSettings";

type Member = {
  id: string;
  role: string;
  memberType: string;
  displayName: string;
  createdAt: string;
  aminaMode: boolean;
  leftAt: string | null;
  user: AdminPerson & {
    email?: string | null;
    createdAt: string;
    _count: { posts: number; comments: number; polls: number; pollVotes: number };
  };
  _count: { subjectPosts: number };
  activity: { posts: number; comments: number; polls: number; votes: number; lastActivityAt?: string | null };
};

type Teacher = {
  id: string;
  name: string;
  subject?: string | null;
  avatarUrl?: string | null;
  accentColor?: string | null;
  createdAt: string;
  creator: { id: string; name: string };
  _count: { posts: number };
};

type ActivityEvent = {
  id: string;
  type: string;
  at: string;
  title: string;
  detail?: string | null;
  private?: boolean;
  person: AdminPerson;
};

type DailyActivity = { day: string; posts: number; comments: number; polls: number; votes: number };

type ClassSummary = {
  class: {
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
  };
  members: Member[];
  teachers: Teacher[];
  topics: Array<{ id: string; name: string; createdAt: string; creator: { id: string; name: string }; _count: { posts: number } }>;
  stats: {
    activeMembers: number;
    formerMembers: number;
    moderators: number;
    aminaMode: number;
    posts: number;
    quotes: number;
    notes: number;
    images: number;
    anonymous: number;
    comments: number;
    likes: number;
    polls: number;
    pollVotes: number;
    teachers: number;
    topics: number;
    importBatches: number;
    pendingImports: number;
  };
  contributors: Array<{
    membershipId: string;
    person: AdminPerson;
    posts: number;
    comments: number;
    polls: number;
    votes: number;
    total: number;
    lastActivityAt?: string | null;
  }>;
  recentActivity: ActivityEvent[];
  dailyActivity: DailyActivity[];
};

type Tab = "overview" | "posts" | "people" | "polls" | "imports" | "settings";
type PostState = { items: AdminPost[]; total: number; nextCursor: string | null; loaded: boolean; loading: boolean };
type PollState = { items: AdminPoll[]; loaded: boolean; loading: boolean };
type ImportState = { items: AdminImportBatch[]; loaded: boolean; loading: boolean };

export default function InternalClassPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [summary, setSummary] = useState<ClassSummary | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState("");
  const [postQuery, setPostQuery] = useState("");
  const [postKind, setPostKind] = useState("all");
  const [postPrivacy, setPostPrivacy] = useState("all");
  const [postImported, setPostImported] = useState("all");
  const [posts, setPosts] = useState<PostState>({ items: [], total: 0, nextCursor: null, loaded: false, loading: false });
  const [polls, setPolls] = useState<PollState>({ items: [], loaded: false, loading: false });
  const [imports, setImports] = useState<ImportState>({ items: [], loaded: false, loading: false });
  const postRequest = useRef(0);

  const adminFetch = useCallback(async (url: string) => {
    const response = await fetch(url, { cache: "no-store" });
    if (response.status === 401) {
      router.replace("/archivzugang");
      return null;
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || "Daten konnten nicht geladen werden.");
    return body;
  }, [router]);

  const loadSummary = useCallback(async () => {
    setError("");
    try {
      const body = await adminFetch(`/api/admin/classes/${params.id}?section=summary`);
      if (body) setSummary(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Klasse konnte nicht geladen werden.");
    }
  }, [adminFetch, params.id]);

  const loadPosts = useCallback(async (cursor?: string | null, append = false) => {
    const requestId = ++postRequest.current;
    setPosts((current) => ({ ...current, loading: true }));
    const search = new URLSearchParams({ section: "posts", limit: "30" });
    if (postQuery.trim()) search.set("query", postQuery.trim());
    if (postKind !== "all") search.set("kind", postKind);
    if (postPrivacy !== "all") search.set("privacy", postPrivacy);
    if (postImported !== "all") search.set("imported", postImported);
    if (cursor) search.set("cursor", cursor);
    try {
      const body = await adminFetch(`/api/admin/classes/${params.id}?${search.toString()}`);
      if (!body || requestId !== postRequest.current) return;
      setPosts((current) => ({
        items: append ? [...current.items, ...body.posts] : body.posts,
        total: body.total,
        nextCursor: body.nextCursor,
        loaded: true,
        loading: false,
      }));
    } catch (reason) {
      if (requestId === postRequest.current) {
        setPosts((current) => ({ ...current, loaded: true, loading: false }));
        setError(reason instanceof Error ? reason.message : "Beiträge konnten nicht geladen werden.");
      }
    }
  }, [adminFetch, params.id, postImported, postKind, postPrivacy, postQuery]);

  const loadPolls = useCallback(async () => {
    setPolls((current) => ({ ...current, loading: true }));
    try {
      const body = await adminFetch(`/api/admin/classes/${params.id}?section=polls`);
      if (body) setPolls({ items: body.polls, loaded: true, loading: false });
    } catch (reason) {
      setPolls((current) => ({ ...current, loaded: true, loading: false }));
      setError(reason instanceof Error ? reason.message : "Umfragen konnten nicht geladen werden.");
    }
  }, [adminFetch, params.id]);

  const loadImports = useCallback(async () => {
    setImports((current) => ({ ...current, loading: true }));
    try {
      const body = await adminFetch(`/api/admin/classes/${params.id}?section=imports`);
      if (body) setImports({ items: body.imports, loaded: true, loading: false });
    } catch (reason) {
      setImports((current) => ({ ...current, loaded: true, loading: false }));
      setError(reason instanceof Error ? reason.message : "Importe konnten nicht geladen werden.");
    }
  }, [adminFetch, params.id]);

  useEffect(() => { void loadSummary(); }, [loadSummary]);

  useEffect(() => {
    if (tab !== "posts") return;
    const timer = window.setTimeout(() => void loadPosts(null, false), postQuery ? 260 : 0);
    return () => window.clearTimeout(timer);
  }, [loadPosts, postQuery, tab]);

  useEffect(() => {
    if (tab === "polls" && !polls.loaded && !polls.loading) void loadPolls();
    if (tab === "imports" && !imports.loaded && !imports.loading) void loadImports();
  }, [imports.loaded, imports.loading, loadImports, loadPolls, polls.loaded, polls.loading, tab]);

  function updateMember(updated: AdminPerson) {
    setSummary((current) => current ? {
      ...current,
      class: { ...current.class, owner: current.class.owner.id === updated.id ? { ...current.class.owner, ...updated } : current.class.owner },
      members: current.members.map((member) => member.user.id === updated.id
        ? { ...member, displayName: updated.name, user: { ...member.user, ...updated } }
        : member),
      contributors: current.contributors.map((contributor) => contributor.person.id === updated.id
        ? { ...contributor, person: { ...contributor.person, ...updated } }
        : contributor),
      recentActivity: current.recentActivity.map((event) => event.person.id === updated.id
        ? { ...event, person: { ...event.person, ...updated } }
        : event),
    } : current);
  }

  async function refreshImports() {
    await Promise.all([loadSummary(), loadImports()]);
    if (posts.loaded) await loadPosts(null, false);
  }

  if (!summary && !error) return <PageLoading label="Klasse lädt" />;

  return (
    <PageReveal>
      <AdminHeader backHref="/archivzugang/uebersicht" />
      {error ? <div className="admin-alert is-error mb-4">{error}</div> : null}
      {summary ? (
        <>
          <ClassHead data={summary} />
          <ClassStats data={summary} />
          <ClassTabs tab={tab} setTab={setTab} data={summary} />

          {tab === "overview" ? <Overview data={summary} /> : null}
          {tab === "posts" ? (
            <PostsView
              state={posts}
              query={postQuery}
              kind={postKind}
              privacy={postPrivacy}
              imported={postImported}
              setQuery={setPostQuery}
              setKind={setPostKind}
              setPrivacy={setPostPrivacy}
              setImported={setPostImported}
              loadMore={() => loadPosts(posts.nextCursor, true)}
            />
          ) : null}
          {tab === "people" ? <PeopleView data={summary} onUserSaved={updateMember} /> : null}
          {tab === "polls" ? (
            polls.loading && !polls.loaded ? <SectionLoading label="Umfragen werden geladen" /> : (
              <section className="admin-content-grid">
                {polls.items.map((poll) => <AdminPollEntry key={poll.id} poll={poll} />)}
                {!polls.items.length ? <Empty label="Keine Umfragen in dieser Klasse." /> : null}
              </section>
            )
          ) : null}
          {tab === "imports" ? (
            imports.loading && !imports.loaded ? <SectionLoading label="Importhistorie wird geladen" /> : (
              <section>
                <div className="admin-panel-head admin-panel mb-3">
                  <div><p className="admin-kicker">Herkunft und Datenschutz</p><h2>Importhistorie</h2></div>
                  <span className="admin-badge">{imports.items.length} Vorgänge</span>
                </div>
                <AdminImportBatches classId={summary.class.id} batches={imports.items} onChanged={refreshImports} />
              </section>
            )
          ) : null}
          {tab === "settings" ? <AdminClassSettings klass={summary.class} members={summary.members} onChanged={loadSummary} /> : null}
        </>
      ) : null}
    </PageReveal>
  );
}

function ClassHead({ data }: { data: ClassSummary }) {
  return (
    <section className="admin-page-head">
      <div>
        <p className="admin-kicker">{data.class.school || "Klasse"}</p>
        <h1>{data.class.name}</h1>
        <p>{[data.class.description, data.class.gradYear ? `Abschluss ${data.class.gradYear}` : null, `Erstellt von ${data.class.owner.name}`].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="admin-page-meta">
        <div><span>Einladungscode</span><strong>{data.class.joinCode}</strong></div>
        <div><span>Status</span><strong>{data.class.archivedAt ? "Archiv" : "Aktiv"}</strong></div>
      </div>
    </section>
  );
}

function ClassStats({ data }: { data: ClassSummary }) {
  const cards = [
    { label: "Aktive Personen", value: data.stats.activeMembers, detail: `${data.stats.moderators} Mods · ${data.stats.formerMembers} entfernt`, color: "#1f6f55" },
    { label: "Beiträge", value: data.stats.posts, detail: `${data.stats.quotes} Zitate · ${data.stats.notes} Notizen`, color: "#486a93" },
    { label: "Bilder", value: data.stats.images, detail: `${data.stats.anonymous} anonym`, color: "#8a6b9b" },
    { label: "Interaktionen", value: data.stats.likes + data.stats.comments, detail: `${data.stats.likes} Likes · ${data.stats.comments} Kommentare`, color: "#b94a55" },
    { label: "Stimmen", value: data.stats.pollVotes, detail: `${data.stats.polls} Umfragen`, color: "#c18a50" },
    { label: "Importe", value: data.stats.importBatches, detail: `${data.stats.pendingImports} noch offen`, color: "#617668" },
  ];
  return (
    <section className="admin-stat-grid">
      {cards.map((card) => (
        <article key={card.label} className="admin-stat-card" style={{ "--stat-color": card.color } as CSSProperties}>
          <span>{card.label}</span><strong>{card.value}</strong><small>{card.detail}</small>
        </article>
      ))}
    </section>
  );
}

function ClassTabs({ tab, setTab, data }: { tab: Tab; setTab: (tab: Tab) => void; data: ClassSummary }) {
  const tabs: Array<{ value: Tab; label: string; count?: number }> = [
    { value: "overview", label: "Übersicht" },
    { value: "posts", label: "Beiträge", count: data.stats.posts },
    { value: "people", label: "Personen", count: data.stats.activeMembers },
    { value: "polls", label: "Umfragen", count: data.stats.polls },
    { value: "imports", label: "Importe", count: data.stats.importBatches },
    { value: "settings", label: "Einstellungen" },
  ];
  return (
    <nav className="admin-tabs" aria-label="Klassenbereiche">
      {tabs.map((item) => (
        <button key={item.value} type="button" className={`admin-tab ${tab === item.value ? "is-active" : ""}`} onClick={() => setTab(item.value)}>
          {item.label}{item.count !== undefined ? <span className="admin-tab-count">{item.count}</span> : null}
        </button>
      ))}
    </nav>
  );
}

function Overview({ data }: { data: ClassSummary }) {
  const max = Math.max(1, ...data.dailyActivity.flatMap((day) => [day.posts, day.comments, day.polls, day.votes]));
  const height = (value: number) => `${Math.max(2, Math.round((value / max) * 142))}px`;
  const totalContent = Math.max(1, data.stats.posts);
  const breakdown = [
    ["Zitate", data.stats.quotes, "#1f6f55"],
    ["Notizen", data.stats.notes, "#486a93"],
    ["Bilder", data.stats.images, "#8a6b9b"],
    ["Anonym", data.stats.anonymous, "#b94a55"],
  ] as const;
  return (
    <div className="space-y-3">
      <section className="admin-dashboard-grid">
        <div className="admin-panel">
          <div className="admin-panel-head"><div><p className="admin-kicker">Letzte 14 Tage</p><h2>Aktivitätsverlauf</h2></div></div>
          <div className="admin-chart">
            {data.dailyActivity.map((day) => (
              <div key={day.day} className="admin-chart-day" title={`${day.posts} Beiträge, ${day.comments} Kommentare, ${day.polls} Umfragen, ${day.votes} Stimmen`}>
                <div className="admin-chart-bars"><i style={{ height: height(day.posts) }} /><i style={{ height: height(day.comments) }} /><i style={{ height: height(day.polls) }} /><i style={{ height: height(day.votes) }} /></div>
                <span>{new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit" }).format(new Date(day.day))}</span>
              </div>
            ))}
          </div>
          <div className="admin-chart-legend">
            <span style={{ "--legend": "#1f6f55" } as CSSProperties}>Beiträge</span><span style={{ "--legend": "#486a93" } as CSSProperties}>Kommentare</span><span style={{ "--legend": "#8a6b9b" } as CSSProperties}>Umfragen</span><span style={{ "--legend": "#c18a50" } as CSSProperties}>Stimmen</span>
          </div>
        </div>
        <div className="admin-panel">
          <div className="admin-panel-head"><div><p className="admin-kicker">Live</p><h2>Letzte Vorgänge</h2></div></div>
          <div className="admin-activity-list">
            {data.recentActivity.slice(0, 10).map((event) => (
              <div key={event.id} className="admin-activity-item">
                <span className="admin-activity-icon">{event.type.slice(0, 2)}</span>
                <div className="min-w-0"><strong>{event.title}{event.private ? " · intern sichtbar" : ""}</strong><p>{event.person.name}{event.detail ? ` · ${event.detail}` : ""}</p></div>
                <time>{formatAdminDate(event.at)}</time>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-dashboard-grid">
        <div className="admin-panel">
          <div className="admin-panel-head"><div><p className="admin-kicker">Verteilung</p><h2>Inhalte der Klasse</h2></div></div>
          <div className="admin-breakdown-list">
            {breakdown.map(([label, value, color]) => (
              <div key={label} className="admin-breakdown-row">
                <div><strong>{label}</strong><span>{value} · {Math.round((value / totalContent) * 100)}%</span></div>
                <div><span style={{ width: `${Math.min(100, (value / totalContent) * 100)}%`, background: color }} /></div>
              </div>
            ))}
          </div>
          <div className="admin-system-strip">
            <span><strong>{data.stats.teachers}</strong> Lehrpersonen</span>
            <span><strong>{data.stats.topics}</strong> Projekte</span>
            <span><strong>{data.stats.aminaMode}</strong> Amina-Modi</span>
            <span><strong>{data.stats.pendingImports}</strong> offene Zuordnungen</span>
          </div>
        </div>
        <div className="admin-panel">
          <div className="admin-panel-head"><div><p className="admin-kicker">Beiträge + Interaktion</p><h2>Aktivste Personen</h2></div></div>
          <div className="admin-contributor-list">
            {data.contributors.map((contributor, index) => (
              <Link key={contributor.membershipId} href={`/archivzugang/klasse/${data.class.id}/person/${contributor.membershipId}`} className="admin-contributor-row">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <Avatar name={contributor.person.name} url={contributor.person.avatarUrl} accent={contributor.person.accentColor} size={34} ring={false} />
                <div><strong>{contributor.person.name}</strong><p>{contributor.posts} Beiträge · {contributor.comments} Kommentare · {contributor.votes} Stimmen</p></div>
                <b>{contributor.total}</b>
              </Link>
            ))}
            {!data.contributors.length ? <Empty label="Noch keine Aktivität." /> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function PostsView({
  state,
  query,
  kind,
  privacy,
  imported,
  setQuery,
  setKind,
  setPrivacy,
  setImported,
  loadMore,
}: {
  state: PostState;
  query: string;
  kind: string;
  privacy: string;
  imported: string;
  setQuery: (value: string) => void;
  setKind: (value: string) => void;
  setPrivacy: (value: string) => void;
  setImported: (value: string) => void;
  loadMore: () => void;
}) {
  return (
    <section>
      <div className="admin-toolbar">
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Text, Person, Lehrperson oder Projekt suchen" />
        <select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Beitragstyp"><option value="all">Alle Typen</option><option value="QUOTE">Zitate</option><option value="TEXT">Notizen</option><option value="IMAGE">Bilder</option></select>
        <select value={privacy} onChange={(event) => setPrivacy(event.target.value)} aria-label="Sichtbarkeit"><option value="all">Alle Urheber</option><option value="anonymous">Anonym</option><option value="named">Mit Name</option></select>
        <select value={imported} onChange={(event) => setImported(event.target.value)} aria-label="Herkunft"><option value="all">Alle Quellen</option><option value="yes">Importiert</option><option value="no">Manuell</option></select>
        <span className="admin-toolbar-result">{state.total} Treffer</span>
      </div>
      {state.loading && !state.loaded ? <SectionLoading label="Beiträge werden geladen" /> : (
        <>
          <div className="admin-content-grid">
            {state.items.map((post) => <AdminPostEntry key={post.id} post={post} />)}
            {!state.items.length ? <Empty label="Keine passenden Beiträge." /> : null}
          </div>
          {state.nextCursor ? <div className="mt-4 text-center"><button type="button" className="admin-button is-quiet" onClick={loadMore} disabled={state.loading}>{state.loading ? "Lädt..." : "Weitere Beiträge laden"}</button></div> : null}
        </>
      )}
    </section>
  );
}

function PeopleView({ data, onUserSaved }: { data: ClassSummary; onUserSaved: (user: AdminPerson) => void }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase("de-CH");
  const activeMembers = data.members.filter((member) => !member.leftAt && (!needle || [member.user.name, member.user.email, member.role].filter(Boolean).some((value) => String(value).toLocaleLowerCase("de-CH").includes(needle))));
  const inactiveMembers = data.members.filter((member) => member.leftAt);
  return (
    <div className="space-y-6">
      <div className="admin-toolbar"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Person, E-Mail oder Rolle suchen" /><span className="admin-toolbar-result">{activeMembers.length} aktiv</span></div>
      <section>
        <div className="admin-panel-head admin-panel mb-2"><div><p className="admin-kicker">Konten und Klassenaktivität</p><h2>Schülerinnen und Schüler</h2></div><span className="admin-badge">{activeMembers.length}</span></div>
        <div className="admin-person-grid">
          {activeMembers.map((member) => (
            <article key={member.id} className="admin-person-card">
              <div className="admin-person-card-head">
                <Link href={`/archivzugang/klasse/${data.class.id}/person/${member.id}`}><Avatar name={member.user.name} url={member.user.avatarUrl} accent={member.user.accentColor} size={46} /></Link>
                <div className="min-w-0 flex-1">
                  <h3><Link href={`/archivzugang/klasse/${data.class.id}/person/${member.id}`}>{member.user.name}</Link></h3>
                  <p>{member.user.email || "Keine E-Mail"}</p>
                  <div className="mt-1 flex flex-wrap gap-1"><span className="admin-badge">{member.role}</span>{member.aminaMode ? <span className="admin-badge is-private">Amina</span> : null}</div>
                </div>
                <Link className="admin-row-arrow" href={`/archivzugang/klasse/${data.class.id}/person/${member.id}`}>→</Link>
              </div>
              <div className="admin-person-stats">
                <span><strong>{member.activity.posts}</strong><small>Beiträge</small></span><span><strong>{member.activity.comments}</strong><small>Kommentare</small></span><span><strong>{member.activity.polls}</strong><small>Umfragen</small></span><span><strong>{member.activity.votes}</strong><small>Stimmen</small></span>
              </div>
              <p className="mt-2">{member._count.subjectPosts} Einträge über diese Person · {member.activity.lastActivityAt ? `zuletzt ${formatAdminDate(member.activity.lastActivityAt)}` : "noch inaktiv"}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1"><RenameUser user={member.user} onSaved={onUserSaved} /><ResetPassword user={member.user} /></div>
            </article>
          ))}
          {!activeMembers.length ? <Empty label="Keine passende Person." /> : null}
        </div>
      </section>

      <section className="admin-dashboard-grid">
        <div className="admin-panel">
          <div className="admin-panel-head"><div><p className="admin-kicker">Verzeichnis</p><h2>Lehrpersonen</h2></div><span className="admin-badge">{data.teachers.length}</span></div>
          <div className="admin-compact-list">
            {data.teachers.map((teacher) => (
              <div key={teacher.id} className="admin-compact-row"><Avatar name={teacher.name} url={teacher.avatarUrl} accent={teacher.accentColor} size={38} ring={false} /><div><strong>{teacher.name}</strong><p>{teacher.subject || "Kein Fach"} · {teacher._count.posts} Einträge · angelegt von {teacher.creator.name}</p></div></div>
            ))}
            {!data.teachers.length ? <Empty label="Keine Lehrpersonen." /> : null}
          </div>
        </div>
        <div className="admin-panel">
          <div className="admin-panel-head"><div><p className="admin-kicker">Sammlungen</p><h2>Projekte</h2></div><span className="admin-badge">{data.topics.length}</span></div>
          <div className="admin-compact-list">
            {data.topics.map((topic) => <div key={topic.id} className="admin-compact-row"><span className="admin-activity-icon">PR</span><div><strong>{topic.name}</strong><p>{topic._count.posts} Beiträge · angelegt von {topic.creator.name} · {formatAdminDate(topic.createdAt)}</p></div></div>)}
            {!data.topics.length ? <Empty label="Keine Projekte." /> : null}
          </div>
        </div>
      </section>

      {inactiveMembers.length ? <section className="admin-panel"><div className="admin-panel-head"><div><p className="admin-kicker">Weiterhin gesichert</p><h2>Entfernte Personen</h2></div><span className="admin-badge">{inactiveMembers.length}</span></div><div className="admin-compact-list">{inactiveMembers.map((member) => <div key={member.id} className="admin-compact-row"><Avatar name={member.user.name} url={member.user.avatarUrl} accent={member.user.accentColor} size={34} ring={false} /><div><strong>{member.user.name}</strong><p>Entfernt · Inhalte bleiben erhalten</p></div></div>)}</div></section> : null}
    </div>
  );
}

function SectionLoading({ label }: { label: string }) {
  return <div className="admin-empty" role="status"><strong>{label}</strong><span>Einen Moment.</span></div>;
}

function Empty({ label }: { label: string }) {
  return <div className="admin-empty"><strong>{label}</strong></div>;
}
