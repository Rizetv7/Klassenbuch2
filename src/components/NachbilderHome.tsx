"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Post } from "./PostCard";
import { ThemeMenu } from "./ThemeMenu";
import { swrJson } from "@/lib/swr";
import type { MemoryFragment } from "./NachbilderScene";

const NachbilderScene = dynamic(
  () => import("./NachbilderScene").then((module) => module.NachbilderScene),
  {
    ssr: false,
    loading: () => <div className="nb-scene-loading" aria-label="Archiv wird aufgebaut" />,
  },
);

type Person = {
  id: string;
  displayName: string;
  memberType: "STUDENT" | "TEACHER";
  avatarUrl: string | null;
  accentColor: string | null;
  postCount: number;
};

type Teacher = {
  id: string;
  name: string;
  subject: string | null;
  avatarUrl: string | null;
  accentColor: string | null;
  postCount: number;
};

type ClassSummary = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
};

type ClassDetail = {
  id: string;
  name: string;
  description: string | null;
  members: Person[];
};

type AudioEngine = {
  context: AudioContext;
  master: GainNode;
  sources: OscillatorNode[];
};

const PALETTE = ["#a99bd2", "#7fa6b8", "#c39b8c", "#8fa89f", "#b991a4", "#c8baa2"];

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function colorFor(value: string, provided?: string | null) {
  return provided || PALETTE[hash(value) % PALETTE.length];
}

function textFor(post?: Post) {
  if (!post) return null;
  if (post.text) return post.kind === "QUOTE" ? `“${post.text}”` : post.text;
  return post.topic?.name || null;
}

function imageFor(post?: Post, avatar?: string | null) {
  return post?.imageUrl || avatar || null;
}

function roleLabel(memberType: string) {
  return memberType === "TEACHER" ? "Lehrperson" : "Schüler:in";
}

