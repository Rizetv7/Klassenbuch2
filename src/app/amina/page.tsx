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
  isOwner: boolean;
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
  const [exitHolding, setExitHolding] = useState(false);
  const [exitBusy, setExitBusy] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    };
  }, [previewClassId, router]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, []);

  const shownPosts = useMemo(() => {
    if (!selected || !data) return [];
    return data.posts.filter((post) =>
      selected.type === "student" ? post.subject?.id === selected.id : post.teacher?.id === selected.id,
    );
  }, [data, selected]);

  function sound(tone: "tap" | "back" | "success" | "sparkle" = "tap") {
    playBabySound(tone);
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

  async function deletePost(postId: string) {
    if (!window.confirm("DIESES DINGS WIRKLICH WEGWERFEN?")) return;
    sound("back");
    const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error || "WEGWERFEN GING NICHT!");
      return;
    }
    setData((current) => current ? { ...current, posts: current.posts.filter((post) => post.id !== postId) } : current);
    setMascotLine("WEG IST WEG! BUBU HAT AUFGERÄUMT!");
    sound("success");
  }

  function startExitHold() {
    if (data?.readOnly || exitBusy || exitTimer.current) return;
    setExitHolding(true);
    exitTimer.current = setTimeout(() => {
      exitTimer.current = null;
      void leaveAminaMode();
    }, 3000);
  }

  function cancelExitHold() {
    if (exitTimer.current) clearTimeout(exitTimer.current);
    exitTimer.current = null;
    setExitHolding(false);
  }

  async function leaveAminaMode() {
    setExitHolding(false);
    setExitBusy(true);
    const res = await fetch("/api/profile/amina", { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setError(body?.error || "DER AUSGANG KLEMMT. NOCHMAL VERSUCHEN!");
      setExitBusy(false);
      sound("back");
      return;
    }
    clearApiCache();
    sound("success");
    router.replace("/");
    router.refresh();
  }

  function adminExit() {
    if (!data?.isOwner || exitBusy) return;
    const confirmed = window.confirm(
      "Amina-Modus verlassen und sicher zur Klassenleitung zurückkehren? Deine Admin-Rolle bleibt unverändert.",
    );
    if (confirmed) void leaveAminaMode();
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
        {data?.readOnly ? (
          <div className="amina-top-actions">
            <button type="button" className="amina-mini-button" onClick={() => window.close()}>
              VORSCHAU SCHLIESSEN
            </button>
          </div>
        ) : data?.isOwner ? (
          <div className="amina-top-actions">
            <button type="button" className="amina-admin-exit" onClick={adminExit} disabled={exitBusy}>
              <span>KLASSENLEITUNG</span>
              <strong>{exitBusy ? "WIRD GEÖFFNET …" : "SICHER ZURÜCK"}</strong>
            </button>
          </div>
        ) : null}
      </header>

      <main className="amina-stage">
        <section className="amina-birth-sign" aria-label="Amina-Modus, geboren 2025 am 6. Juli">
          <Image src="/amina-guides/geboren-schild.webp" width={960} height={720} alt="Geboren 2025, am 6.7." priority />
        </section>

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

        <AminaGuide sound={sound} onExplain={setMascotLine} />

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
            onDelete={deletePost}
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

      {data && !data.readOnly ? (
        <button
          type="button"
          className={`amina-secret-exit ${exitHolding ? "is-holding" : ""}`}
          onPointerDown={startExitHold}
          onPointerUp={cancelExitHold}
          onPointerLeave={cancelExitHold}
          onPointerCancel={cancelExitHold}
          disabled={exitBusy}
          aria-label="Amina-Modus verlassen: drei Sekunden gedrückt halten"
          title="3 Sekunden halten"
        >
          <span aria-hidden="true">✦</span>
          <small>{exitBusy ? "…" : "3s"}</small>
        </button>
      ) : null}

    </div>
  );
}

const AMINA_GUIDES = [
  { image: "/amina-guides/bubu-button.webp", title: "1. KNOPF DRÜCKEN", text: "EINMAL DRAUF. NICHT ZEHNMAL. BUBU PASST AUF!", line: "DRÜCK EINEN KNOPF GENAU EINMAL! GANZ MUTIG!" },
  { image: "/amina-guides/bubu-add.webp", title: "2. PLUS MACHT NEU", text: "DER GELBE KNOPF MACHT EIN NEUES DINGS.", line: "DER GROSSE GELBE KNOPF MACHT ETWAS NEUES!" },
  { image: "/amina-guides/bubu-quote.webp", title: "3. ZITAT IST GESAGT", text: "SCHREIB REIN, WAS JEMAND GESAGT HAT.", line: "EIN ZITAT IST ETWAS, DAS JEMAND GESAGT HAT!" },
  { image: "/amina-guides/bubu-photo.webp", title: "4. BILD IST FOTO", text: "DRÜCK AUFS FOTO. DANN WIRD ES GROSS.", line: "AUF EIN BILD KANN MAN DRAUFDRÜCKEN!" },
  { image: "/amina-guides/bubu-finish.webp", title: "5. FERTIG HEISST FERTIG", text: "AM ENDE DRÜCKST DU DEN RIESEN FERTIG-KNOPF.", line: "FERTIG DRÜCKEN. DANN FEIERT BUBU!" },
] as const;

function AminaGuide({
  sound,
  onExplain,
}: {
  sound: (tone?: "tap" | "back" | "success" | "sparkle") => void;
  onExplain: (line: string) => void;
}) {
  return (
    <section className="amina-guide" aria-label="Bubu erklärt alles">
      <div className="amina-guide-heading">
        <p className="amina-kicker">BUBUS SUPEREINFACHE ANLEITUNG</p>
        <h2>SO GEHT DRÜCKEN!</h2>
      </div>
      <div className="amina-guide-track">
        {AMINA_GUIDES.map((guide) => (
          <button
            type="button"
            className="amina-guide-card"
            key={guide.image}
            onClick={() => {
              sound("sparkle");
              onExplain(guide.line);
            }}
          >
            <Image src={guide.image} width={640} height={640} alt="" />
            <span className="amina-guide-copy">
              <strong>{guide.title}</strong>
              <small>{guide.text}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
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
      <GuideNudge image="/amina-guides/bubu-button.webp" text="DRÜCK AUF EIN GESICHT. DANN KOMMT DIE PERSON!" />
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
  onDelete,
  sound,
  canCreate,
}: {
  target: Target;
  posts: Post[];
  onBack: () => void;
  onCreate: () => void;
  onDelete: (postId: string) => void;
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

      {canCreate ? <GuideNudge image="/amina-guides/bubu-add.webp" text="DER GELBE KNOPF MACHT HIER EIN NEUES DINGS!" /> : null}

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
              {post.deletableByMe ? (
                <button type="button" className="amina-post-delete" onClick={() => onDelete(post.id)}>
                  MEIN DINGS WEGWERFEN
                </button>
              ) : null}
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
        <Image
          src={kind === "IMAGE" ? "/amina-guides/bubu-photo.webp" : kind === "QUOTE" ? "/amina-guides/bubu-quote.webp" : "/amina-guides/bubu-add.webp"}
          width={640}
          height={640}
          alt="Bubu erklärt die Auswahl"
        />
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

function GuideNudge({ image, text }: { image: string; text: string }) {
  return (
    <div className="amina-nudge">
      <Image src={image} width={640} height={640} alt="" />
      <p>{text}</p>
    </div>
  );
}
