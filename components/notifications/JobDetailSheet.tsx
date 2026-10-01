"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

type JobChannel = "email" | "whatsapp" | "both";
type JobItemStatus = "pending" | "sent" | "failed" | "skipped_no_consent";

type JobDetail = {
  id: string;
  status: string;
  channel: JobChannel;
  emailSubject: string | null;
  emailBody: string | null;
  emailIsHtml: boolean;
  whatsappTemplateName: string | null;
  whatsappLanguageCode: string | null;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  processed: number;
  createdAt: string;
  updatedAt: string;
};

type JobItem = {
  id: string;
  contactId: string;
  contactName: string;
  channel: "email" | "whatsapp";
  status: JobItemStatus;
  error: string | null;
  processedAt: string | null;
};

const PAGE_SIZE = 50;

const FILTERS: { key: "all" | JobItemStatus; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "sent", label: "Gesendet" },
  { key: "failed", label: "Fehlgeschlagen" },
  { key: "skipped_no_consent", label: "Übersprungen" },
];

const ITEM_STATUS_LABEL: Record<JobItemStatus, string> = {
  pending: "Ausstehend",
  sent: "Gesendet",
  failed: "Fehlgeschlagen",
  skipped_no_consent: "Übersprungen (keine Einwilligung)",
};

function channelLabel(channel: JobChannel) {
  if (channel === "email") return "E-Mail";
  if (channel === "whatsapp") return "WhatsApp";
  return "E-Mail + WhatsApp";
}

