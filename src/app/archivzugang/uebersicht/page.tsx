"use client";

import Link from "next/link";
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
  owner: AdminPerson;
  _count: {
    memberships: number;
    posts: number;
    polls: number;
    teachers: number;
    topics: number;
  };
};

type UserOverview = AdminPerson & {
  email?: string | null;
  createdAt: string;
  memberships: Array<{
    id: string;
    role: string;
    memberType: string;
    class: { id: string; name: string };
  }>;
  _count: { posts: number; comments: number; polls: number };
};

type OverviewData = {
  stats: { classes: number; users: number; posts: number; polls: number };
  classes: ClassOverview[];
  users: UserOverview[];
};

export default function InternalOverviewPage() {
  const router = useRouter();
  const [data, setData] = useState<OverviewData | null>(null);
  const [tab, setTab] = useState<"classes" | "users">("classes");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/overview", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/archivzugang");
          return null;
        }
        if (!res.ok) throw new Error("Übersicht konnte nicht geladen werden.");
        return res.json();
      })
      .then((next) => {
        if (next) setData(next);
      })
      .catch((err) => setError(err.message));
  }, [router]);

  const visibleClasses = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("de-CH");
    if (!needle || !data) return data?.classes ?? [];
    return data.classes.filter((item) =>
      [item.name, item.school, item.gradYear, item.owner.name]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("de-CH").includes(needle)),
    );
  }, [data, query]);

  const visibleUsers = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("de-CH");
    if (!needle || !data) return data?.users ?? [];
    return data.users.filter((user) =>
      [user.name, user.email, ...user.memberships.map((membership) => membership.class.name)]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("de-CH").includes(needle)),
    );
  }, [data, query]);

  function updateUser(updated: AdminPerson) {
    setData((current) =>
      current
        ? {
            ...current,
            users: current.users.map((user) =>
              user.id === updated.id ? { ...user, ...updated } : user,
            ),
            classes: current.classes.map((klass) =>
              klass.owner.id === updated.id
                ? { ...klass, owner: { ...klass.owner, ...updated } }
                : klass,
            ),
          }
        : current,
    );
  }

  if (!data && !error) return <PageLoading label="Interne Übersicht lädt" />;

  return (
    <PageReveal>
      <AdminHeader />
      {error ? <div className="glass-panel p-8 text-center font-black text-coral">{error}</div> : null}
      {data ? (
        <>
          <section className="mb-7">
            <p className="section-label mb-2">Gesamtübersicht</p>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {[
                ["Klassen", data.stats.classes],
                ["Personen", data.stats.users],
                ["Beiträge", data.stats.posts],
                ["Umfragen", data.stats.polls],
              ].map(([label, value], index) => (
                <div key={String(label)} className={`glass-card p-4 ${index % 2 ? "lg:mt-3" : ""}`}>
                  <p className="section-label">{label}</p>
                  <p className="display mt-1 text-4xl">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex gap-2">
              <button
                type="button"
                className={`tab ${tab === "classes" ? "tab-active" : ""}`}
                onClick={() => setTab("classes")}
              >
                Alle Klassen
              </button>
              <button
                type="button"
                className={`tab ${tab === "users" ? "tab-active" : ""}`}
                onClick={() => setTab("users")}
              >
                Alle Personen
              </button>
            </div>
            <label className="sm:ml-auto sm:w-72">
              <span className="sr-only">Suchen</span>
              <input
                className="input !py-2.5"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tab === "classes" ? "Klasse suchen" : "Person suchen"}
                type="search"
              />
            </label>
          </div>

          {tab === "classes" ? (
            <section className="grid gap-3 md:grid-cols-2">
              {visibleClasses.map((klass, index) => (
                <Link
                  key={klass.id}
                  href={`/archivzugang/klasse/${klass.id}`}
                  className={`glass-card group min-h-[205px] p-5 transition hover:-translate-y-0.5 ${index % 2 ? "md:mt-5" : ""}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="section-label">{klass.school || "Klasse"}</p>
                      <h2 className="display truncate text-4xl leading-tight">{klass.name}</h2>
                      {klass.gradYear ? <p className="font-hand text-xl font-bold">Abschluss {klass.gradYear}</p> : null}
                    </div>
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-xl text-white transition group-hover:translate-x-0.5">→</span>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="chip">{klass._count.memberships} Personen</span>
                    <span className="chip">{klass._count.posts} Beiträge</span>
                    <span className="chip">{klass._count.polls} Umfragen</span>
                    <span className="chip">{klass._count.teachers} Lehrpersonen</span>
                  </div>
                  <div className="mt-5 flex items-center gap-2">
                    <Avatar name={klass.owner.name} url={klass.owner.avatarUrl} accent={klass.owner.accentColor} size={28} ring={false} />
                    <p className="text-xs font-black text-ink/55">Erstellt von {klass.owner.name} · {formatAdminDate(klass.createdAt)}</p>
                  </div>
                </Link>
              ))}
              {visibleClasses.length === 0 ? <EmptyResult /> : null}
            </section>
          ) : (
            <section className="grid gap-2 lg:grid-cols-2">
              {visibleUsers.map((user) => (
                <article key={user.id} className="glass-card flex min-h-[108px] items-start gap-3 p-3.5">
                  {user.memberships[0] ? (
                    <Link href={`/archivzugang/klasse/${user.memberships[0].class.id}/person/${user.memberships[0].id}`}>
                      <Avatar name={user.name} url={user.avatarUrl} accent={user.accentColor} size={52} />
                    </Link>
                  ) : (
                    <Avatar name={user.name} url={user.avatarUrl} accent={user.accentColor} size={52} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-black">
                          {user.memberships[0] ? (
                            <Link className="hover:underline" href={`/archivzugang/klasse/${user.memberships[0].class.id}/person/${user.memberships[0].id}`}>
                              {user.name}
                            </Link>
                          ) : user.name}
                        </h2>
                        <p className="truncate text-xs font-bold text-ink/45">{user.email || "Keine E-Mail"}</p>
                      </div>
                      <p className="text-xs font-black text-ink/45">{user._count.posts} Beiträge</p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {user.memberships.length ? user.memberships.map((membership) => (
                        <Link key={membership.id} href={`/archivzugang/klasse/${membership.class.id}/person/${membership.id}`} className="chip !py-1 hover:bg-white/35">
                          {membership.class.name} · {membership.role === "OWNER" ? "Owner" : membership.role === "MODERATOR" ? "Mod" : "Mitglied"}
                        </Link>
                      )) : <span className="text-xs font-bold text-ink/40">Noch ohne Klasse</span>}
                    </div>
                    <RenameUser user={user} onSaved={updateUser} />
                  </div>
                </article>
              ))}
              {visibleUsers.length === 0 ? <EmptyResult /> : null}
            </section>
          )}
        </>
      ) : null}
    </PageReveal>
  );
}

function EmptyResult() {
  return <div className="glass-panel p-8 text-center font-bold text-ink/55">Keine passenden Einträge.</div>;
}
