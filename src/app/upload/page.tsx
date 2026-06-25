"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreatePost } from "@/components/CreatePost";

type ClassItem = { id: string; name: string };
type Member = { id: string; displayName: string; memberType: string };

type Choice = "QUOTE" | "IMAGE" | "TEACHER" | "POSTIT";

const CHOICES: { key: Choice; label: string; hint: string }[] = [
  { key: "QUOTE", label: "Zitat", hint: "Etwas, das jemand gesagt hat" },
  { key: "IMAGE", label: "Bild", hint: "Foto oder Erinnerung" },
  { key: "TEACHER", label: "Lehrerzitat", hint: "Klassiker der Lehrpersonen" },
  { key: "POSTIT", label: "Post-it", hint: "Notiz für die Pinnwand" },
];

export default function UploadPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[] | null>(null);
  const [classId, setClassId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/classes").then((r) => {
      if (r.status === 401) return router.push("/login");
      return r.json().then((d) => {
        setClasses(d.classes ?? []);
        if (d.classes?.length === 1) setClassId(d.classes[0].id);
      });
    });
  }, []);

  useEffect(() => {
    if (!classId) return;
    fetch(`/api/classes/${classId}`).then((r) => r.json()).then((d) => setMembers(d.members ?? []));
    setChoice(null);
  }, [classId]);

  if (!classes) return <p className="text-muted">Lädt…</p>;
  if (classes.length === 0)
    return (
      <div className="card p-8 text-center text-muted">
        <p className="mb-3">Tritt zuerst einer Klasse bei.</p>
        <Link href="/classes" className="btn-accent">Zu den Klassen</Link>
      </div>
    );

  const subjectMembers = choice === "TEACHER" ? members.filter((m) => m.memberType === "TEACHER") : members;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="display text-4xl">Hochladen</h1>
        <p className="text-muted text-sm">Teile eine Erinnerung mit der Klasse.</p>
      </header>

      {classes.length > 1 && (
        <div>
          <label className="label">Klasse</label>
          <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">— Klasse wählen —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {classId && !choice && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CHOICES.map((c) => (
            <button key={c.key} onClick={() => setChoice(c.key)} className="card p-5 text-left hover:-translate-y-1 transition">
              <div className="font-extrabold">{c.label}</div>
              <div className="text-xs text-muted mt-0.5">{c.hint}</div>
            </button>
          ))}
        </div>
      )}

      {classId && choice && (
        <div className="space-y-3">
          <button onClick={() => { setChoice(null); setDone(false); }} className="text-sm text-muted">← andere Art wählen</button>
          {done && <p className="text-sage font-bold text-center">Gepostet! Du kannst noch eins hinzufügen.</p>}
          {choice === "POSTIT" ? (
            <CreatePost key="postit" classId={classId} board="POSTIT" onCreated={() => setDone(true)} />
          ) : (
            <CreatePost
              key={choice}
              classId={classId}
              board="YEARBOOK"
              members={subjectMembers}
              defaultKind={choice === "IMAGE" ? "IMAGE" : "QUOTE"}
              onCreated={() => setDone(true)}
            />
          )}
        </div>
      )}
    </div>
  );
}
