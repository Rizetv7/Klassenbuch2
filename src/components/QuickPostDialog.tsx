"use client";

import { useEffect, useMemo, useState } from "react";
import { CreatePost } from "./CreatePost";
import { Avatar } from "./Nav";
import { IconClose } from "./Icons";
import { swrJson } from "@/lib/swr";

type ClassSummary = { id: string; name: string };
type Member = {
  id: string;
  displayName: string;
  memberType: string;
  avatarUrl: string | null;
  accentColor: string | null;
};
type Teacher = {
  id: string;
  name: string;
  subject: string | null;
  avatarUrl: string | null;
  accentColor: string | null;
};
type ClassDetail = { id: string; name: string; myMembershipId: string; members: Member[] };
type Target = {
  id: string;
  kind: "member" | "teacher";
  name: string;
  detail: string;
  avatarUrl: string | null;
  accentColor: string | null;
};

export function QuickPostDialog({ onClose }: { onClose: () => void }) {
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [classId, setClassId] = useState("");
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return swrJson<{ classes?: ClassSummary[]; error?: string }>("/api/classes", (data, meta) => {
      if (data?.classes) {
        setClasses(data.classes);
        setClassId((current) => current || data.classes?.[0]?.id || "");
        return;
      }
      if (!meta.fromCache) {
        setClasses([]);
        setError(data?.error || "Deine Klasse konnte nicht geladen werden.");
      }
    });
  }, []);

  useEffect(() => {
    if (!classId) return;
    setDetail(null);
    setTeachers([]);
    setTarget(null);
    setPickerOpen(false);
    setSearch("");
    const stopDetail = swrJson<ClassDetail>(`/api/classes/${classId}`, (data, meta) => {
      if (data) setDetail(data);
      else if (!meta.fromCache) setError("Die Personen dieser Klasse konnten nicht geladen werden.");
    });
    const stopTeachers = swrJson<{ teachers?: Teacher[] }>(`/api/classes/${classId}/teachers`, (data) => {
      if (data) setTeachers(data.teachers ?? []);
    });
    return () => {
      stopDetail();
      stopTeachers();
    };
  }, [classId]);

  const targets = useMemo<Target[]>(() => {
    const people = (detail?.members ?? []).map((member) => ({
      id: member.id,
      kind: "member" as const,
      name: member.displayName,
      detail: member.memberType === "TEACHER" ? "Lehrperson" : "Person",
      avatarUrl: member.avatarUrl,
      accentColor: member.accentColor,
    }));
    const teacherTargets = teachers.map((teacher) => ({
      id: teacher.id,
      kind: "teacher" as const,
      name: teacher.name,
      detail: teacher.subject || "Lehrperson",
      avatarUrl: teacher.avatarUrl,
      accentColor: teacher.accentColor,
    }));
    return [...people, ...teacherTargets].sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
  }, [detail, teachers]);

  useEffect(() => {
    if (target || !detail) return;
    const own = targets.find((item) => item.kind === "member" && item.id === detail.myMembershipId);
    if (own) setTarget(own);
  }, [detail, target, targets]);

  const visibleTargets = targets.filter((item) => {
    const needle = search.trim().toLocaleLowerCase("de-CH");
    return !needle || `${item.name} ${item.detail}`.toLocaleLowerCase("de-CH").includes(needle);
  });
  const className = classes?.find((item) => item.id === classId)?.name;

  return (
    <div className="quick-post-layer" role="dialog" aria-modal="true" aria-label="Schnell posten">
      <section className="quick-post-dialog">
        <header className="quick-post-head">
          <div>
            <p className="section-label">Direkt teilen</p>
            <h2 className="display text-4xl leading-[0.92]">Neuer Eintrag</h2>
          </div>
          <button type="button" onClick={onClose} className="quick-post-close" aria-label="Schliessen">
            <IconClose size={20} />
          </button>
        </header>

        {classes === null ? (
          <p className="quick-post-note">Bereitet deine Klasse vor…</p>
        ) : classes.length === 0 ? (
          <div className="quick-post-empty">
            <p className="font-black">Du bist noch in keiner Klasse.</p>
            <p className="mt-1 text-sm font-bold text-ink/55">Tritt zuerst einer Klasse bei, dann kannst du direkt von hier posten.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {classes.length > 1 ? (
              <label className="block">
                <span className="label">Klasse</span>
                <select className="input" value={classId} onChange={(event) => setClassId(event.target.value)}>
                  {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
            ) : (
              <p className="quick-post-class">{className}</p>
            )}

            {!detail ? (
              <p className="quick-post-note">Personen werden geladen…</p>
            ) : (
              <>
                <div className="quick-target-wrap">
                  <button
                    type="button"
                    className="quick-target-button"
                    onClick={() => setPickerOpen((open) => !open)}
                    aria-expanded={pickerOpen}
                  >
                    {target ? (
                      <>
                        <Avatar name={target.name} url={target.avatarUrl} accent={target.accentColor} size={34} />
                        <span className="min-w-0 text-left">
                          <span className="block text-[11px] font-black uppercase text-ink/45">Über</span>
                          <span className="block truncate font-black">{target.name}</span>
                        </span>
                      </>
                    ) : (
                      <span className="font-black">Person oder Lehrperson wählen</span>
                    )}
                    <span className="ml-auto text-xl leading-none text-ink/45">⌄</span>
                  </button>

                  {pickerOpen ? (
                    <div className="quick-target-picker">
                      <input
                        className="input !rounded-[18px] !px-4 !py-2"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Person suchen"
                        autoFocus
                      />
                      <div className="quick-target-list">
                        {visibleTargets.length ? visibleTargets.map((item) => (
                          <button
                            key={`${item.kind}-${item.id}`}
                            type="button"
                            className={`quick-target-option ${target?.id === item.id && target.kind === item.kind ? "is-selected" : ""}`}
                            onClick={() => {
                              setTarget(item);
                              setPickerOpen(false);
                              setSearch("");
                            }}
                          >
                            <Avatar name={item.name} url={item.avatarUrl} accent={item.accentColor} size={32} />
                            <span className="min-w-0 text-left"><span className="block truncate font-black">{item.name}</span><span className="block truncate text-xs font-bold text-ink/48">{item.detail}</span></span>
                          </button>
                        )) : <p className="px-2 py-4 text-center text-sm font-bold text-ink/50">Niemand passt dazu.</p>}
                      </div>
                    </div>
                  ) : null}
                </div>

                {target ? (
                  <CreatePost
                    key={`${classId}-${target.kind}-${target.id}`}
                    classId={classId}
                    subjectMembershipId={target.kind === "member" ? target.id : undefined}
                    teacherId={target.kind === "teacher" ? target.id : undefined}
                    onCreated={() => undefined}
                    onFinished={() => window.setTimeout(onClose, 380)}
                  />
                ) : <p className="quick-post-note">Wähle zuerst, über wen du etwas posten möchtest.</p>}
              </>
            )}
          </div>
        )}

        {error ? <p className="mt-3 text-sm font-black text-coral">{error}</p> : null}
      </section>
    </div>
  );
}
