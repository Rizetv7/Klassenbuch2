"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Avatar } from "@/components/Nav";
import { PostCard, type Post } from "@/components/PostCard";
import { CreatePost } from "@/components/CreatePost";

type Member = { id: string; displayName: string; memberType: string; avatarUrl: string | null };

export default function MemberPage() {
  const { id, membershipId } = useParams<{ id: string; membershipId: string }>();
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [className, setClassName] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
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

  if (loading) return <p className="text-gray-400">Lädt…</p>;
  if (!member) return <p className="text-red-500">Person nicht gefunden.</p>;

  return (
    <div className="space-y-5">
      <Link href={`/classes/${id}`} className="text-sm text-brand-600">← {className}</Link>

      <div className="card p-5 flex items-center gap-4">
        <Avatar name={member.displayName} url={member.avatarUrl} size={72} />
        <div>
          <h1 className="text-2xl font-bold">{member.displayName}</h1>
          <p className="text-gray-500">
            {member.memberType === "TEACHER" ? "Lehrer:in" : "Schüler:in"} · {posts.length} Beiträge
          </p>
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Etwas über {member.displayName.split(" ")[0]} posten</h2>
        <CreatePost
          classId={id}
          board="YEARBOOK"
          defaultSubjectId={membershipId}
          onCreated={(p) => setPosts((ps) => [p, ...ps])}
        />
      </div>

      <div className="space-y-4">
        {posts.length === 0 ? (
          <p className="text-gray-400 text-center py-6">Noch keine Zitate oder Bilder. Mach den Anfang!</p>
        ) : (
          posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              showContext={false}
              onDeleted={(pid) => setPosts((ps) => ps.filter((x) => x.id !== pid))}
            />
          ))
        )}
      </div>
    </div>
  );
}
