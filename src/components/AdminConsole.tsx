"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "./Nav";

export type AdminPerson = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  accentColor?: string | null;
};

export type AdminComment = {
  id: string;
  text: string;
  parentId?: string | null;
  createdAt: string;
  author: AdminPerson;
};

export type AdminPost = {
  id: string;
  board: string;
  kind: string;
  text?: string | null;
  context?: string | null;
  saidByName?: string | null;
  anonymous: boolean;
  imageUrl?: string | null;
  createdAt: string;
  author: AdminPerson;
  subject?: {
    id: string;
    displayName: string;
    user: AdminPerson;
  } | null;
  teacher?: AdminPerson | null;
  topic?: { id: string; name: string } | null;
  comments: AdminComment[];
  _count: { likes: number; comments: number };
};

export type AdminPoll = {
  id: string;
  question: string;
  description?: string | null;
  candidateType?: string | null;
  anonymous: boolean;
  multipleChoice: boolean;
  createdAt: string;
  author: AdminPerson;
  totalVoters: number;
  options: Array<{
    id: string;
    text: string;
    position: number;
    percent: number;
    votes: Array<{ id: string; createdAt: string; user: AdminPerson }>;
  }>;
  comments: AdminComment[];
};

export function formatAdminDate(value: string) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AdminHeader({ backHref }: { backHref?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/archivzugang");
    router.refresh();
  }

  return (
    <header className="surface mb-8 flex items-center gap-3 px-4 py-2.5">
      {backHref ? (
        <Link
          href={backHref}
          aria-label="Zurück zur Übersicht"
          title="Zurück zur Übersicht"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink text-lg font-black text-oncolor transition active:scale-95"
        >
          ←
        </Link>
      ) : null}
      <div className="min-w-0">
        <p className="section-label leading-none">Interner Bereich</p>
        <p className="display truncate text-xl leading-tight">Maturaziitig Archiv</p>
      </div>
      <button
        type="button"
        className="btn-soft ml-auto !px-4 !py-2"
        onClick={logout}
        disabled={busy}
      >
        {busy ? "..." : "Abmelden"}
      </button>
    </header>
  );
}

export function RenameUser({
  user,
  onSaved,
}: {
  user: AdminPerson;
  onSaved: (user: AdminPerson) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Name konnte nicht geändert werden.");
        return;
      }
      onSaved(data.user);
      setName(data.user.name);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        className="text-xs font-black text-ink/55 underline decoration-ink/25 underline-offset-4 hover:text-ink"
        onClick={() => setEditing(true)}
      >
        Name ändern
      </button>
    );
  }

  return (
    <form onSubmit={save} className="mt-2 space-y-2">
      <div className="flex gap-2">
        <input
          className="input !rounded-[18px] !px-3 !py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={2}
          maxLength={60}
          autoFocus
          required
        />
        <button className="btn-primary !px-3 !py-2" disabled={busy}>
          {busy ? "..." : "Speichern"}
        </button>
      </div>
      <div className="flex items-center justify-between gap-3">
        {error ? <p className="text-xs font-black text-coral">{error}</p> : <span />}
        <button
          type="button"
          className="text-xs font-black text-ink/45 underline"
          onClick={() => {
            setEditing(false);
            setName(user.name);
            setError("");
          }}
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}

