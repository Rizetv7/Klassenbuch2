"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "./Nav";

export type Poll = {
  id: string;
  question: string;
  description: string | null;
  anonymous: boolean;
  multipleChoice: boolean;
  createdAt: string;
  class: { id: string; name: string };
  author: { id: string; name: string; avatarUrl: string | null; accentColor?: string | null } | null;
  options: {
    id: string;
    text: string;
    count: number;
    percent: number;
    selectedByMe: boolean;
    voters: { id: string; name: string; avatarUrl: string | null; accentColor?: string | null }[];
  }[];
  selectedOptionIds: string[];
  votedByMe: boolean;
  totalVotes: number;
  leader: { id: string; text: string; count: number; percent: number } | null;
};

export function PollCard({
  poll,
  featured = false,
  onVoted,
}: {
  poll: Poll;
  featured?: boolean;
  onVoted?: (poll: Poll) => void;
}) {
  const [selected, setSelected] = useState<string[]>(poll.selectedOptionIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pulseOptionId, setPulseOptionId] = useState<string | null>(null);

  useEffect(() => {
    setSelected(poll.selectedOptionIds);
    setError("");
  }, [poll.id, poll.selectedOptionIds.join("|")]);

  const selectedKey = useMemo(() => [...selected].sort().join("|"), [selected]);
  const savedKey = useMemo(() => [...poll.selectedOptionIds].sort().join("|"), [poll.selectedOptionIds]);
  const changed = selectedKey !== savedKey;
  const showResults = poll.votedByMe || poll.totalVotes > 0;
  const originalIndex = useMemo(() => new Map(poll.options.map((option, index) => [option.id, index])), [poll.options]);
  const displayedOptions = useMemo(() => {
    if (!showResults) return poll.options;
    return [...poll.options].sort((a, b) => b.count - a.count || (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0));
  }, [originalIndex, poll.options, showResults]);

  function nextSelection(optionId: string) {
    if (!poll.multipleChoice) return [optionId];
    if (!selected.includes(optionId)) return [...selected, optionId];
    if (selected.length <= 1) return selected;
    return selected.filter((id) => id !== optionId);
  }

  function choose(optionId: string) {
    const optionIds = nextSelection(optionId);
    if (optionIds.length === 0) return;
    setError("");
    setSelected(optionIds);
    setPulseOptionId(optionId);
    window.setTimeout(() => setPulseOptionId(null), 520);
  }

  async function submitVote() {
    if (selected.length === 0 || busy) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/polls/${poll.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionIds: selected }),
    });
    const d = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok) {
      setSelected(d.poll.selectedOptionIds);
      onVoted?.(d.poll);
    } else {
      setSelected(poll.selectedOptionIds);
      setError(d?.error || "Abstimmen fehlgeschlagen.");
    }
  }

  return (
    <article className={`${featured ? "hero-frame p-5 sm:p-7" : "glass-card p-4"} overflow-hidden`}>
      <div className="relative z-10">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="chip">{poll.class.name}</span>
          <span className="chip">{poll.multipleChoice ? "Mehrfachauswahl" : "Einfachauswahl"}</span>
          {poll.anonymous ? <span className="chip">Stimmen anonym</span> : <span className="chip">Stimmen sichtbar</span>}
          {poll.leader && showResults && <span className="chip animate-pop">Gewinnt: {poll.leader.text}</span>}
        </div>

        <h2 className={`display break-words leading-[0.9] ${featured ? "text-5xl sm:text-6xl" : "text-3xl sm:text-4xl"}`}>
          {poll.question}
        </h2>
        {poll.description && <p className="mt-3 text-sm font-black text-ink/60">{poll.description}</p>}
        <p className="mt-3 flex items-center gap-2 text-xs font-black text-ink/55">
          {poll.author && <Avatar name={poll.author.name} url={poll.author.avatarUrl} accent={poll.author.accentColor} size={24} ring={false} />}
          Erstellt von {poll.author?.name ?? "Unbekannt"}
        </p>

        <div className="mt-5 space-y-2.5">
          {displayedOptions.map((option) => {
            const picked = selected.includes(option.id);
            const winner = poll.leader?.id === option.id && showResults;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => choose(option.id)}
                className={`relative w-full overflow-hidden rounded-[24px] border px-4 py-3 text-left transition-all duration-300 active:scale-[0.99] ${
                  picked ? "border-ink bg-white/42" : "border-white/45 bg-white/18 hover:bg-white/30"
                } ${winner ? "poll-option-winner" : ""} ${pulseOptionId === option.id ? "vote-pop" : ""}`}
              >
                {showResults && (
                  <span
                    className={`absolute inset-y-0 left-0 rounded-[24px] transition-all duration-700 ease-out ${
                      winner ? "bg-hotpink/35" : "bg-white/28"
                    }`}
                    style={{ width: `${option.percent}%` }}
                  />
                )}
                <span className="relative z-10 flex items-center justify-between gap-3">
                  <span className="min-w-0 font-black leading-tight">
                    <span className={`mr-2 inline-grid h-5 w-5 place-items-center rounded-full border text-[11px] ${picked ? "border-ink bg-ink text-white" : "border-ink/30 text-transparent"}`}>
                      ✓
                    </span>
                    {option.text}
                  </span>
                  {showResults && (
                    <span className="shrink-0 text-xs font-black text-ink/55">
                      {option.percent}% · {option.count}
                    </span>
                  )}
                </span>
                {!poll.anonymous && option.voters.length > 0 && (
                  <span className="relative z-10 mt-2 flex flex-wrap gap-1.5 pl-7">
                    {option.voters.slice(0, 6).map((voter) => (
                      <span key={voter.id} className="inline-flex items-center gap-1 rounded-full bg-white/35 px-2 py-1 text-[10px] font-black text-ink/55">
                        <Avatar name={voter.name} url={voter.avatarUrl} accent={voter.accentColor} size={16} ring={false} />
                        {voter.name}
                      </span>
                    ))}
                    {option.voters.length > 6 && (
                      <span className="rounded-full bg-white/35 px-2 py-1 text-[10px] font-black text-ink/55">
                        +{option.voters.length - 6}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-black text-ink/50">
            {busy
              ? "Speichert..."
              : poll.votedByMe
                ? changed ? "Änderung noch nicht abgegeben" : "Du hast abgestimmt"
                : selected.length > 0 ? "Auswahl bereit" : "Wähle eine Antwort"} · {poll.totalVotes} Person{poll.totalVotes === 1 ? "" : "en"}
          </p>
          <button
            type="button"
            onClick={submitVote}
            className="btn-accent"
            disabled={busy || selected.length === 0 || (poll.votedByMe && !changed)}
          >
            {busy ? "Speichert..." : poll.votedByMe ? (changed ? "Stimme ändern" : "Abgegeben") : "Umfrage abgeben"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm font-black text-coral">{error}</p>}
      </div>
    </article>
  );
}