export function NachbilderHome({
  me,
  posts,
  hasClass,
}: {
  me: { name: string; avatarUrl?: string | null; accentColor?: string | null };
  posts: Post[];
  hasClass: boolean;
}) {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [entered, setEntered] = useState(false);
  const [mode, setMode] = useState<"explore" | "index">("explore");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visited, setVisited] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [soundOn, setSoundOn] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const audioRef = useRef<AudioEngine | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    if (sessionStorage.getItem("mz-nachbilder-entered") === "yes") setEntered(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      media.removeEventListener("change", sync);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    return swrJson<{ classes?: ClassSummary[] }>("/api/classes", (data) => {
      setClasses(data?.classes ?? []);
    });
  }, []);

  const classId = classes[0]?.id || posts[0]?.class.id || null;

  useEffect(() => {
    if (!classId) return;
    const cancelDetail = swrJson<ClassDetail>(`/api/classes/${classId}`, (data) => {
      if (data) setClassDetail(data);
    });
    const cancelTeachers = swrJson<{ teachers?: Teacher[] }>(`/api/classes/${classId}/teachers`, (data) => {
      setTeachers(data?.teachers ?? []);
    });
    return () => {
      cancelDetail();
      cancelTeachers();
    };
  }, [classId]);

  useEffect(() => {
    return () => {
      const engine = audioRef.current;
      engine?.sources.forEach((source) => {
        try {
          source.stop();
        } catch {}
      });
      engine?.context.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const syncAudioWithPage = () => {
      const engine = audioRef.current;
      if (!engine) return;
      if (document.hidden) engine.context.suspend().catch(() => {});
      else if (soundOn) engine.context.resume().catch(() => {});
    };
    document.addEventListener("visibilitychange", syncAudioWithPage);
    return () => document.removeEventListener("visibilitychange", syncAudioWithPage);
  }, [soundOn]);

  const primaryClass = classes[0];
  const className = classDetail?.name || primaryClass?.name || posts[0]?.class.name || "Maturaziitig";

  const fragments = useMemo<MemoryFragment[]>(() => {
    const result = new Map<string, MemoryFragment>();
    const subjectPost = new Map<string, Post>();
    const teacherPost = new Map<string, Post>();

    for (const post of posts) {
      if (post.subject) {
        const current = subjectPost.get(post.subject.id);
        if (!current || (!current.imageUrl && post.imageUrl)) subjectPost.set(post.subject.id, post);
      }
      if (post.teacher) {
        const current = teacherPost.get(post.teacher.id);
        if (!current || (!current.imageUrl && post.imageUrl)) teacherPost.set(post.teacher.id, post);
      }
    }

    for (const member of classDetail?.members ?? []) {
      const post = subjectPost.get(member.id);
      result.set(`member-${member.id}`, {
        id: `member-${member.id}`,
        name: member.displayName,
        role: roleLabel(member.memberType),
        href: `/classes/${classDetail?.id || classId}/members/${member.id}`,
        avatarUrl: member.avatarUrl,
        imageUrl: imageFor(post, member.avatarUrl),
        accentColor: colorFor(member.id, member.accentColor),
        text: textFor(post),
        className,
        postCount: member.postCount,
      });
    }

    for (const teacher of teachers) {
      const post = teacherPost.get(teacher.id);
      result.set(`teacher-${teacher.id}`, {
        id: `teacher-${teacher.id}`,
        name: teacher.name,
        role: teacher.subject || "Lehrperson",
        href: `/classes/${classId}/teachers/${teacher.id}`,
        avatarUrl: teacher.avatarUrl,
        imageUrl: imageFor(post, teacher.avatarUrl),
        accentColor: colorFor(teacher.id, teacher.accentColor),
        text: textFor(post),
        className,
        postCount: teacher.postCount,
      });
    }

    for (const post of posts) {
      if (post.subject && !result.has(`member-${post.subject.id}`)) {
        result.set(`member-${post.subject.id}`, {
          id: `member-${post.subject.id}`,
          name: post.subject.displayName,
          role: roleLabel(post.subject.memberType),
          href: `/classes/${post.class.id}/members/${post.subject.id}`,
          avatarUrl: post.subject.avatarUrl,
          imageUrl: imageFor(post, post.subject.avatarUrl),
          accentColor: colorFor(post.subject.id, post.subject.accentColor),
          text: textFor(post),
          className: post.class.name,
          postCount: 1,
        });
      }
      if (post.teacher && !result.has(`teacher-${post.teacher.id}`)) {
        result.set(`teacher-${post.teacher.id}`, {
          id: `teacher-${post.teacher.id}`,
          name: post.teacher.name,
          role: post.teacher.subject || "Lehrperson",
          href: `/classes/${post.class.id}/teachers/${post.teacher.id}`,
          avatarUrl: post.teacher.avatarUrl,
          imageUrl: imageFor(post, post.teacher.avatarUrl),
          accentColor: colorFor(post.teacher.id, post.teacher.accentColor),
          text: textFor(post),
          className: post.class.name,
          postCount: 1,
        });
      }
    }

    if (result.size === 0) {
      result.set("self", {
        id: "self",
        name: me.name,
        role: "Teil der Erinnerung",
        href: "/profile",
        avatarUrl: me.avatarUrl ?? null,
        imageUrl: me.avatarUrl ?? null,
        accentColor: colorFor(me.name, me.accentColor),
        text: hasClass ? "Das Archiv wartet auf seine ersten Spuren." : "Tritt einer Klasse bei, damit aus einer Spur eine Konstellation wird.",
        className,
        postCount: 0,
      });
    }

    return [...result.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [classDetail, classId, className, hasClass, me, posts, teachers]);

  const selected = fragments.find((fragment) => fragment.id === selectedId) ?? null;
  const hovered = fragments.find((fragment) => fragment.id === hoveredId) ?? null;
  const shownCount = primaryClass?.memberCount ? primaryClass.memberCount + teachers.length : fragments.length;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("de");
    if (!normalized) return fragments;
    return fragments.filter((fragment) => `${fragment.name} ${fragment.role} ${fragment.text || ""}`.toLocaleLowerCase("de").includes(normalized));
  }, [fragments, query]);

  const startAudio = useCallback(async () => {
    if (audioRef.current) {
      await audioRef.current.context.resume();
      audioRef.current.master.gain.cancelScheduledValues(audioRef.current.context.currentTime);
      audioRef.current.master.gain.linearRampToValueAtTime(0.022, audioRef.current.context.currentTime + 0.5);
      setSoundOn(true);
      return;
    }
    const context = new AudioContext();
    const master = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 240;
    filter.Q.value = 0.4;
    master.gain.value = 0;
    filter.connect(master);
    master.connect(context.destination);

    const sources = [43.65, 65.41, 87.31].map((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 1 ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index * 3 - 3;
      gain.gain.value = index === 0 ? 0.6 : 0.18;
      oscillator.connect(gain);
      gain.connect(filter);
      oscillator.start();
      return oscillator;
    });
    audioRef.current = { context, master, sources };
    master.gain.linearRampToValueAtTime(0.022, context.currentTime + 1.6);
    setSoundOn(true);
  }, []);

  const muteAudio = useCallback(() => {
    const engine = audioRef.current;
    if (!engine) {
      startAudio().catch(() => {});
      return;
    }
    const now = engine.context.currentTime;
    engine.master.gain.cancelScheduledValues(now);
    engine.master.gain.linearRampToValueAtTime(soundOn ? 0 : 0.022, now + 0.35);
    setSoundOn((current) => !current);
  }, [soundOn, startAudio]);

  const playResonance = useCallback(() => {
    const engine = audioRef.current;
    if (!engine || !soundOn) return;
    const oscillator = engine.context.createOscillator();
    const gain = engine.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 196 + (visited.size % 5) * 27;
    gain.gain.setValueAtTime(0.0001, engine.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, engine.context.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, engine.context.currentTime + 0.72);
    oscillator.connect(gain);
    gain.connect(engine.master);
    oscillator.start();
    oscillator.stop(engine.context.currentTime + 0.75);
  }, [soundOn, visited.size]);

  const enter = useCallback((withSound: boolean) => {
    sessionStorage.setItem("mz-nachbilder-entered", "yes");
    setEntered(true);
    if (withSound) startAudio().catch(() => {});
  }, [startAudio]);

  const selectFragment = useCallback((id: string) => {
    setSelectedId(id);
    setVisited((current) => new Set(current).add(id));
    playResonance();
  }, [playResonance]);

  const closeDetail = useCallback(() => setSelectedId(null), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selectedId) closeDetail();
        else if (mode === "index") setMode("explore");
      }
      if (event.key === " " && entered && !selectedId && event.target === document.body) {
        event.preventDefault();
        setMode((current) => current === "explore" ? "index" : "explore");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeDetail, entered, mode, selectedId]);

  return (
    <div className={`nb-experience ${entered ? "is-entered" : "is-gated"}`}>
      <div className="nb-atmosphere" aria-hidden="true" />
      <NachbilderScene
        fragments={fragments}
        activeId={selectedId || hoveredId}
        reducedMotion={reducedMotion}
        onHover={setHoveredId}
        onSelect={selectFragment}
        onReady={() => setSceneReady(true)}
      />
      <div className={`nb-loading-veil ${sceneReady ? "is-ready" : ""}`} aria-hidden="true">
        <span />
      </div>

      {!entered ? (
        <Threshold count={shownCount} className={className} onEnter={enter} />
      ) : (
        <>
          <header className="nb-header">
            <button type="button" className="nb-wordmark" onClick={() => { setMode("explore"); closeDetail(); }}>
              <span>Nachbilder</span>
              <small>{className}</small>
            </button>
            <nav className="nb-mode-switch" aria-label="Ansicht">
              <button type="button" className={mode === "explore" ? "is-active" : ""} onClick={() => setMode("explore")}>Explore</button>
              <button type="button" className={mode === "index" ? "is-active" : ""} onClick={() => setMode("index")}>Index</button>
            </nav>
            <div className="nb-header-actions">
              <button type="button" className="nb-sound" onClick={muteAudio}>Klang [{soundOn ? "an" : "aus"}]</button>
              <ThemeMenu label="Design" className="nb-design-button" />
            </div>
          </header>

          {mode === "explore" ? (
            <ExploreOverlay hovered={hovered} visited={visited.size} total={fragments.length} />
          ) : (
            <IndexView fragments={filtered} query={query} onQuery={setQuery} onSelect={selectFragment} />
          )}

          <nav className="nb-utility-nav" aria-label="Maturaziitig">
            <Link href="/classes">Klasse</Link>
            <Link href="/bilder">Bilder</Link>
            <Link href="/polls">Umfragen</Link>
            <Link href="/profile">Profil</Link>
          </nav>

          {selected && <MemoryDetail fragment={selected} index={fragments.indexOf(selected) + 1} total={fragments.length} onClose={closeDetail} />}
        </>
      )}
    </div>
  );
}