// Admin sets a new password for a person who is locked out. The old password
// can't be shown (only a one-way hash is stored) — the new one is displayed
// exactly once so the admin can pass it on.
export function ResetPassword({ user }: { user: AdminPerson }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${user.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(custom.trim() ? { password: custom.trim() } : {}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Zurücksetzen fehlgeschlagen.");
        return;
      }
      setResult(data.password);
      setCustom("");
      setCopied(false);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  if (!open) {
    return (
      <button
        type="button"
        className="text-xs font-black text-ink/55 underline decoration-ink/25 underline-offset-4 hover:text-ink"
        onClick={() => setOpen(true)}
      >
        Passwort zurücksetzen
      </button>
    );
  }

  return (
    <div className="mt-2 w-full space-y-2 rounded-[18px] border border-white/40 bg-white/15 p-3">
      {result ? (
        <div className="space-y-2">
          <p className="text-xs font-bold text-ink/60">
            Neues Passwort für <span className="font-black text-ink">{user.name}</span> — wird nur jetzt angezeigt, gib es der Person weiter:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-[14px] bg-ink px-3 py-2 text-center font-mono text-lg font-black tracking-wide text-oncolor">
              {result}
            </code>
            <button type="button" className="btn-soft !px-3 !py-2 text-xs" onClick={copy}>
              {copied ? "Kopiert ✓" : "Kopieren"}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-ink/45">Die Person kann es im Profil jederzeit ändern.</p>
            <button
              type="button"
              className="text-xs font-black text-ink/45 underline"
              onClick={() => {
                setResult("");
                setOpen(false);
              }}
            >
              Fertig
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={reset} className="space-y-2">
          <p className="text-xs font-bold text-ink/60">
            Setzt ein neues Passwort für <span className="font-black text-ink">{user.name}</span>. Das alte wird ungültig.
          </p>
          <div className="flex gap-2">
            <input
              className="input !rounded-[18px] !px-3 !py-2"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Leer lassen = automatisch"
              minLength={6}
            />
            <button className="btn-primary !px-3 !py-2" disabled={busy}>
              {busy ? "..." : "Setzen"}
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            {error ? <p className="text-xs font-black text-coral">{error}</p> : <span />}
            <button
              type="button"
              className="text-xs font-black text-ink/45 underline"
              onClick={() => {
                setOpen(false);
                setError("");
                setCustom("");
              }}
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function PersonSignature({ person, label }: { person: AdminPerson; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar
        name={person.name}
        url={person.avatarUrl}
        accent={person.accentColor}
        size={32}
      />
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase text-ink/45">{label}</p>
        <p className="truncate text-sm font-black">{person.name}</p>
      </div>
    </div>
  );
}

function CommentList({ comments }: { comments: AdminComment[] }) {
  if (comments.length === 0) return null;
  return (
    <div className="mt-4 border-t border-white/35 pt-3">
      <p className="section-label mb-2">Kommentare</p>
      <div className="space-y-2">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-2 rounded-[18px] bg-white/15 p-2.5">
            <Avatar
              name={comment.author.name}
              url={comment.author.avatarUrl}
              accent={comment.author.accentColor}
              size={27}
              ring={false}
            />
            <div className="min-w-0">
              <p className="text-xs font-black">{comment.author.name}</p>
              <p className="whitespace-pre-wrap text-sm font-semibold leading-snug text-ink/75">
                {comment.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminPostEntry({ post }: { post: AdminPost }) {
  const target = post.subject?.user.name || post.subject?.displayName || post.teacher?.name || post.topic?.name;
  const targetAvatar = post.subject?.user || post.teacher || null;

  return (
    <article className="glass-card overflow-hidden p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-3">
        {targetAvatar ? (
          <Avatar
            name={targetAvatar.name}
            url={targetAvatar.avatarUrl}
            accent={targetAvatar.accentColor}
            size={48}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip !py-1">{post.kind === "QUOTE" ? "Zitat" : post.kind === "IMAGE" ? "Bild" : "Notiz"}</span>
            {post.anonymous ? <span className="chip !border-hotpink/40 !bg-hotpink/15">Anonym veröffentlicht</span> : null}
          </div>
          {target ? <p className="mt-1 truncate text-sm font-black text-ink/65">{target}</p> : null}
        </div>
        <time className="text-xs font-bold text-ink/45">{formatAdminDate(post.createdAt)}</time>
      </div>

      <div className={`mt-3 grid gap-3 ${post.imageUrl ? "md:grid-cols-[minmax(0,1fr)_220px]" : ""}`}>
        <div>
          {post.text ? (
            <p className={post.kind === "QUOTE" ? "font-display text-2xl font-black leading-tight" : "whitespace-pre-wrap text-base font-bold leading-snug"}>
              {post.kind === "QUOTE" ? `„${post.text}“` : post.text}
            </p>
          ) : null}
          {post.context ? <p className="mt-2 text-sm font-bold text-ink/55">{post.context}</p> : null}
          {post.saidByName ? <p className="mt-2 text-sm font-black text-ink/70">— {post.saidByName}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <PersonSignature
              person={post.author}
              label={post.anonymous ? "Tatsächlicher Urheber" : "Erstellt von"}
            />
            <p className="text-xs font-black text-ink/45">
              {post._count.likes} Likes · {post._count.comments} Kommentare
            </p>
          </div>
        </div>
        {post.imageUrl ? (
          <a href={post.imageUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[22px] bg-white/25">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.imageUrl} alt="Beitrag" className="aspect-[4/3] h-full w-full object-cover" loading="lazy" />
          </a>
        ) : null}
      </div>
      <CommentList comments={post.comments} />
    </article>
  );
}

export function AdminPollEntry({ poll }: { poll: AdminPoll }) {
  return (
    <article className="glass-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            <span className="chip !py-1">Umfrage</span>
            {poll.anonymous ? <span className="chip !border-hotpink/40 !bg-hotpink/15">Stimmen anonym</span> : null}
            {poll.multipleChoice ? <span className="chip !py-1">Mehrfachauswahl</span> : null}
          </div>
          <h2 className="display text-2xl leading-tight sm:text-3xl">{poll.question}</h2>
          {poll.description ? <p className="mt-1 text-sm font-bold text-ink/60">{poll.description}</p> : null}
        </div>
        <time className="text-xs font-bold text-ink/45">{formatAdminDate(poll.createdAt)}</time>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <PersonSignature person={poll.author} label="Erstellt von" />
        <span className="chip">{poll.totalVoters} Personen</span>
      </div>

      <div className="mt-4 space-y-3">
        {poll.options.map((option) => (
          <div key={option.id} className="relative overflow-hidden rounded-[22px] border border-white/40 bg-white/12 p-3">
            <div
              className="absolute inset-y-0 left-0 bg-white/25 transition-[width] duration-500"
              style={{ width: `${Math.min(100, option.percent)}%` }}
            />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black">{option.text}</p>
                {option.votes.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {option.votes.map((vote) => (
                      <span key={vote.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/30 py-1 pl-1 pr-2 text-xs font-black">
                        <Avatar
                          name={vote.user.name}
                          url={vote.user.avatarUrl}
                          accent={vote.user.accentColor}
                          size={20}
                          ring={false}
                        />
                        {vote.user.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs font-bold text-ink/40">Keine Stimmen</p>
                )}
              </div>
              <p className="shrink-0 text-sm font-black">{option.percent}% · {option.votes.length}</p>
            </div>
          </div>
        ))}
      </div>
      <CommentList comments={poll.comments} />
    </article>
  );
}
