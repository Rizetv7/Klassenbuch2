"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AdminHeader,
  AdminPerson,
  AdminPoll,
  AdminPollEntry,
  AdminPost,
  AdminPostEntry,
  RenameUser,
} from "@/components/AdminConsole";
import { PageLoading, PageReveal } from "@/components/LoadingState";
import { Avatar } from "@/components/Nav";

type Member = {
  id: string;
  role: string;
  memberType: string;
  displayName: string;
  createdAt: string;
  user: AdminPerson & {
    email?: string | null;
    _count: { posts: number; comments: number; polls: number };
  };
  _count: { subjectPosts: number };
};

type Teacher = {
  id: string;
  name: string;
  subject?: string | null;
  avatarUrl?: string | null;
  accentColor?: string | null;
  creator: { id: string; name: string };
  _count: { posts: number };
};

type ClassDetail = {
  class: {
    id: string;
    name: string;
    description?: string | null;
    school?: string | null;
    gradYear?: string | null;
    joinCode: string;
    owner: AdminPerson;
    _count: { memberships: number; posts: number; polls: number; teachers: number; topics: number };
  };
  members: Member[];
  teachers: Teacher[];
  topics: Array<{ id: string; name: string; creator: { id: string; name: string }; _count: { posts: number } }>;
  posts: AdminPost[];
  polls: AdminPoll[];
};

type Tab = "activity" | "people" | "polls";

