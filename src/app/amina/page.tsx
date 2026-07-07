"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Avatar } from "@/components/Nav";
import type { Post } from "@/components/PostCard";
import { playBabySound } from "@/lib/babySound";
import { clearApiCache } from "@/lib/swr";
import { uploadImageFile } from "@/lib/uploadImage";

type Target = {
  id: string;
  type: "student" | "teacher";
  name: string;
  detail: string;
  avatarUrl: string | null;
  accentColor?: string | null;
};

type AminaData = {
  user: { id: string; name: string };
  class: { id: string; name: string } | null;
  targets: Target[];
  posts: Post[];
  readOnly: boolean;
};

type Kind = "QUOTE" | "IMAGE" | "TEXT";

export default function AminaModePage() {
  const router = useRouter();
  const search = useSearchParams();
  const previewClassId = search.get("previewClassId");
  const [data, setData] = useState<AminaData | null>(null);
  const [selected, setSelected] = useState<Target | null>(null);
  const [creating, setCreating] = useState(false);
  const [kind, setKind] = useState<Kind>("QUOTE");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mascotLine, setMascotLine] = useState("SUCH DIR EINEN MENSCHEN AUS!");
  const [adultUnlocked, setAdultUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    const endpoint = previewClassId
      ? `/api/amina?previewClassId=${encodeURIComponent(previewClassId)}`
      : "/api/amina";
    fetch(endpoint, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          router.replace(previewClassId ? "/archivzugang" : "/login");
          return null;
        }
        if (res.status === 403) {
          router.replace("/");
          return null;
        }
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error || "OH NEIN! ES GING NICHT!");
        return body as AminaData;
      })
      .then((body) => {
        if (active && body) setData(body);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "OH NEIN!");
      });
    return () => {
      active = false;
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
    };
  }, [previewClassId, router]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const shownPosts = useMemo(() => {
    if (!selected || !data) return [];
    return data.posts.filter((post) =>
      selected.type === "student" ? post.subject?.id === selected.id : post.teacher?.id === selected.id,
    );
  }, [data, selected]);

  function sound(tone: "tap" | "back" | "success" | "sparkle" = "tap") {
    playBabySound(tone);
  }

  function startAdultUnlock() {
    if (data?.readOnly || adultUnlocked) return;
    setUnlocking(true);
    unlockTimer.current = setTimeout(() => {
      setAdultUnlocked(true);
      setUnlocking(false);
      sound("success");
    }, 3000);
  }

  function cancelAdultUnlock() {
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    unlockTimer.current = null;
    setUnlocking(false);
  }

  function chooseTarget(target: Target) {
    sound("tap");
    setSelected(target);
    setMascotLine(`${target.name.toLocaleUpperCase("de-CH")}! JAAAA!`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    sound("back");
    setSelected(null);
    setCreating(false);
    setMascotLine("SUCH DIR EINEN MENSCHEN AUS!");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openCreate() {
    sound("sparkle");
    setCreating(true);
    setError("");
  }

  function chooseKind(next: Kind) {
    sound("tap");
    if (next !== kind) {
      setText("");
      setFile(null);
      setPreview("");
    }
    setKind(next);
    setError("");
  }

  function pickFile(next: File | null) {
    sound("sparkle");
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !data?.class) return;
    setBusy(true);
    setError("");
    try {
      let imageUrl: string | null = null;
      if (kind === "IMAGE") {
        if (!file) throw new Error("DU MUSST NOCH EIN BILD AUSWÄHLEN!");
        imageUrl = await uploadImageFile(file);
      } else if (!text.trim()) {
        throw new Error("DU MUSST NOCH ETWAS SCHREIBEN!");
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: data.class.id,
          subjectMembershipId: selected.type === "student" ? selected.id : undefined,
          teacherId: selected.type === "teacher" ? selected.id : undefined,
          kind,
          text: text.trim() || null,
          imageUrl,
          anonymous: false,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "SPEICHERN GING NICHT!");

      setData((current) => current ? { ...current, posts: [body.post, ...current.posts] } : current);
      setText("");
      setFile(null);
      setPreview("");
      setCreating(false);
      setMascotLine("JAAAA! DAS HAST DU SUPER GEMACHT!");
      sound("success");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "OH NEIN!");
      sound("back");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    sound("back");
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    clearApiCache();
    router.replace("/login");
    router.refresh();
  }

  if (!data && !error) return <AminaLoading />;

  return (
    <div className="amina-mode fixed inset-0 z-40 overflow-y-auto">
      <header className="amina-topbar">
        <button
          type="button"
          className="amina-logo"
          onClick={() => {
            sound("sparkle");
            setMascotLine("BUBU HAT DICH GANZ FEST LIEB!");
          }}
          aria-label="Bubu drücken"
        >
          <Image src="/amina-mascot.png" width={72} height={72} alt="Bubu, das Amina-Maskottchen" priority />
          <span>AMINA-MODUS</span>
        </button>
        <div className="amina-top-actions">
          {data?.readOnly ? (
            <button type="button" className="amina-mini-button" onClick={() => window.close()}>
              VORSCHAU SCHLIESSEN
            </button>
          ) : (
            <button
              type="button"
              className={`amina-parent-lock ${unlocking ? "is-unlocking" : ""}`}
              onPointerDown={startAdultUnlock}
              onPointerUp={cancelAdultUnlock}
              onPointerLeave={cancelAdultUnlock}
              onPointerCancel={cancelAdultUnlock}
              aria-label="Erwachsenenbereich durch langes Drücken öffnen"
            >
              3 SEK. HALTEN
            </button>
          )}
        </div>
      </header>

      <main className="amina-stage">
        <section className="amina-mascot-row">
          <button
            type="button"
            className="amina-mascot-button"
            onClick={() => {
              sound("sparkle");
              setMascotLine("BUBU MACHT BEEP BEEP BEEP!");
            }}
            aria-label="Bubu spielen lassen"
          >
            <Image src="/amina-mascot.png" width={230} height={230} alt="Bubu" priority />
          </button>
          <div className="amina-speech" role="status">{mascotLine}</div>
        </section>

        {error ? <div className="amina-error">{error}</div> : null}

        {!data?.class ? (
          <section className="amina-empty">
            <h1>DU HAST NOCH KEINE KLASSE!</h1>
            <p>BITTE FRAG EINE GROSSE PERSON.</p>
          </section>
        ) : selected ? (
          <PersonScreen
            target={selected}
            posts={shownPosts}
            onBack={goBack}
            onCreate={openCreate}
            sound={sound}
            canCreate={!data.readOnly}
          />
        ) : (
          <PeopleScreen targets={data.targets} className={data.class.name} onChoose={chooseTarget} />
        )}
      </main>

      {creating && selected && data?.class && !data.readOnly ? (
        <CreateScreen
          target={selected}
          kind={kind}
          text={text}
          preview={preview}
          busy={busy}
          error={error}
          onKind={chooseKind}
          onText={setText}
          onFile={pickFile}
          onClose={() => {
            sound("back");
            setCreating(false);
            setError("");
          }}
          onSubmit={submit}
          sound={sound}
        />
      ) : null}

      {adultUnlocked && !data?.readOnly ? (
        <div className="amina-adult-layer" role="dialog" aria-modal="true" aria-label="Erwachsenenbereich">
          <div className="amina-adult-box">
            <p className="amina-kicker">FÜR ERWACHSENE</p>
            <h2>WIRKLICH ABMELDEN?</h2>
            <div className="amina-adult-actions">
              <button type="button" className="amina-mini-button" onClick={() => setAdultUnlocked(false)}>ZURÜCK</button>
              <button type="button" className="amina-mini-button" onClick={logout}>ABMELDEN</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AminaLoading() {
  return (
    <div className="amina-mode fixed inset-0 z-40 grid place-items-center">
      <div className="amina-loading">
        <Image src="/amina-mascot.png" width={230} height={230} alt="Bubu lädt" priority />
        <p>BUBU HOLT DEINE SACHEN!</p>
      </div>
    </div>
  );
}

function PeopleScreen({ targets, className, onChoose }: { targets: Target[]; className: string; onChoose: (target: Target) => void }) {
  return (
    <section className="amina-screen">
      <p className="amina-kicker">DEINE KLASSE: {className}</p>
      <h1>WEN WILLST DU ANSCHAUEN?</h1>
      <div className="amina-people-grid">
        {targets.map((target, index) => (
          <button
            type="button"
            key={`${target.type}-${target.id}`}
            className={`amina-person-button color-${index % 4}`}
            onClick={() => onChoose(target)}
          >
            <Avatar name={target.name} url={target.avatarUrl} accent={target.accentColor} size={92} />
            <span className="amina-person-name">{target.name}</span>
            <span className="amina-person-detail">{target.detail}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function PersonScreen({
  target,
  posts,
  onBack,
  onCreate,
  sound,
  canCreate,
}: {
  target: Target;
  posts: Post[];
  onBack: () => void;
  onCreate: () => void;
  sound: (tone?: "tap" | "back" | "success" | "sparkle") => void;
  canCreate: boolean;
}) {
  return (
    <section className="amina-screen">
      <div className="amina-person-hero">
        <button type="button" className="amina-back-button" onClick={onBack} aria-label="Zurück">←</button>
        <Avatar name={target.name} url={target.avatarUrl} accent={target.accentColor} size={132} />
        <div>
          <p className="amina-kicker">DAS IST</p>
          <h1>{target.name}</h1>
          <p className="amina-count">{posts.length} SACHEN</p>
        </div>
        {canCreate ? <button type="button" className="amina-add-button" onClick={onCreate}>NEUES DINGS!</button> : null}
      </div>

      {posts.length ? (
        <div className="amina-post-grid">
          {posts.map((post) => (
            <article key={post.id} className={`amina-post kind-${post.kind.toLocaleLowerCase("de-CH")}`}>
              <p className="amina-post-kind">{post.kind === "QUOTE" ? "ZITAT" : post.kind === "IMAGE" ? "BILD" : "POST-IT"}</p>
              {post.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.imageUrl} alt="Klassenbild" loading="lazy" />
              ) : null}
              {post.text ? (
                <p className={post.kind === "QUOTE" ? "amina-quote" : "amina-note"}>
                  {post.kind === "QUOTE" ? `„${post.text}“` : post.text}
                </p>
              ) : null}
              <button type="button" className="amina-post-sound" onClick={() => sound("tap")} aria-label="Boing abspielen">BOING!</button>
            </article>
          ))}
        </div>
      ) : (
        <div className="amina-empty">
          <h2>HIER IST NOCH NICHTS!</h2>
          {canCreate ? <button type="button" className="amina-add-button" onClick={onCreate}>MACH DAS ERSTE DINGS!</button> : null}
        </div>
      )}
    </section>
  );
}

function CreateScreen({
  target,
  kind,
  text,
  preview,
  busy,
  error,
  onKind,
  onText,
  onFile,
  onClose,
  onSubmit,
  sound,
}: {
  target: Target;
  kind: Kind;
  text: string;
  preview: string;
  busy: boolean;
  error: string;
  onKind: (kind: Kind) => void;
  onText: (text: string) => void;
  onFile: (file: File | null) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  sound: (tone?: "tap" | "back" | "success" | "sparkle") => void;
}) {
  return (
    <div className="amina-create-layer" role="dialog" aria-modal="true" aria-label="Neues Dings machen">
      <form className="amina-create-box" onSubmit={onSubmit}>
        <button type="button" className="amina-back-button" onClick={onClose} aria-label="Schliessen">←</button>
        <Image src="/amina-mascot.png" width={120} height={120} alt="Bubu hilft" />
        <p className="amina-kicker">FÜR {target.name.toLocaleUpperCase("de-CH")}</p>
        <h2>WAS MACHEN WIR?</h2>

        <div className="amina-kind-row">
          <button type="button" className={kind === "QUOTE" ? "is-picked" : ""} onClick={() => onKind("QUOTE")}>ZITAT</button>
          <button type="button" className={kind === "IMAGE" ? "is-picked" : ""} onClick={() => onKind("IMAGE")}>BILD</button>
          <button type="button" className={kind === "TEXT" ? "is-picked" : ""} onClick={() => onKind("TEXT")}>POST-IT</button>
        </div>

        {kind === "IMAGE" ? (
          <label className="amina-file-button" onClick={() => sound("sparkle")}>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Ausgewähltes Bild" />
            ) : (
              <span>BILD AUSSUCHEN!</span>
            )}
            <input type="file" accept="image/*" onChange={(event) => onFile(event.target.files?.[0] ?? null)} />
          </label>
        ) : (
          <textarea
            className="amina-big-input"
            value={text}
            onChange={(event) => onText(event.target.value)}
            placeholder={kind === "QUOTE" ? "HIER DAS ZITAT REINSCHREIBEN" : "HIER DIE NOTIZ REINSCHREIBEN"}
            maxLength={1000}
            autoFocus
          />
        )}

        {error ? <p className="amina-error">{error}</p> : null}
        <button type="submit" className="amina-finish-button" disabled={busy} onClick={() => sound("tap")}>
          {busy ? "BUBU ARBEITET..." : "FERTIG!"}
        </button>
      </form>
    </div>
  );
}
