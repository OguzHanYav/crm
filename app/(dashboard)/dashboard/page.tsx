import Link from "next/link";
import type { ReactElement } from "react";
import { createClient } from "@/utils/supabase/server";
import { currentUserCanUseFeature } from "@/lib/features";
import { getCurrentTenant, PLAN_LABELS, TENANT_FEATURE_LABELS, type TenantFeatureKey } from "@/lib/tenant";
import {
  DASHBOARD_TIME_ZONE,
  getActivityStream,
  getAssignedPhoneNumber,
  getCallsTodayCount,
  getDashboardStats,
  getRecentCalls,
  getSentNotificationsCount,
  type StreamEntry,
} from "./data";
import { getTeamMembers } from "./kontakte/data";
import ContactFormModal from "./kontakte/components/ContactFormModal";
import DashboardPhoneCard from "./components/DashboardPhoneCard";

// ---------- Icons ----------
const iconClass = "h-5 w-5";
function IconUsers(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={iconClass} aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconKanban(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={iconClass} aria-hidden>
      <rect x="3" y="4" width="5" height="16" rx="1.5" />
      <rect x="10" y="4" width="5" height="10" rx="1.5" />
      <rect x="17" y="4" width="4" height="13" rx="1.5" />
    </svg>
  );
}
function IconPhone(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={iconClass} aria-hidden>
      <path d="M5 4h3l1.5 4-2 1.5c1 2.5 2.5 4 5 5l1.5-2 4 1.5v3c0 1-1 1.5-2 1.5C9.5 18.5 5.5 14.5 4.5 8c-.1-1 .5-2 1.5-2z" strokeLinejoin="round" />
    </svg>
  );
}
function IconSend(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={iconClass} aria-hidden>
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------- Helfer ----------
function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("de-DE", { timeZone: DASHBOARD_TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(new Date())
  );
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}

function todayLabel(): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: DASHBOARD_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function relativeTime(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std.`;
  return new Intl.DateTimeFormat("de-DE", { timeZone: DASHBOARD_TIME_ZONE, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

const STREAM_STYLE: Record<StreamEntry["kind"], { dot: string; label: string }> = {
  contact_created: { dot: "bg-accent", label: "Kontakt" },
  note: { dot: "bg-info", label: "Notiz" },
  call: { dot: "bg-success", label: "Anruf" },
  email: { dot: "bg-warning", label: "E-Mail" },
  whatsapp: { dot: "bg-success", label: "WhatsApp" },
  stage_change: { dot: "bg-muted-foreground", label: "Pipeline" },
};

function KpiCard({ label, value, icon, href }: { label: string; value: number; icon: ReactElement; href?: string }) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">
        {value.toLocaleString("de-DE")}
      </div>
    </>
  );
  const className = "rounded-2xl border border-border bg-card p-4 shadow-soft transition-colors sm:p-5";
  return href ? (
    <Link href={href} className={`${className} glow-hover`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

// Hinweis nach Umleitung durch einen Feature-Guard (requireFeature in lib/features.ts).
function AccessBanner({ upgrade, denied, planLabel }: { upgrade?: string; denied?: string; planLabel: string }) {
  const key = (upgrade ?? denied) as TenantFeatureKey | undefined;
  if (!key || !(key in TENANT_FEATURE_LABELS)) return null;
  const feature = TENANT_FEATURE_LABELS[key];
  return upgrade ? (
    <div role="status" className="flex flex-col gap-1 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-foreground">
        <span className="font-semibold">Upgrade erforderlich:</span> „{feature}“ ist im Paket {planLabel} nicht enthalten.
      </p>
      <span className="text-xs text-muted-foreground">Für ein Upgrade bitte an den Anbieter wenden.</span>
    </div>
  ) : (
    <div role="status" className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
      <span className="font-semibold">Keine Berechtigung:</span> „{feature}“ wurde für dein Konto noch nicht freigeschaltet.
      Bitte wende dich an einen Administrator.
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string; denied?: string }>;
}) {
  const { upgrade, denied } = await searchParams;
  const tenant = await getCurrentTenant();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileResult, callsEnabled, notificationsEnabled] = await Promise.all([
    user ? supabase.from("profiles").select("first_name").eq("id", user.id).single() : Promise.resolve({ data: null }),
    currentUserCanUseFeature("calls"),
    currentUserCanUseFeature("notifications"),
  ]);
  const firstName = (profileResult.data as { first_name?: string } | null)?.first_name?.trim();

  const [stats, teamMembers, stream, callsToday, recentCalls, sentNotifications, assignedNumber] = await Promise.all([
    getDashboardStats(),
    getTeamMembers(),
    getActivityStream({ includeMessages: notificationsEnabled, limit: 10 }),
    callsEnabled ? getCallsTodayCount() : Promise.resolve(0),
    callsEnabled ? getRecentCalls(5) : Promise.resolve([]),
    notificationsEnabled ? getSentNotificationsCount() : Promise.resolve(0),
    callsEnabled && user ? getAssignedPhoneNumber(user.id) : Promise.resolve(null),
  ]);

  const maxStageCount = Math.max(1, ...stats.dealsByStage.map((s) => s.count));

  return (
    <div className="flex min-w-0 flex-col gap-5 max-sm:pb-16 sm:gap-6">
      <AccessBanner upgrade={upgrade} denied={denied} planLabel={PLAN_LABELS[tenant.plan]} />

      {/* Begrüßung + Schnellaktionen */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {greeting()}
            {firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Hier ist deine aktuelle Übersicht für heute, {todayLabel()}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {notificationsEnabled && (
            <Link
              href="/dashboard/kontakte"
              title="Kontakte auswählen und Nachricht senden"
              className="ring-focus flex min-h-[40px] items-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
            >
              Nachricht senden
            </Link>
          )}
          {callsEnabled && (
            <Link
              href="/dashboard/kontakte"
              title="In der Kontaktliste auf eine Telefonnummer klicken"
              className="ring-focus flex min-h-[40px] items-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
            >
              Neuer Anruf
            </Link>
          )}
          <ContactFormModal mode="create" triggerLabel="+ Kontakt hinzufügen" teamMembers={teamMembers} />
        </div>
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Kontakte gesamt" value={stats.totalContacts} icon={<IconUsers />} href="/dashboard/kontakte" />
        <KpiCard label="Deals gesamt" value={stats.totalDeals} icon={<IconKanban />} href="/dashboard/deals" />
        {callsEnabled && <KpiCard label="Anrufe heute" value={callsToday} icon={<IconPhone />} href="/dashboard/anrufe" />}
        {notificationsEnabled && (
          <KpiCard
            label="Gesendete Benachrichtigungen"
            value={sentNotifications}
            icon={<IconSend />}
            href="/dashboard/notifications"
          />
        )}
      </div>

      {/* Haupt-Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">Deals nach Phase</h2>
              <span className="text-xs text-muted-foreground">{stats.openDeals.toLocaleString("de-DE")} offen</span>
            </div>
            {stats.dealsByStage.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Noch keine Phasen angelegt.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {stats.dealsByStage.map((stage) => (
                  <li key={stage.id} className="flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0 truncate text-foreground sm:w-32" title={stage.name}>
                      {stage.name}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${(stage.count / maxStageCount) * 100}%`, backgroundColor: stage.color }}
                      />
                    </span>
                    <span className="w-12 shrink-0 text-right font-medium tabular-nums text-foreground">{stage.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {callsEnabled && (
            <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">Letzte Anrufe</h2>
                <Link href="/dashboard/anrufe" className="text-xs font-medium text-accent hover:underline">
                  Alle →
                </Link>
              </div>
              {recentCalls.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Noch keine Anrufe protokolliert.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border/60">
                  {recentCalls.map((call) => (
                    <li key={call.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{call.contactName}</p>
                        <p className="text-xs text-muted-foreground">
                          {relativeTime(call.calledAt)}
                          {call.authorName ? ` · ${call.authorName}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                          {call.callType === "opening_call" ? "Opening" : "Follow-up"}
                        </span>
                        {call.interestExpressed !== null && (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              call.interestExpressed ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {call.interestExpressed ? "Interesse" : "Kein Interesse"}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
            <h2 className="text-sm font-semibold text-foreground">Letzte Aktivitäten</h2>
            {stream.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Noch keine Aktivitäten.</p>
            ) : (
              <ol className="mt-4 flex flex-col gap-3">
                {stream.map((entry) => {
                  const style = STREAM_STYLE[entry.kind];
                  return (
                    <li key={entry.id} className="flex gap-3">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${entry.failed ? "bg-danger" : style.dot}`} />
                      <div className="min-w-0">
                        <p className="line-clamp-2 break-words text-sm text-foreground">{entry.text}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {style.label}
                          {entry.failed ? " · fehlgeschlagen" : ""} · {relativeTime(entry.date)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {callsEnabled && <DashboardPhoneCard assignedNumber={assignedNumber} />}
        </div>
      </div>
    </div>
  );
}
