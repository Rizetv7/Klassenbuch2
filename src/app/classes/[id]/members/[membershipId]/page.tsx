"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Avatar } from "@/components/Nav";
import { PostCard, type Post } from "@/components/PostCard";
import { CreatePost } from "@/components/CreatePost";

type Member = { id: string; displayName: string; memberType: string; avatarUrl: string | null; accentColor: string | null };

const TABS = ["Alle", "Zitate", "Bilder"] as const;
type Tab = (typeof TABS)[number];

export default function MemberPage() {
  const { id, membershipId } = useParams<{ id: string; membershipId: string }>();
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [className, setClassName] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<Tab>("Alle");
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const cls = await fetch(`/api/classes/${id}`);
      if (cls.status === 401) return router.push("/login");
      const clsData = await cls.json();
      setClassName(clsData.name);
      setMember(clsData.members.find((m: Member) => m.id === membershipId) ?? null);
      const d = await fetch(`/api/posts?classId=${id}&subjectMembershipId=${membershipId}`).then((r) => r.json());
      setPosts(d.posts ?? []);
      setLoading(false);
    })();
  }, [id, membershipId]);

  if (loading) return <p className="text-muted">Lädt…</p>;
  if (!member) return <p className="text-coral font-bold">Person nicht gefunden.</p>;

  const isTeacher = member.memberType === "TEACHER";
  const shown = posts.filter((p) => (tab === "Alle" ? true : tab === "Zitate" ? p.kind === "QUOTE" : p.kind === "IMAGE"));
  const firstName = member.displayName.split(" ")[0];

  return (
    <div className="space-y-4">
      <Link href={`/classes/${id}`} className="text-sm text-muted">← {className}</Link>

      {/* Hero */}
      <div className="card p-6 flex flex-col items-center text-center">
        <Avatar name={member.displayName} url={member.avatarUrl} accent={member.accentColor} size={96} />
        <h1 className="display text-4xl mt-3">{member.displayName}</h1>
        <p className="text-muted text-sm">{isTeacher ? "Lehrperson" : "Schüler:in"} · {posts.length} Beiträge</p>
      </div>

      {/* Add */}
      {!showAdd ? (
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)} className="btn-accent flex-1">{isTeacher ? "Lehrerzitat" : "Zitat"} / Bild hinzufügen</button>
        </div>
      ) : (
        <div className="space-y-2">
          <CreatePost classId={id} subjectMembershipId={membershipId} onCreated={(p) => { setPosts((ps) => [p, ...ps]); setShowAdd(false); }} />
          <button onClick={() => setShowAdd(false)} className="text-sm text-muted underline w-full text-center">Abbrechen</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`tab ${tab === t ? "tab-active" : ""}`}>{t}</button>
        ))}
      </div>

      {/* Posts */}
      <div className="space-y-3">
        {shown.length === 0 ? (
          <p className="text-muted text-center py-6">Noch nichts über {firstName}. Mach den Anfang!</p>
        ) : (
          shown.map((p) => (
            <PostCard key={p.id} post={p} showContext={false} onDeleted={(pid) => setPosts((ps) => ps.filter((x) => x.id !== pid))} />
          ))
        )}
      </div>
    </div>
  );
}