export default function InternalClassPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ClassDetail | null>(null);
  const [tab, setTab] = useState<Tab>("activity");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/classes/${params.id}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/archivzugang");
          return null;
        }
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error || "Klasse konnte nicht geladen werden.");
        return body;
      })
      .then((next) => {
        if (next) setData(next);
      })
      .catch((err) => setError(err.message));
  }, [params.id, router]);

  const visiblePosts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("de-CH");
    if (!data || !needle) return data?.posts ?? [];
    return data.posts.filter((post) =>
      [post.text, post.context, post.author.name, post.subject?.user.name, post.teacher?.name, post.topic?.name]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("de-CH").includes(needle)),
    );
  }, [data, query]);

  function updateMember(updated: AdminPerson) {
    const merge = (person: AdminPerson) =>
      person.id === updated.id ? { ...person, ...updated } : person;
    setData((current) =>
      current
        ? {
            ...current,
            class: {
              ...current.class,
              owner: merge(current.class.owner),
            },
            members: current.members.map((member) =>
              member.user.id === updated.id
                ? { ...member, displayName: updated.name, user: { ...member.user, ...updated } }
                : member,
            ),
            posts: current.posts.map((post) => ({
              ...post,
              author: merge(post.author),
              subject: post.subject?.user.id === updated.id
                ? { ...post.subject, displayName: updated.name, user: { ...post.subject.user, ...updated } }
                : post.subject,
              comments: post.comments.map((comment) => ({
                ...comment,
                author: merge(comment.author),
              })),
            })),
            polls: current.polls.map((poll) => ({
              ...poll,
              author: merge(poll.author),
              options: poll.options.map((option) => ({
                ...option,
                votes: option.votes.map((vote) => ({
                  ...vote,
                  user: merge(vote.user),
                })),
              })),
              comments: poll.comments.map((comment) => ({
                ...comment,
                author: merge(comment.author),
              })),
            })),
          }
        : current,
    );
  }

  if (!data && !error) return <PageLoading label="Klasse lädt" />;

  return (
    <PageReveal>
      <AdminHeader backHref="/archivzugang/uebersicht" />
      {error ? <div className="glass-panel p-8 text-center font-black text-coral">{error}</div> : null}
      {data ? (
        <>
          <section className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="section-label">{data.class.school || "Klasse"}</p>
              <h1 className="display text-5xl leading-[0.9] sm:text-7xl">{data.class.name}</h1>
              <p className="mt-2 max-w-2xl text-sm font-bold text-ink/60">
                {[data.class.description, data.class.gradYear ? `Abschluss ${data.class.gradYear}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="glass-card flex flex-wrap gap-2 p-3">
              <span className="chip">{data.class._count.memberships} Personen</span>
              <span className="chip">{data.class._count.posts} Beiträge</span>
              <span className="chip">{data.class._count.polls} Umfragen</span>
              <span className="chip font-mono">Code {data.class.joinCode}</span>
            </div>
          </section>

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
              {[
                ["activity", "Beiträge"],
                ["people", "Personen"],
                ["polls", "Umfragen"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`tab ${tab === value ? "tab-active" : ""}`}
                  onClick={() => setTab(value as Tab)}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === "activity" ? (
              <input
                type="search"
                className="input !py-2.5 sm:ml-auto sm:w-72"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Beiträge durchsuchen"
              />
            ) : null}
          </div>

          {tab === "activity" ? (
            <section className="grid gap-3 lg:grid-cols-2 lg:items-start">
              {visiblePosts.map((post) => <AdminPostEntry key={post.id} post={post} />)}
              {visiblePosts.length === 0 ? <Empty label="Keine passenden Beiträge." /> : null}
            </section>
          ) : null}

          {tab === "people" ? (
            <PeopleView data={data} onUserSaved={updateMember} />
          ) : null}

          {tab === "polls" ? (
            <section className="grid gap-3 lg:grid-cols-2 lg:items-start">
              {data.polls.map((poll) => <AdminPollEntry key={poll.id} poll={poll} />)}
              {data.polls.length === 0 ? <Empty label="Keine Umfragen in dieser Klasse." /> : null}
            </section>
          ) : null}
        </>
      ) : null}
    </PageReveal>
  );
}

function PeopleView({ data, onUserSaved }: { data: ClassDetail; onUserSaved: (user: AdminPerson) => void }) {
  return (
    <div className="space-y-7">
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="section-label">Konten</p>
            <h2 className="display text-3xl">Schülerinnen und Schüler</h2>
          </div>
          <span className="chip">{data.members.length}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.members.map((member) => (
            <article key={member.id} className="glass-card flex min-h-[118px] items-start gap-3 p-3">
              <Avatar name={member.user.name} url={member.user.avatarUrl} accent={member.user.accentColor} size={48} />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-black">{member.user.name}</h3>
                <p className="truncate text-xs font-bold text-ink/45">{member.user.email || "Keine E-Mail"}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="chip !px-2 !py-0.5">{member.role}</span>
                  <span className="text-xs font-black text-ink/45">{member._count.subjectPosts} Einträge</span>
                </div>
                <RenameUser user={member.user} onSaved={onUserSaved} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="section-label">Verzeichnis</p>
            <h2 className="display text-3xl">Lehrpersonen</h2>
          </div>
          <span className="chip">{data.teachers.length}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.teachers.map((teacher) => (
            <article key={teacher.id} className="glass-card flex items-center gap-3 p-3">
              <Avatar name={teacher.name} url={teacher.avatarUrl} accent={teacher.accentColor} size={48} />
              <div className="min-w-0">
                <h3 className="truncate font-black">{teacher.name}</h3>
                <p className="truncate text-xs font-bold text-ink/45">{teacher.subject || "Kein Fach"}</p>
                <p className="mt-1 text-xs font-black text-ink/45">{teacher._count.posts} Einträge · von {teacher.creator.name}</p>
              </div>
            </article>
          ))}
          {data.teachers.length === 0 ? <Empty label="Keine Lehrpersonen." /> : null}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="section-label">Sammlungen</p>
            <h2 className="display text-3xl">Projekte</h2>
          </div>
          <span className="chip">{data.topics.length}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.topics.map((topic) => (
            <article key={topic.id} className="glass-card p-4">
              <h3 className="display text-2xl">{topic.name}</h3>
              <p className="mt-1 text-xs font-black text-ink/45">{topic._count.posts} Beiträge · {topic.creator.name}</p>
            </article>
          ))}
          {data.topics.length === 0 ? <Empty label="Keine Projekte." /> : null}
        </div>
      </section>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="glass-panel p-8 text-center font-bold text-ink/55">{label}</div>;
}
