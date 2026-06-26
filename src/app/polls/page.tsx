"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreatePoll } from "@/components/CreatePoll";
import { PollCard, type Poll } from "@/components/PollCard";

type ClassItem = { id: string; name: string };

export default function PollsPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const [classesRes, pollsRes] = await Promise.all([fetch("/api/classes"), fetch("/api/polls")]);
    if (classesRes.status === 401 || pollsRes.status === 401) return router.push("/login");
    if (!classesRes.ok || !pollsRes.ok) {
      setError("Umfragen konnten nicht geladen werden.");
      setPolls([]);
      return;
    }
    const classesData = await classesRes.json();
    const pollsData = await pollsRes.json();
    setClasses(classesData.classes ?? []);
    setPolls(pollsData.polls ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  function upsertPoll(updated: Poll) {
    setPolls((current) => {
      const list = current ?? [];
      return list.some((poll) => poll.id === updated.id)
        ? list.map((poll) => (poll.id === updated.id ? updated : poll))
        : [updated, ...list];
    });
  }

  function removePoll(id: string) {
    setPolls((current) => (current ?? []).filter((poll) => poll.id !== id));
  }

  if (error) return <p className="text-coral font-bold">{error}</p>;
  if (polls === null) return <p className="text-muted">Lädt…</p>;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label mb-2">Abstimmen</p>
          <h1 className="display text-6xl leading-[0.86] sm:text-7xl">Umfragen</h1>
          <p className="mt-2 max-w-xl text-sm font-black text-ink/60">
            Fragen, Entscheidungen und kleine Rankings aus deiner Klasse.
          </p>
        </div>
        {classes.length > 0 && (
          <button onClick={() => setShowCreate((v) => !v)} className="btn-accent">
            {showCreate ? "Schliessen" : "Umfrage erstellen"}
          </button>
        )}
      </header>

      {showCreate && classes.length > 0 && (
        <CreatePoll
          classes={classes}
          onCreated={(poll) => {
            upsertPoll(poll);
            setShowCreate(false);
          }}
        />
      )}

      {classes.length === 0 ? (
        <div className="glass-panel p-8 text-center font-bold text-ink/60">Tritt zuerst einer Klasse bei.</div>
      ) : polls.length === 0 ? (
        <div className="glass-panel p-8 text-center font-bold text-ink/60">Noch keine Umfragen. Erstelle die erste!</div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {polls.map((poll) => (
            <PollCard key={poll.id} poll={poll} onVoted={upsertPoll} onDeleted={removePoll} />
          ))}
        </div>
      )}
    </div>
  );
}
