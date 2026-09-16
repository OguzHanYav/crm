"use client";

import { useCallback, useEffect, useState } from "react";
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

  const isOpen = Boolean(jobId);

  const load = useCallback(async (id: string, statusFilter: string, pageIndex: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(pageIndex * PAGE_SIZE));

      const res = await fetch(`/api/notifications/jobs/${id}/items?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setJob(json.job);
        setItems(json.items);
        setTotal(json.total);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setItems([]);
      setFilter("all");
      setPage(0);
      setFeedback(null);
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
            <>
              <p className="text-sm font-medium text-foreground">
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

          <div className="mt-4 flex gap-1 rounded-xl bg-muted/50 p-1 w-fit">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => changeFilter(f.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  filter === f.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <ul className={`mt-4 flex flex-col gap-2 transition-opacity ${loading ? "opacity-50" : ""}`}>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Einträge.</p>
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
                  <p className="font-medium text-foreground">
                    {item.contactName} · {item.channel === "email" ? "E-Mail" : "WhatsApp"}
                  </p>
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