function Threshold({ count, className, onEnter }: { count: number; className: string; onEnter: (sound: boolean) => void }) {
  return (
    <section className="nb-threshold" aria-labelledby="nb-entry-title">
      <div className="nb-threshold-mark" aria-hidden="true"><span /><span /><span /></div>
      <p className="nb-eyebrow">Archiv · {className}</p>
      <h1 id="nb-entry-title">
        <span>{count} {count === 1 ? "Mensch." : "Menschen."}</span>
        <span>4 Jahre.</span>
        <span>Eine letzte gemeinsame Konstellation.</span>
      </h1>
      <p className="nb-threshold-copy">Wir verlassen denselben Ort. Jede Person nimmt eine andere Version davon mit.</p>
      <div className="nb-entry-actions">
        <HoldEntryButton label="Mit Klang betreten" onComplete={() => onEnter(true)} />
        <HoldEntryButton label="Still betreten" onComplete={() => onEnter(false)} quiet />
      </div>
      <p className="nb-hold-hint" id="nb-entry-hint">Zum Öffnen kurz halten</p>
    </section>
  );
}

function HoldEntryButton({ label, onComplete, quiet = false }: { label: string; onComplete: () => void; quiet?: boolean }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function start() {
    if (timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onComplete();
    }, 680);
  }

  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  }

  useEffect(() => cancel, []);

  return (
    <button
      type="button"
      className={`nb-entry-button ${quiet ? "is-quiet" : ""} ${holding ? "is-holding" : ""}`}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          cancel();
          onComplete();
        }
      }}
      onClick={(event) => { if (event.detail === 0) onComplete(); }}
      aria-describedby="nb-entry-hint"
    >
      <span className="nb-entry-progress" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function ExploreOverlay({ hovered, visited, total }: { hovered: MemoryFragment | null; visited: number; total: number }) {
  return (
    <div className="nb-explore-overlay">
      <div className={`nb-hover-label ${hovered ? "is-visible" : ""}`} aria-live="polite">
        <p>{hovered?.role || "Erinnerungsfragment"}</p>
        <strong>{hovered?.name || ""}</strong>
        {hovered?.text && <span>{hovered.text}</span>}
      </div>
      <div className="nb-explore-guide">
        <span>ziehen · drehen</span>
        <span>scrollen · annähern</span>
        <span>klicken · erinnern</span>
      </div>
      <p className="nb-visited"><span>{String(visited).padStart(2, "0")}</span> / {String(total).padStart(2, "0")} besucht</p>
    </div>
  );
}

