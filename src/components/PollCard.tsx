"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "./Nav";

export type Poll = {
  id: string;
  question: string;
  description: string | null;
  candidateType: "STUDENTS" | "TEACHERS" | null;
  anonymous: boolean;
  multipleChoice: boolean;
  createdAt: string;
  class: { id: string; name: string };
  author: { id: string; name: string; avatarUrl: string | null; accentColor?: string | null } | null;
  options: {
    id: string;
    text: string;
    subjectMembershipId?: string | null;
    teacherId?: string | null;
    count: number;
    percent: number;
    selectedByMe: boolean;
    voters: { id: string; name: string; avatarUrl: string | null; accentColor?: string | null }[];
  }[];
  selectedOptionIds: string[];
  votedByMe: boolean;
  totalVotes: number;
  leader: { id: string; text: string; count: number; percent: number } | null;
  viewerCanDelete?: boolean;
};

type CandidateChoice = {
  key: string;
  id: string;
  label: string;
  sublabel?: string | null;
  avatarUrl?: string | null;
  accentColor?: string | null;
};

type DisplayOption = Poll["options"][number] & {
  pending?: boolean;
};

export function PollCard({
  poll,
  featured = false,
  onVoted,
  onDeleted,
}: {
  poll: Poll;
  featured?: boolean;
  onVoted?: (poll: Poll) => void;
  onDeleted?: (pollId: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>(poll.selectedOptionIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pulseOptionId, setPulseOptionId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateChoice[]>([]);
  const [candidateKey, setCandidateKey] = useState("");

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
  const optionTargetKeys = useMemo(() => new Set(poll.options.map((option) => (
    option.subjectMembershipId ? `student:${option.subjectMembershipId}` : option.teacherId ? `teacher:${option.teacherId}` : ""
  )).filter(Boolean)), [poll.options]);
  const pendingCandidateKeys = selected.filter((id) => id.startsWith("new:")).map((id) => id.slice(4));
  const pendingOptions: DisplayOption[] = pendingCandidateKeys.map((key) => {
    const [type, id] = key.split(":");
    const candidate = candidates.find((item) => item.key === key);
    return {
      id: `new:${key}`,
      text: candidate ? `${candidate.label}${candidate.sublabel ? ` (${candidate.sublabel})` : ""}` : id,
      subjectMembershipId: type === "student" ? id : null,
      teacherId: type === "teacher" ? id : null,
      count: 0,
      percent: 0,
      selectedByMe: true,
      voters: [],
      pending: true,
    };
  });
  const optionsForDisplay: DisplayOption[] = [...displayedOptions, ...pendingOptions];
  const availableCandidates = candidates.filter((candidate) => !optionTargetKeys.has(candidate.key) && !pendingCandidateKeys.includes(candidate.key));

  useEffect(() => {
    let cancelled = false;
    async function loadCandidates() {
      if (!poll.candidateType) {
        setCandidates([]);
        return;
      }
      const url = poll.candidateType === "TEACHERS"
        ? `/api/classes/${poll.class.id}/teachers`
        : `/api/classes/${poll.class.id}`;
      const data = await fetch(url).then((r) => r.json()).catch(() => null);
      if (cancelled) return;
      if (poll.candidateType === "TEACHERS") {
        setCandidates((data?.teachers ?? []).map((teacher: any) => ({
          key: `teacher:${teacher.id}`,
          id: teacher.id,
          label: teacher.name,
          sublabel: teacher.subject,
          avatarUrl: teacher.avatarUrl,
          accentColor: teacher.accentColor,
        })));
      } else {
        setCandidates((data?.members ?? [])
          .filter((member: any) => member.memberType === "STUDENT")
          .map((member: any) => ({
            key: `student:${member.id}`,
            id: member.id,
            label: member.displayName,
            avatarUrl: member.avatarUrl,
            accentColor: member.accentColor,
          })));
      }
    }
    loadCandidates();
    return () => {
      cancelled = true;
    };
  }, [poll.candidateType, poll.class.id]);

  function nextSelection(optionId: string) {
    if (!poll.multipleChoice && selected.includes(optionId)) return [];
    if (!poll.multipleChoice) return [optionId];
    if (!selected.includes(optionId)) return [...selected, optionId];
    return selected.filter((id) => id !== optionId);
  }

  function choose(optionId: string) {
    const optionIds = nextSelection(optionId);
    setError("");
    setSelected(optionIds);
    setPulseOptionId(optionId);
    window.setTimeout(() => setPulseOptionId(null), 520);
  }

  function addCandidate() {
    if (!candidateKey) return;
    const optionId = `new:${candidateKey}`;
    setSelected((current) => {
      if (current.includes(optionId)) return current;
      return poll.multipleChoice ? [...current, optionId] : [optionId];
    });
    setCandidateKey("");
    setError("");
    setPulseOptionId(optionId);
    window.setTimeout(() => setPulseOptionId(null), 520);
  }

  function candidatePayload(id: string) {
    const key = id.startsWith("new:") ? id.slice(4) : id;
    const [type, targetId] = key.split(":");
    if (type === "student") return { subjectMembershipId: targetId };
    if (type === "teacher") return { teacherId: targetId };
    return {};
  }

  async function submitVote() {
    if (busy || (!poll.votedByMe && selected.length === 0)) return;
    setBusy(true);
    setError("");
    const existingOptionIds = selected.filter((id) => !id.startsWith("new:"));
    const candidateTargets = selected.filter((id) => id.startsWith("new:")).map(candidatePayload);
    const res = await fetch(`/api/polls/${poll.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionIds: existingOptionIds, candidateTargets }),
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

  async function deletePoll() {
    if (busy || !window.confirm("Diese Umfrage wirklich löschen?")) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/polls/${poll.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok) {
      onDeleted?.(poll.id);
    } else {
      setError(d?.error || "Löschen fehlgeschlagen.");
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
          {poll.viewerCanDelete && (
            <button type="button" onClick={deletePoll} className="chip text-coral transition hover:bg-white/55" disabled={busy}>
              Umfrage löschen
            </button>
          )}
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
          {optionsForDisplay.map((option) => {
            const picked = selected.includes(option.id);
            const winner = poll.leader?.id === option.id && showResults;
            const targetKey = option.subjectMembershipId ? `student:${option.subjectMembershipId}` : option.teacherId ? `teacher:${option.teacherId}` : "";
            const candidate = candidates.find((item) => item.key === targetKey);
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
                      winner ? "bg-hotpink/45" : "bg-cyan/30"
                    }`}
                    style={{ width: `${option.percent}%` }}
                  />
                )}
                <span className="relative z-10 flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center font-black leading-tight">
                    <span className={`mr-2 inline-grid h-5 w-5 place-items-center rounded-full border text-[11px] ${picked ? "border-ink bg-ink text-white" : "border-ink/30 text-transparent"}`}>
                      ✓
                    </span>
                    {candidate && (
                      <Avatar name={candidate.label} url={candidate.avatarUrl} accent={candidate.accentColor} size={24} ring={false} />
                    )}
                    <span className={candidate ? "ml-2 truncate" : "truncate"}>
                      {candidate?.label ?? option.text}
                    </span>
                  </span>
                  {option.pending ? (
                    <span className="shrink-0 rounded-full bg-white/40 px-2 py-1 text-[10px] font-black text-ink/55">
                      neu
                    </span>
                  ) : showResults && (
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
          {poll.candidateType && optionsForDisplay.length === 0 && (
            <div className="rounded-[24px] border border-white/45 bg-white/18 p-4 text-sm font-black text-ink/55">
              Noch niemand ist im Rennen. Füge unten eine Person hinzu und gib deine Stimme ab.
            </div>
          )}
        </div>

        {poll.candidateType && (
          <div className="mt-3 flex flex-col gap-2 rounded-[24px] border border-white/45 bg-white/18 p-3 sm:flex-row">
            <select className="input !py-2 text-sm" value={candidateKey} onChange={(e) => setCandidateKey(e.target.value)}>
              <option value="">{poll.candidateType === "TEACHERS" ? "Lehrperson hinzufügen" : "Schüler:in hinzufügen"}</option>
              {availableCandidates.map((candidate) => (
                <option key={candidate.key} value={candidate.key}>
                  {candidate.label}{candidate.sublabel ? ` (${candidate.sublabel})` : ""}
                </option>
              ))}
            </select>
            <button type="button" onClick={addCandidate} className="btn-soft shrink-0" disabled={!candidateKey}>
              Ins Rennen
            </button>
          </div>
        )}

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
            disabled={busy || (!poll.votedByMe && selected.length === 0) || (poll.votedByMe && !changed)}
          >
            {busy ? "Speichert..." : poll.votedByMe ? (changed ? (selected.length === 0 ? "Stimme zurückziehen" : "Stimme ändern") : "Abgegeben") : "Umfrage abgeben"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm font-black text-coral">{error}</p>}
      </div>
    </article>
  );
}