function formatDateDE(dateString: string) {
  return new Date(dateString).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function JobDetailSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");

  const [job, setJob] = useState<JobDetail | null>(null);
  const [items, setItems] = useState<JobItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<"all" | JobItemStatus>("all");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Nur die Antwort der jeweils letzten Anfrage übernehmen — sonst kann ein
  // langsamer "Alle"-Request die Liste eines späteren Filters überschreiben.
  const requestRef = useRef(0);

  const isOpen = Boolean(jobId);

  const load = useCallback(async (id: string, statusFilter: string, pageIndex: number) => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(pageIndex * PAGE_SIZE));

      const res = await fetch(`/api/notifications/jobs/${id}/items?${params.toString()}`);
      const json = await res.json();
      if (requestId !== requestRef.current) return;
      if (res.ok && json.success) {
        setJob(json.job);
        setItems(json.items);
        setTotal(json.total);
      } else {
        setItems([]);
        setTotal(0);
        setLoadError(json.message ?? "Empfänger-Logs konnten nicht geladen werden.");
      }
    } catch {
      if (requestId === requestRef.current) setLoadError("Empfänger-Logs konnten nicht geladen werden (Netzwerkfehler).");
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setItems([]);
      setFilter("all");
      setPage(0);
      setFeedback(null);
      setLoadError(null);
      return;
    }
    load(jobId, filter, page);
  }, [jobId, filter, page, load]);

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("jobId");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function changeFilter(next: "all" | JobItemStatus) {
    setFilter(next);
    setPage(0);
  }

  // "Fehlgeschlagene erneut senden": lädt ALLE fehlgeschlagenen Items (nicht nur
  // die aktuelle Seite), gruppiert sie nach Kanal und stößt pro betroffenem
  // Kanal einen eigenen neuen Job über den unveränderten /api/notifications/send
  // an — so wird bei einem "both"-Job nicht versehentlich der bereits
  // erfolgreiche Kanal für denselben Kontakt erneut angestoßen.
  async function handleRetryFailed() {
    if (!jobId || !job) return;
    setRetrying(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/notifications/jobs/${jobId}/items?status=failed&limit=1000`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setFeedback("Fehlgeschlagene Items konnten nicht geladen werden.");
        return;
      }

      const failedItems = json.items as JobItem[];
      const emailContactIds = failedItems.filter((i) => i.channel === "email").map((i) => i.contactId);
      const whatsappContactIds = failedItems.filter((i) => i.channel === "whatsapp").map((i) => i.contactId);

      const requests: Promise<Response>[] = [];

      if (emailContactIds.length > 0 && job.emailSubject && job.emailBody) {
        requests.push(
          fetch("/api/notifications/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contactIds: emailContactIds,
              type: "email",
              emailPayload: { subject: job.emailSubject, body: job.emailBody, isHtml: job.emailIsHtml },
            }),
          })
        );
      }

      if (whatsappContactIds.length > 0 && job.whatsappTemplateName) {
        requests.push(
          fetch("/api/notifications/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contactIds: whatsappContactIds,
              type: "whatsapp",
              whatsappPayload: {
                templateName: job.whatsappTemplateName,
                languageCode: job.whatsappLanguageCode ?? "de",
              },
            }),
          })
        );
      }

      if (requests.length === 0) {
        setFeedback("Keine erneut sendbaren Items gefunden.");
        return;
      }

      await Promise.all(requests);
      setFeedback("Neuer Versand-Job für die fehlgeschlagenen Kontakte wurde gestartet.");
    } catch {
      setFeedback("Erneuter Versand fehlgeschlagen (Netzwerkfehler).");
    } finally {
      setRetrying(false);
    }
  }

  if (!isOpen) return null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />

      <div className="relative flex h-full w-full max-w-full flex-col rounded-none border-l border-border bg-card shadow-2xl sm:max-w-xl sm:rounded-l-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Job-Details</h2>
            {job && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {job.emailSubject ?? job.whatsappTemplateName ?? "—"} · {formatDateDE(job.createdAt)}
              </p>
            )}
          </div>
          <button
            onClick={close}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {job && (
            <section className="mb-5 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 font-medium text-accent">
                  {channelLabel(job.channel)}
                </span>
                {job.emailIsHtml && job.channel !== "whatsapp" && (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground">HTML</span>
                )}
              </div>

              {job.channel !== "whatsapp" && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Betreff</p>
                  <p className="text-sm font-medium text-foreground">{job.emailSubject || "—"}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Gesendete Nachricht</p>
                  {job.emailBody ? (
                    job.emailIsHtml ? (
                      // HTML-Mails in isoliertem iframe (sandbox ohne Rechte: keine Skripte, keine Links nach außen).
                      <iframe
                        title="Gesendete E-Mail"
                        sandbox=""
                        srcDoc={job.emailBody}
                        className="h-72 w-full rounded-lg border border-border bg-white"
                      />
                    ) : (
                      <div className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-slate-100 p-3 text-sm text-slate-800 dark:bg-zinc-800/60 dark:text-zinc-200">
                        {job.emailBody}
                      </div>
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">Kein Nachrichtentext gespeichert.</p>
                  )}
                </div>
              )}

              {job.channel !== "email" && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">WhatsApp-Vorlage</p>
                  <div className="rounded-lg bg-slate-100 p-3 text-sm text-slate-800 dark:bg-zinc-800/60 dark:text-zinc-200">
                    {job.whatsappTemplateName || "—"}
                    {job.whatsappLanguageCode && (
                      <span className="text-muted-foreground"> · Sprache: {job.whatsappLanguageCode}</span>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          {job && (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Empfänger</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                ✅ {job.sent} gesendet · ❌ {job.failed} fehlgeschlagen · ⏭️ {job.skipped} übersprungen
              </p>

              {job.failed > 0 && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleRetryFailed}
                    disabled={retrying}
                    className="ring-focus flex min-h-[40px] items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                  >
                    {retrying ? "Wird gestartet..." : "Fehlgeschlagene erneut senden"}
                  </button>
                  {feedback && <p className="mt-2 text-xs text-muted-foreground">{feedback}</p>}
                </div>
              )}
            </>
          )}

          <div className="no-scrollbar mt-4 flex w-full max-w-full gap-1 overflow-x-auto rounded-xl bg-muted/50 p-1 sm:w-fit">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => changeFilter(f.key)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  filter === f.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <ul className={`mt-4 flex flex-col gap-2 transition-opacity ${loading ? "opacity-50" : ""}`}>
            {loadError ? (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{loadError}</p>
            ) : items.length === 0 ? (
              loading ? (
                <p className="text-sm text-muted-foreground">Lädt…</p>
              ) : filter === "all" && job && job.total > 0 ? (
                // Items hängen per ON DELETE CASCADE an den Kontakten: wurden die
                // Empfänger gelöscht, sind auch ihre Log-Einträge weg — die Zähler
                // am Job bleiben aber erhalten.
                <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                  Für diesen Job sind keine Empfänger-Einträge mehr vorhanden. Die betroffenen Kontakte wurden
                  vermutlich inzwischen gelöscht – die Zähler oben stammen aus dem ursprünglichen Versand.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Keine Einträge{filter !== "all" ? ` mit Status „${FILTERS.find((f) => f.key === filter)?.label}“` : ""}.
                </p>
              )
            ) : (
              items.map((item) => (
                <li
                  key={item.id}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    item.status === "sent"
                      ? "border-success/30 bg-success/10"
                      : item.status === "skipped_no_consent"
                        ? "border-border bg-muted/40"
                        : "border-danger/30 bg-danger/10"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                    <p className="font-medium text-foreground">
                      {item.contactName} · {item.channel === "email" ? "E-Mail" : "WhatsApp"}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {ITEM_STATUS_LABEL[item.status]}
                      {item.processedAt ? ` · ${formatDateDE(item.processedAt)}` : ""}
                    </span>
                  </div>
                  {item.error && <p className="mt-0.5 text-xs text-danger">{item.error}</p>}
                </li>
              ))
            )}
          </ul>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="ring-focus min-h-[36px] rounded-lg border border-border px-3 py-1 disabled:opacity-40"
              >
                Zurück
              </button>
              <span>
                Seite {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="ring-focus min-h-[36px] rounded-lg border border-border px-3 py-1 disabled:opacity-40"
              >
                Weiter
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
