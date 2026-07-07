"use client";

import Link from "next/link";
import { useState } from "react";

type SettingsMember = {
  id: string;
  role: string;
  memberType: string;
  aminaMode: boolean;
  leftAt: string | null;
  user: { name: string };
};

type SettingsClass = {
  id: string;
  name: string;
  description?: string | null;
  school?: string | null;
  gradYear?: string | null;
  joinCode: string;
  archivedAt?: string | null;
};

export function AdminClassSettings({
  klass,
  members,
  onChanged,
}: {
  klass: SettingsClass;
  members: SettingsMember[];
  onChanged: () => Promise<void> | void;
}) {
  const [name, setName] = useState(klass.name);
  const [description, setDescription] = useState(klass.description || "");
  const [school, setSchool] = useState(klass.school || "");
  const [gradYear, setGradYear] = useState(klass.gradYear || "");
  const [accountName, setAccountName] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const active = members.filter((member) => !member.leftAt);
  const inactive = members.filter((member) => member.leftAt);

  async function request(url: string, init: RequestInit) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(url, init);
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Änderung fehlgeschlagen.");
      return body;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Änderung fehlgeschlagen.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const result = await request(`/api/admin/classes/${klass.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, school, gradYear }),
    });
    if (result) {
      setMessage("Klassendaten gespeichert.");
      await onChanged();
    }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    const result = await request(`/api/admin/classes/${klass.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: accountName }),
    });
    if (result) {
      setAccountName("");
      setMessage(result.restored ? "Person wiederhergestellt." : "Person hinzugefügt.");
      await onChanged();
    }
  }

  async function updateMember(memberId: string, body: Record<string, unknown>) {
    const result = await request(`/api/admin/classes/${klass.id}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (result) await onChanged();
  }

  async function removeMember(member: SettingsMember) {
    if (!confirm(`${member.user.name} deaktivieren? Alle bisherigen Inhalte bleiben erhalten.`)) return;
    const result = await request(`/api/admin/classes/${klass.id}/members/${member.id}`, { method: "DELETE" });
    if (result) {
      setMessage("Person deaktiviert und weiterhin wiederherstellbar.");
      await onChanged();
    }
  }

  async function rotateCode() {
    if (!confirm("Einladungscode wirklich erneuern?")) return;
    const result = await request(`/api/admin/classes/${klass.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regenerateJoinCode: true }),
    });
    if (result) {
      setMessage("Einladungscode erneuert.");
      await onChanged();
    }
  }

  async function changeArchiveState() {
    const result = await request(`/api/admin/classes/${klass.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        klass.archivedAt
          ? { action: "restore" }
          : { action: "archive", confirmation },
      ),
    });
    if (result) {
      setConfirmation("");
      setMessage(klass.archivedAt ? "Klasse wiederhergestellt." : "Klasse sicher archiviert.");
      await onChanged();
    }
  }

  return (
    <section className="glass-panel space-y-7 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-full"><p className="section-label">Kontrollbereich</p><h2 className="display max-w-full break-words text-2xl leading-tight sm:text-4xl">Klasseneinstellungen</h2></div>
        <Link href={`/amina?previewClassId=${klass.id}`} target="_blank" rel="noreferrer" className="btn-accent max-w-full">
          Amina-Modus testen ↗
        </Link>
      </div>
      {error ? <p className="rounded-[18px] bg-coral/15 p-3 text-sm font-black text-coral">{error}</p> : null}
      {message ? <p className="rounded-[18px] bg-white/25 p-3 text-sm font-black">{message}</p> : null}

      <form onSubmit={save} className="space-y-3 border-b border-white/35 pb-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="label">Name</span><input className="input" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} /></label>
          <label><span className="label">Schule</span><input className="input" value={school} onChange={(event) => setSchool(event.target.value)} maxLength={100} /></label>
          <label><span className="label">Abschlussjahr</span><input className="input" value={gradYear} onChange={(event) => setGradYear(event.target.value)} maxLength={100} /></label>
          <label className="sm:col-span-2"><span className="label">Beschreibung</span><textarea className="input min-h-24 resize-y" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} /></label>
        </div>
        <button className="btn-primary" disabled={busy}>Speichern</button>
      </form>

      <section className="space-y-3 border-b border-white/35 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="section-label">Zugang</p><h3 className="display text-3xl">Personen hinzufügen</h3></div>
          <span className="font-mono text-2xl font-black tracking-widest">{klass.joinCode}</span>
        </div>
        {!klass.archivedAt ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <form onSubmit={addMember} className="flex flex-1 gap-2">
              <input className="input" value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Genauer Kontoname" required minLength={2} />
              <button className="btn-accent shrink-0" disabled={busy}>Hinzufügen</button>
            </form>
            <button type="button" className="btn-soft" onClick={rotateCode} disabled={busy}>Code erneuern</button>
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <div><p className="section-label">Aktiv</p><h3 className="display text-3xl">{active.length} Personen</h3></div>
        <div className="divide-y divide-white/30">
          {active.map((member) => (
            <div key={member.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1"><p className="truncate font-black">{member.user.name}</p><p className="text-xs font-bold text-ink/45">{member.role}</p></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`chip ${member.aminaMode ? "!border-hotpink/40 !bg-hotpink/25" : ""}`} onClick={() => updateMember(member.id, { aminaMode: !member.aminaMode })} disabled={busy}>Amina {member.aminaMode ? "an" : "aus"}</button>
                {member.role !== "OWNER" ? (
                  <>
                  <button type="button" className="chip" onClick={() => updateMember(member.id, { role: member.role === "MODERATOR" ? "MEMBER" : "MODERATOR" })} disabled={busy}>{member.role === "MODERATOR" ? "Mod entfernen" : "Zu Mod"}</button>
                  <button type="button" className="chip !text-coral" onClick={() => removeMember(member)} disabled={busy}>Entfernen</button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {inactive.length ? (
        <section className="space-y-2 border-t border-white/35 pt-6">
          <div><p className="section-label">Gesichert</p><h3 className="display text-3xl">Entfernte Personen</h3></div>
          {inactive.map((member) => (
            <div key={member.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 truncate font-black">{member.user.name}</span>
              <button type="button" className="btn-soft !px-3 !py-2" onClick={() => updateMember(member.id, { restore: true })} disabled={busy || Boolean(klass.archivedAt)}>Wiederherstellen</button>
            </div>
          ))}
        </section>
      ) : null}

      <section className="space-y-3 border-t border-coral/25 pt-6">
        <div><p className="section-label !text-coral">Datenschutz</p><h3 className="display text-3xl">{klass.archivedAt ? "Klasse wiederherstellen" : "Klasse archivieren"}</h3></div>
        {!klass.archivedAt ? <input className="input" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={`Zur Bestätigung „${klass.name}“ eingeben`} /> : null}
        <button type="button" className="btn-soft !text-coral" onClick={changeArchiveState} disabled={busy || (!klass.archivedAt && confirmation !== klass.name)}>
          {klass.archivedAt ? "Klasse wiederherstellen" : "Sicher archivieren"}
        </button>
      </section>
    </section>
  );
}
