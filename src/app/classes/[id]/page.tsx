"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Avatar } from "@/components/Nav";

type Member = {
  id: string;
  displayName: string;
  memberType: string;
  role: string;
  avatarUrl: string | null;
  postCount: number;
};

type ClassDetail = {
  id: string;
  name: string;
  description: string | null;
  joinCode: string;
  myRole: string;
  myMembershipId: string;
  members: Member[];
};

export default function ClassPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ClassDetail | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch(`/api/classes/${id}`);
    if (res.status === 401) return router.push("/login");
    if (!res.ok) {
      setError((await res.json()).error || "Fehler.");
      return;
    }
    setData(await res.json());
  }
  useEffect(() => {
    load();
  }, [id]);

  async function moderate(membershipId: string, body: Record<string, string>) {
    await fetch(`/api/classes/${id}/members/${membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  async function removeMember(membershipId: string) {
    if (!confirm("Mitglied wirklich entfernen?")) return;
    await fetch(`/api/classes/${id}/members/${membershipId}`, { method: "DELETE" });
    load();
  }

  async function deleteClass() {
    if (!confirm("Die gesamte Klasse mit allen Beiträgen löschen?")) return;
    const res = await fetch(`/api/classes/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/classes");
  }

  if (error) return <p className="text-red-500">{error}</p>;
  if (!data) return <p className="text-gray-400">Lädt…</p>;

  const canMod = data.myRole === "OWNER" || data.myRole === "MODERATOR";
  const students = data.members.filter((m) => m.memberType === "STUDENT");
  const teachers = data.members.filter((m) => m.memberType === "TEACHER");

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{data.name}</h1>
            {data.description && <p className="text-gray-500">{data.description}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Beitritts-Code</p>
            <p className="font-mono text-lg font-bold">{data.joinCode}</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          <Link href={`/classes/${id}/postit`} className="btn-ghost">📌 Pinnwand</Link>
          {data.myRole === "OWNER" && (
            <button onClick={deleteClass} className="btn-ghost text-red-500">Klasse löschen</button>
          )}
        </div>
      </div>

      <MemberSection
        title="🎓 Schüler:innen"
        members={students}
        classId={id}
        canMod={canMod}
        myRole={data.myRole}
        onModerate={moderate}
        onRemove={removeMember}
      />
      <MemberSection
        title="🧑‍🏫 Lehrer:innen"
        members={teachers}
        classId={id}
        canMod={canMod}
        myRole={data.myRole}
        onModerate={moderate}
        onRemove={removeMember}
      />
    </div>
  );
}

function MemberSection({
  title,
  members,
  classId,
  canMod,
  myRole,
  onModerate,
  onRemove,
}: {
  title: string;
  members: Member[];
  classId: string;
  canMod: boolean;
  myRole: string;
  onModerate: (id: string, body: Record<string, string>) => void;
  onRemove: (id: string) => void;
}) {
  if (members.length === 0) return null;
  return (
    <section>
      <h2 className="font-semibold mb-2">{title}</h2>
      <div className="grid sm:grid-cols-2 gap-2">
        {members.map((m) => (
          <div key={m.id} className="card p-3 flex items-center gap-3">
            <Link href={`/classes/${classId}/members/${m.id}`} className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar name={m.displayName} url={m.avatarUrl} size={44} />
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {m.displayName}
                  {m.role === "OWNER" && " 👑"}
                  {m.role === "MODERATOR" && " 🛡️"}
                </p>
                <p className="text-xs text-gray-400">{m.postCount} Beiträge</p>
              </div>
            </Link>
            {canMod && m.role !== "OWNER" && (
              <div className="flex flex-col gap-1 text-xs">
                {myRole === "OWNER" && (
                  <button
                    onClick={() =>
                      onModerate(m.id, { role: m.role === "MODERATOR" ? "MEMBER" : "MODERATOR" })
                    }
                    className="text-brand-600 hover:underline"
                  >
                    {m.role === "MODERATOR" ? "Mod entziehen" : "Zu Mod"}
                  </button>
                )}
                <button onClick={() => onRemove(m.id)} className="text-red-500 hover:underline">
                  Entfernen
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
