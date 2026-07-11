"use client";

import { useState } from "react";
import { Avatar } from "./Nav";
import { formatAdminDate, type AdminPerson } from "./AdminConsole";

type ImportPost = {
  id: string;
  kind: string;
  text?: string | null;
  context?: string | null;
  imageUrl?: string | null;
  anonymous: boolean;
  createdAt: string;
  author: AdminPerson;
  subject?: { id: string; displayName: string; user: AdminPerson } | null;
  teacher?: AdminPerson | null;
};

type PendingImport = {
  id: string;
  rawName: string;
  targetType: string;
  kind: string;
  text?: string | null;
  context?: string | null;
  imageUrl?: string | null;
  createdAt: string;
};

export type AdminImportBatch = {
  id: string;
  sourceType: string;
  sourceText?: string | null;
  itemCount: number;
  anonymizedAt?: string | null;
  createdAt: string;
  creator: AdminPerson;
  posts: ImportPost[];
  pendingItems: PendingImport[];
  matchedCount: number;
  pendingCount: number;
  removedCount: number;
  anonymousCount: number;
  allAnonymous: boolean;
  kinds: { quotes: number; notes: number; images: number };
};

function kindLabel(kind: string) {
  if (kind === "IMAGE") return "Bild";
  if (kind === "TEXT") return "Notiz";
  return "Zitat";
}

export function AdminImportBatches({
  classId,
  batches,
  onChanged,
}: {
  classId: string;
  batches: AdminImportBatch[];
  onChanged: () => Promise<void> | void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function anonymize(batch: AdminImportBatch) {
    if (busy || confirmation !== "ANONYM") return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/classes/${classId}/imports/${batch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "anonymize", confirmation }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error || "Import konnte nicht anonymisiert werden.");
        return;
      }
      setMessage(
        `${body.changedPosts} bestehende Beiträge anonymisiert. ${body.pendingItems || 0} offene Einträge bleiben auch nach der Zuordnung anonym.`,
      );
      setConfirmId(null);
      setConfirmation("");
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  if (batches.length === 0) {
    return (
      <div className="admin-empty">
        <strong>Noch keine nachvollziehbaren Importe</strong>
        <span>Künftige Einfügungen werden automatisch als zusammengehöriger Vorgang gespeichert.</span>
      </div>
    );
  }

  return (
    <div className="admin-import-list">
      {error ? <p className="admin-alert is-error">{error}</p> : null}
      {message ? <p className="admin-alert is-success">{message}</p> : null}
      {batches.map((batch, index) => {
        const accounted = batch.matchedCount + batch.pendingCount;
        const progress = batch.itemCount > 0 ? Math.min(100, Math.round((accounted / batch.itemCount) * 100)) : 0;
        return (
          <article key={batch.id} className="admin-import-batch">
            <header className="admin-import-head">
              <div className="admin-import-index">{String(batches.length - index).padStart(2, "0")}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3>Import vom {formatAdminDate(batch.createdAt)}</h3>
                  {batch.sourceType === "LEGACY_DETECTED" ? <span className="admin-badge">Alt-Import erkannt</span> : null}
                  {batch.allAnonymous ? <span className="admin-badge is-private">Vollständig anonym</span> : null}
                </div>
                <div className="admin-person-line">
                  <Avatar name={batch.creator.name} url={batch.creator.avatarUrl} accent={batch.creator.accentColor} size={24} ring={false} />
                  <span>Importiert von <strong>{batch.creator.name}</strong></span>
                </div>
              </div>
              <div className="admin-import-total">
                <strong>{batch.itemCount}</strong>
                <span>Einträge</span>
              </div>
            </header>

            <div className="admin-import-metrics">
              <span><strong>{batch.matchedCount}</strong> zugeordnet</span>
              <span><strong>{batch.pendingCount}</strong> offen</span>
              <span><strong>{batch.kinds.quotes}</strong> Zitate</span>
              <span><strong>{batch.kinds.notes}</strong> Notizen</span>
              <span><strong>{batch.kinds.images}</strong> Bilder</span>
              {batch.removedCount > 0 ? <span><strong>{batch.removedCount}</strong> gelöscht</span> : null}
            </div>
            <div className="admin-progress" aria-label={`${progress} Prozent des Imports vorhanden`}>
              <span style={{ width: `${progress}%` }} />
            </div>

            <details className="admin-import-details">
              <summary>Gesamten Import und Zuordnungen ansehen</summary>
              {batch.sourceText ? (
                <div className="admin-source-block">
                  <p>Ursprünglich eingefügter Text</p>
                  <pre>{batch.sourceText}</pre>
                </div>
              ) : (
                <p className="admin-muted-copy">
                  Dieser Import entstand vor der Import-Historie. Der Originaltext wurde damals nicht gespeichert; alle eindeutig erkannten Einträge stehen unten.
                </p>
              )}

              <div className="admin-import-rows">
                {batch.posts.map((post) => {
                  const target = post.subject?.user.name || post.subject?.displayName || post.teacher?.name || "Klasse";
                  return (
                    <div key={post.id} className="admin-import-row">
                      <span className="admin-import-kind">{kindLabel(post.kind)}</span>
                      <div>
                        <strong>{target}</strong>
                        <p>{post.text || post.context || (post.imageUrl ? "Bilddatei" : "Ohne Text")}</p>
                      </div>
                      <span className={post.anonymous ? "is-private" : ""}>{post.anonymous ? "Anonym" : post.author.name}</span>
                    </div>
                  );
                })}
                {batch.pendingItems.map((item) => (
                  <div key={item.id} className="admin-import-row is-pending">
                    <span className="admin-import-kind">{kindLabel(item.kind)}</span>
                    <div>
                      <strong>{item.rawName}</strong>
                      <p>{item.text || item.context || (item.imageUrl ? "Bilddatei" : "Ohne Text")}</p>
                    </div>
                    <span>Noch offen</span>
                  </div>
                ))}
              </div>
            </details>

            {!batch.allAnonymous ? (
              confirmId === batch.id ? (
                <div className="admin-confirm-box">
                  <div>
                    <strong>Alle {batch.itemCount} Import-Einträge anonymisieren?</strong>
                    <p>Bestehende Beiträge und erst später zugeordnete Einträge zeigen danach keinen Urheber mehr. Intern bleibt die Herkunft für Admins erhalten.</p>
                  </div>
                  <label>
                    <span>Zur Bestätigung ANONYM eingeben</span>
                    <input value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} autoFocus />
                  </label>
                  <div className="admin-confirm-actions">
                    <button type="button" className="admin-button is-danger" onClick={() => anonymize(batch)} disabled={busy || confirmation !== "ANONYM"}>
                      {busy ? "Anonymisiert..." : "Gesamten Import anonymisieren"}
                    </button>
                    <button type="button" className="admin-button is-quiet" onClick={() => { setConfirmId(null); setConfirmation(""); setError(""); }} disabled={busy}>
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="admin-button is-danger-outline" onClick={() => { setConfirmId(batch.id); setConfirmation(""); setMessage(""); }}>
                  Gesamten Import anonymisieren
                </button>
              )
            ) : (
              <p className="admin-import-private-note">
                Seit {formatAdminDate(batch.anonymizedAt || batch.createdAt)} anonym. Noch offene Einträge werden beim späteren Zuordnen automatisch anonym veröffentlicht.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
