import Link from "next/link";
import { requireFeature } from "@/lib/features";
import { getNotificationJobs, type JobChannel } from "./data";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import JobDetailSheet from "@/components/notifications/JobDetailSheet";

function formatDateDE(dateString: string) {
  return new Date(dateString).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function channelLabel(channel: JobChannel) {
  if (channel === "email") return "E-Mail";
  if (channel === "whatsapp") return "WhatsApp";
  return "E-Mail + WhatsApp";
}

const STATUS_TONE: Record<string, BadgeProps["tone"]> = {
  completed: "success",
  processing: "warning",
  pending: "info",
  failed: "danger",
  cancelled: "default",
};

const STATUS_LABEL: Record<string, string> = {
  completed: "Abgeschlossen",
  processing: "Läuft",
  pending: "Ausstehend",
  failed: "Fehlgeschlagen",
  cancelled: "Abgebrochen",
};

const STATUS_FILTERS: { key: string | undefined; label: string }[] = [
  { key: undefined, label: "Alle" },
  { key: "processing", label: "Läuft" },
  { key: "completed", label: "Abgeschlossen" },
  { key: "failed", label: "Fehlgeschlagen" },
];

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; jobId?: string }>;
}) {
  // Paket ohne Benachrichtigungen -> "Upgrade erforderlich"; Mitglied ohne Freigabe -> "Keine Berechtigung".
  await requireFeature("notifications");

  const { status } = await searchParams;
  const { jobs, total } = await getNotificationJobs({ limit: 20, offset: 0, status });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-foreground">Benachrichtigungen</h1>
        <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">{total}</span>
      </div>

      <div className="flex gap-1 rounded-xl bg-muted/50 p-1 w-fit">
        {STATUS_FILTERS.map((f) => {
          const isActive = (status ?? undefined) === f.key;
          const href = f.key ? `/dashboard/notifications?status=${f.key}` : "/dashboard/notifications";
          return (
            <Link
              key={f.label}
              href={href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {jobs.length === 0 ? (
        <Card className="border-dashed p-10 text-center text-sm text-muted-foreground">Keine Versand-Jobs gefunden.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] table-fixed text-xs">
            <thead className="bg-muted/30">
              <tr>
                <th className="w-[15%] px-3 py-2 text-left font-medium text-muted-foreground">Datum</th>
                <th className="w-[15%] px-3 py-2 text-left font-medium text-muted-foreground">Kanal</th>
                <th className="w-[25%] px-3 py-2 text-left font-medium text-muted-foreground">Betreff/Template</th>
                <th className="w-[10%] px-3 py-2 text-left font-medium text-muted-foreground">Gesendet</th>
                <th className="w-[10%] px-3 py-2 text-left font-medium text-muted-foreground">Fehlgeschlagen</th>
                <th className="w-[10%] px-3 py-2 text-left font-medium text-muted-foreground">Übersprungen</th>
                <th className="w-[10%] px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                <th className="w-[5%] px-3 py-2 text-left font-medium text-muted-foreground">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {jobs.map((job) => (
                <tr key={job.id} className="transition-colors hover:bg-muted/40">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDateDE(job.createdAt)}</td>
                  <td className="truncate px-3 py-2 text-foreground/90">{channelLabel(job.channel)}</td>
                  <td className="truncate px-3 py-2 text-foreground/90">
                    {job.emailSubject ?? job.whatsappTemplateName ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-success">{job.sent}</td>
                  <td className="px-3 py-2 text-danger">{job.failed}</td>
                  <td className="px-3 py-2 text-muted-foreground">{job.skipped}</td>
                  <td className="px-3 py-2">
                    <Badge tone={STATUS_TONE[job.status] ?? "default"}>{STATUS_LABEL[job.status] ?? job.status}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/dashboard/notifications?${status ? `status=${status}&` : ""}jobId=${job.id}`}
                      scroll={false}
                      className="font-medium text-accent hover:underline"
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <JobDetailSheet />
    </div>
  );
}
