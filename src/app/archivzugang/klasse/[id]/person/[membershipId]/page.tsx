"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AdminHeader,
  AdminPerson,
  AdminPost,
  AdminPostEntry,
  RenameUser,
} from "@/components/AdminConsole";
import { PageLoading, PageReveal } from "@/components/LoadingState";
import { Avatar } from "@/components/Nav";

type MemberData = {
  id: string;
  role: string;
  memberType: string;
  displayName: string;
  createdAt: string;
  class: { id: string; name: string; school?: string | null; gradYear?: string | null };
  user: AdminPerson & {
    email?: string | null;
    createdAt: string;
    _count: { posts: number; comments: number; polls: number };
  };
};

type PersonData = {
  member: MemberData;
  aboutPosts: AdminPost[];
  authoredPosts: AdminPost[];
};

const KINDS = ["Alle", "Zitate", "Bilder", "Post-its"] as const;
type Kind = (typeof KINDS)[number];
type Perspective = "about" | "authored";

export default function InternalPersonPage() {
  const params = useParams<{ id: string; membershipId: string }>();
  const router = useRouter();
  const [data, setData] = useState<PersonData | null>(null);
  const [perspective, setPerspective] = useState<Perspective>("about");
  const [kind, setKind] = useState<Kind>("Alle");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/classes/${params.id}/members/${params.membershipId}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/archivzugang");
          return null;
        }
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error || "Person konnte nicht geladen werden.");
        return body;
      })
      .then((next) => {
        if (next) setData(next);
      })
      .catch((err) => setError(err.message));
  }, [params.id, params.membershipId, router]);

  const posts = perspective === "about" ? data?.aboutPosts ?? [] : data?.authoredPosts ?? [];
  const shownPosts = useMemo(
    () => posts.filter((post) => (
      kind === "Alle"
        ? true
        : kind === "Zitate"
          ? post.kind === "QUOTE"
          : kind === "Bilder"
            ? post.kind === "IMAGE"
            : post.kind === "TEXT"
    )),
    [kind, posts],
  );

  if (!data && !error) return <PageLoading label="Person lädt" />;

  if (!data) {
    return (
      <PageReveal>
        <AdminHeader backHref={`/archivzugang/klasse/${params.id}`} />
        <div className="glass-panel p-8 text-center font-black text-coral">{error}</div>
      </PageReveal>
    );
  }

  const { member } = data;
  const firstName = member.user.name.split(" ")[0];
  const cover = data.aboutPosts.find((post) => post.imageUrl);
  const heroQuote = data.aboutPosts.find((post) => post.kind === "QUOTE" && post.text);
  const avatarUrl = member.user.avatarUrl || cover?.imageUrl || null;

  function updateUser(updated: AdminPerson) {
    setData((current) => {
      if (!current) return current;
      const merge = (person: AdminPerson) =>
        person.id === updated.id ? { ...person, ...updated } : person;
      const updatePost = (post: AdminPost): AdminPost => ({
        ...post,
        author: merge(post.author),
        subject: post.subject?.user.id === updated.id
          ? { ...post.subject, displayName: updated.name, user: merge(post.subject.user) }
          : post.subject,
        comments: post.comments.map((comment) => ({ ...comment, author: merge(comment.author) })),
      });
      return {
        ...current,
        member: {
          ...current.member,
          displayName: updated.name,
          user: { ...current.member.user, ...updated },
        },
        aboutPosts: current.aboutPosts.map(updatePost),
        authoredPosts: current.authoredPosts.map(updatePost),
      };
    });
  }

  return (
    <PageReveal>
      <AdminHeader backHref={`/archivzugang/klasse/${params.id}`} />
      <div className="space-y-6">
        <section className="hero-frame min-h-[380px] p-5 sm:p-7">
          {cover?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover.imageUrl}
              alt=""
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover opacity-25"
            />
          ) : null}
          <div className="relative z-10 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="mx-auto sm:mx-0">
              <Avatar
                name={member.user.name}
                url={avatarUrl}
                accent={member.user.accentColor}
                size={142}
              />
            </div>
            <div className="glass-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="section-label">{member.memberType === "TEACHER" ? "Lehrperson" : "Schüler:in"}</p>
                <span className="chip !py-1">Schreibgeschützte Adminansicht</span>
              </div>
              <h1 className="display mt-2 break-words text-5xl leading-[0.86] sm:text-7xl">
                {member.user.name}
              </h1>
              {heroQuote?.text ? (
                <p className="mt-5 font-hand text-3xl leading-[0.95] text-hotpink sm:text-4xl">
                  {heroQuote.text}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-black text-ink/60">
                <span>{data.aboutPosts.length} Beiträge über {firstName}</span>
                <span>·</span>
                <span>{data.authoredPosts.length} von {firstName} erstellt</span>
                <span>·</span>
                <span>{member.role}</span>
              </div>
              <RenameUser user={member.user} onSaved={updateUser} />
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              className={`tab ${perspective === "about" ? "tab-active" : ""}`}
              onClick={() => setPerspective("about")}
            >
              Über {firstName}
            </button>
            <button
              type="button"
              className={`tab ${perspective === "authored" ? "tab-active" : ""}`}
              onClick={() => setPerspective("authored")}
            >
              Von {firstName}
            </button>
          </div>
          <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1 lg:ml-auto">
            {KINDS.map((item) => (
              <button
                key={item}
                type="button"
                className={`tab !px-3 !py-1.5 ${kind === item ? "tab-active" : ""}`}
                onClick={() => setKind(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <section className="grid gap-3 lg:grid-cols-2 lg:items-start">
          {shownPosts.length ? shownPosts.map((post) => (
            <AdminPostEntry key={post.id} post={post} />
          )) : (
            <div className="glass-panel p-8 text-center font-bold text-ink/55 lg:col-span-2">
              {perspective === "about"
                ? `Keine passenden Beiträge über ${firstName}.`
                : `${firstName} hat keine passenden Beiträge erstellt.`}
            </div>
          )}
        </section>
      </div>
    </PageReveal>
  );
}
