"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  JOB_POLL_INTERVAL_MS,
  BULK_WARNING_THRESHOLD,
  BULK_STRONG_WARNING_THRESHOLD,
} from "@/lib/constants/notifications";

type Channel = "email" | "whatsapp" | "both";
type Phase = "form" | "progress";

type JobStatus = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  processed: number;
  remaining: number;
  emailSubject: string | null;
  createdAt: string;
  completedAt: string | null;
};

type FailedJobItem = {
  id: string;
  contactId: string;
  contactName: string;
  channel: "email" | "whatsapp";
  error: string | null;
};

const clientSchema = z
  .object({
    channel: z.enum(["email", "whatsapp", "both"]),
    subject: z.string().optional(),
    body: z.string().optional(),
    isHtml: z.boolean(),
    templateName: z.string().optional(),
    languageCode: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.channel === "email" || data.channel === "both") {
      if (!data.subject?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Betreff erforderlich.", path: ["subject"] });
      if (!data.body?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Inhalt erforderlich.", path: ["body"] });
    }
    if (data.channel === "whatsapp" || data.channel === "both") {
      if (!data.templateName?.trim())
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Template-Name erforderlich.", path: ["templateName"] });
    }
  });

// Ein /process-Call läuft im Hintergrund weiter, selbst wenn das Modal
// geschlossen wird (der Server-Job kennt keine "Client ist weg"-Info) — daher
// hier kein "Abbrechen", sondern nur die Warnung, dass man den Fortschritt
// nicht mehr sieht.
const BACKGROUND_WARNING =
  "Wenn du das Fenster schließt, läuft der Versand trotzdem weiter, aber du siehst keinen Fortschritt mehr.";

export default function SendNotificationModal({
  contactIds,
  onClose,
  onSuccess,
}: {
  contactIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("form");

  const [channel, setChannel] = useState<Channel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isHtml, setIsHtml] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [languageCode, setLanguageCode] = useState("de");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error"; text: string } | null>(null);

  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [failedItems, setFailedItems] = useState<FailedJobItem[]>([]);
  const [showFailedItems, setShowFailedItems] = useState(false);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastProcessTriggerRef = useRef<number>(0);
  const onSuccessCalledRef = useRef(false);

  const triggerProcess = useCallback((id: string) => {
    lastProcessTriggerRef.current = Date.now();
    // Fire-and-forget: die Response interessiert hier nicht (das Polling liest
    // den Fortschritt ohnehin aus /api/notifications/jobs/[jobId]), Fehler
    // werden nur geloggt, damit ein 409 (Lock gehalten) o. Ä. nicht die UI stört.
    fetch(`/api/notifications/jobs/${id}/process`, { method: "POST" }).catch((err) => {
      console.error("notification job process trigger failed:", err);
    });
  }, []);

  const fetchJobStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/jobs/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success) return;

      const nextJob = json.job as JobStatus;
      setJob(nextJob);
      setFailedItems(json.failedItems ?? []);

      const isDone = nextJob.status === "completed" || nextJob.status === "failed" || nextJob.status === "cancelled";

      if (isDone) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        if (nextJob.status === "completed" && nextJob.failed === 0 && !onSuccessCalledRef.current) {
          onSuccessCalledRef.current = true;
          onSuccess();
        }
        return;
      }

      // Self-Trigger: falls der letzte /process-Call >5s her ist (z. B. weil der
      // Browser-Tab inaktiv war und Timer gedrosselt wurden), erneut anstoßen —
      // verhindert, dass der Job bei einem "verlorenen" fire-and-forget-Call stehen bleibt.
      if (nextJob.remaining > 0 && Date.now() - lastProcessTriggerRef.current > 5000) {
        triggerProcess(id);
      }
    } catch (err) {
      console.error("notification job status poll failed:", err);
    }
  }, [onSuccess, triggerProcess]);

  // Polling-Cleanup: Intervall wird bei Unmount (Modal schließt) IMMER gecleart,
  // unabhängig davon, ob der Job fertig ist — sonst würde ein geschlossenes
  // Modal weiter im Hintergrund pollen und State auf einer unmounteten
  // Komponente setzen.
  useEffect(() => {
    if (phase !== "progress" || !jobId) return;

    fetchJobStatus(jobId);
    pollIntervalRef.current = setInterval(() => fetchJobStatus(jobId), JOB_POLL_INTERVAL_MS);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [phase, jobId, fetchJobStatus]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    setFieldErrors({});

    const parsed = clientSchema.safeParse({ channel, subject, body, isHtml, templateName, languageCode });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    (async () => {
      try {
        const res = await fetch("/api/notifications/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactIds,
            type: channel,
            emailPayload: channel !== "whatsapp" ? { subject, body, isHtml } : undefined,
            whatsappPayload: channel !== "email" ? { templateName, languageCode } : undefined,
          }),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          setFeedback({ type: "error", text: json.message ?? "Job konnte nicht erstellt werden." });
          setIsSubmitting(false);
          return;
        }

        setJobId(json.jobId as string);
        setJob({
          id: json.jobId,
          status: "pending",
          total: json.totalItems,
          sent: 0,
          failed: 0,
          skipped: 0,
          processed: 0,
          remaining: json.totalItems,
          emailSubject: subject || null,
          createdAt: new Date().toISOString(),
          completedAt: null,
        });
        setIsSubmitting(false);
        setPhase("progress");
        triggerProcess(json.jobId as string);
      } catch {
        setFeedback({ type: "error", text: "Netzwerkfehler beim Anlegen des Versand-Jobs." });
        setIsSubmitting(false);
      }
    })();
  }

  const progressPercent = job && job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="flex h-[100dvh] w-full max-w-full flex-col overflow-hidden rounded-none bg-card shadow-2xl sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Nachricht senden ({contactIds.length} Kontakt{contactIds.length === 1 ? "" : "e"})
          </h2>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {phase === "progress" && job ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {job.processed} / {job.total} verarbeitet ({progressPercent}%)
            </p>

            <p className="mt-4 text-sm font-medium text-foreground">
              ✅ {job.sent} gesendet · ❌ {job.failed} fehlgeschlagen · ⏭️ {job.skipped} übersprungen
            </p>

            {job.status !== "completed" && job.status !== "failed" && (
              <p className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{BACKGROUND_WARNING}</p>
            )}

            {job.status === "failed" && (
              <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                Job fehlgeschlagen — bereits verarbeitete Nachrichten wurden trotzdem versendet.
              </p>
            )}

            {failedItems.length > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowFailedItems((v) => !v)}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  {showFailedItems ? "Fehlgeschlagene ausblenden" : `Fehlgeschlagene anzeigen (${failedItems.length})`}
                </button>

                {showFailedItems && (
                  <ul className="mt-2 flex flex-col gap-2">
                    {failedItems.map((item) => (
                      <li key={item.id} className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                        {item.contactName} ({item.channel === "email" ? "E-Mail" : "WhatsApp"}) —{" "}
                        {item.error ?? "Unbekannter Fehler"}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              {job.status === "completed" || job.status === "failed" ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="ring-focus min-h-[40px] rounded-xl border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-muted/50"
                >
                  Schließen
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="ring-focus min-h-[40px] rounded-xl border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-muted/50"
                >
                  Im Hintergrund weiterlaufen lassen
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-6 py-5">
            {feedback && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{feedback.text}</p>}

            {contactIds.length > BULK_WARNING_THRESHOLD && (
              <p className="rounded-lg bg-info-soft px-3 py-2 text-xs text-info">
                Bei mehr als {BULK_WARNING_THRESHOLD} Kontakten läuft der Versand im Hintergrund. Du kannst das Fenster
                schließen — der Versand läuft weiter.
              </p>
            )}
            {contactIds.length > BULK_STRONG_WARNING_THRESHOLD && (
              <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
                ⚠️ Große Sendungen können bei neuen Domains zu Spam-Einstufungen führen. Empfehlung: in Wellen von max.
                100 pro Tag senden.
              </p>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Kanal</label>
              <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
                {(["email", "whatsapp", "both"] as Channel[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChannel(c)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      channel === c ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c === "email" ? "E-Mail" : c === "whatsapp" ? "WhatsApp" : "Beides"}
                  </button>
                ))}
              </div>
            </div>

            {(channel === "email" || channel === "both") && (
              <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">E-Mail</h3>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Betreff</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="ring-focus min-h-[44px] w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground"
                  />
                  {fieldErrors.subject && <p className="mt-1 text-xs text-danger">{fieldErrors.subject}</p>}
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="block text-xs font-medium text-muted-foreground">Inhalt</label>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input type="checkbox" checked={isHtml} onChange={(e) => setIsHtml(e.target.checked)} className="accent-accent" />
                      HTML
                    </label>
                  </div>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={5}
                    placeholder={isHtml ? "<p>Hallo ...</p>" : "Hallo ..."}
                    className="ring-focus w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground"
                  />
                  {fieldErrors.body && <p className="mt-1 text-xs text-danger">{fieldErrors.body}</p>}
                </div>
              </div>
            )}

            {(channel === "whatsapp" || channel === "both") && (
              <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">WhatsApp</h3>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Template-Name</label>
                  <input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="z. B. welcome_message"
                    className="ring-focus min-h-[44px] w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground"
                  />
                  {fieldErrors.templateName && <p className="mt-1 text-xs text-danger">{fieldErrors.templateName}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Sprachcode</label>
                  <input
                    value={languageCode}
                    onChange={(e) => setLanguageCode(e.target.value)}
                    placeholder="de"
                    className="ring-focus min-h-[44px] w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground"
                  />
                </div>
              </div>
            )}

            <div className="sticky bottom-0 mt-2 flex justify-end gap-2 border-t border-border bg-card pt-3">
              <button
                type="button"
                onClick={onClose}
                className="ring-focus min-h-[40px] rounded-xl border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-muted/50"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="ring-focus flex min-h-[40px] items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? "Wird angelegt..." : "Senden"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