function IndexView({ fragments, query, onQuery, onSelect }: { fragments: MemoryFragment[]; query: string; onQuery: (value: string) => void; onSelect: (id: string) => void }) {
  return (
    <section className="nb-index" aria-labelledby="nb-index-title">
      <div className="nb-index-head">
        <div>
          <p>Alle Fragmente</p>
          <h2 id="nb-index-title">Das Archiv</h2>
        </div>
        <label className="nb-search">
          <span>Suchen</span>
          <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Name, Satz oder Rolle" />
        </label>
      </div>
      <div className="nb-index-list">
        {fragments.map((fragment, index) => (
          <button key={fragment.id} type="button" className="nb-index-item" onClick={() => onSelect(fragment.id)}>
            <span className="nb-index-number">{String(index + 1).padStart(2, "0")}</span>
            <span className="nb-index-portrait" style={{ "--nb-accent": fragment.accentColor } as React.CSSProperties}>
              {fragment.avatarUrl ? <img src={fragment.avatarUrl} alt="" loading="lazy" decoding="async" /> : fragment.name.slice(0, 1)}
            </span>
            <span className="nb-index-copy">
              <strong>{fragment.name}</strong>
              <small>{fragment.role}</small>
            </span>
            <span className="nb-index-arrow" aria-hidden="true">↗</span>
          </button>
        ))}
        {fragments.length === 0 && <p className="nb-index-empty">Kein Fragment passt zu dieser Suche.</p>}
      </div>
    </section>
  );
}

function MemoryDetail({ fragment, index, total, onClose }: { fragment: MemoryFragment; index: number; total: number; onClose: () => void }) {
  return (
    <section className="nb-detail" aria-modal="true" role="dialog" aria-labelledby="nb-detail-name">
      <button type="button" className="nb-detail-backdrop" onClick={onClose} aria-label="Schliessen" />
      <div className="nb-detail-panel">
        <button type="button" className="nb-detail-close" onClick={onClose} aria-label="Schliessen">×</button>
        <div className="nb-detail-media" style={{ "--nb-accent": fragment.accentColor } as React.CSSProperties}>
          {fragment.imageUrl ? <img src={fragment.imageUrl} alt={`Erinnerung von ${fragment.name}`} /> : <span>{fragment.name.slice(0, 1)}</span>}
          <i aria-hidden="true" />
        </div>
        <div className="nb-detail-copy">
          <div className="nb-detail-meta"><span>{fragment.role}</span><span>{String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}</span></div>
          <h2 id="nb-detail-name">{fragment.name}</h2>
          <p className="nb-detail-class">{fragment.className}</p>
          <blockquote>{fragment.text || "Noch keine Worte. Das Fragment bleibt offen für das, was dazukommt."}</blockquote>
          <div className="nb-detail-footer">
            <span>{fragment.postCount} {fragment.postCount === 1 ? "Spur" : "Spuren"}</span>
            <Link href={fragment.href}>Profil öffnen <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
