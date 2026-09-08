"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { getContactDetailPayload, getContactSheetBootstrap, addNoteToContact } from "@/app/(dashboard)/dashboard/kontakte/actions";
import { updateDealStage } from "@/app/(dashboard)/dashboard/deals/actions";
import type { ContactDetailPayload, ContactSheetBootstrap } from "@/app/(dashboard)/dashboard/kontakte/types";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Badge, STATUS_TONE_MAP } from "@/components/ui/Badge";
import { useCrmStore, type ContactPreview } from "@/lib/store/useCrmStore";

const FIVE_MINUTES = 5 * 60 * 1000;

type Tab = "info" | "activity" | "notes";

const TABS: [Tab, string][] = [
  ["info", "Info"],
  ["activity", "Aktivitäten"],
  ["notes", "Notizen"],
];

function resolveTargetStageId(
  pipelineId: string | undefined,
  phaseKey: string,
  bootstrap: ContactSheetBootstrap
): string | null {
  const phase = bootstrap.phases.find((p) => p.key === phaseKey);
  if (!phase) return null;
  const sameStage = bootstrap.stages.find(
    (s) => s.pipeline_id === pipelineId && phase.stageIds.includes(s.id)
  );
  return sameStage?.id ?? phase.defaultStageId;
}

// Der Import speichert Branche/Adresse/Telefon 2 zusammengefasst in notes, z. B.
// "Branche: Gastronomie | Adresse: Musterstr. 1 | Telefon 2: +49 ...". Extrahiert
// die einzelnen Felder daraus, damit sie in eigenen Zeilen angezeigt werden können.
function parseNotesFields(notes: string | null | undefined) {
  const result: { branche: string | null; adresse: string | null; telefon2: string | null; rest: string | null } = {
    branche: null,
    adresse: null,
    telefon2: null,
    rest: null,
  };
  if (!notes) return result;

  const rest: string[] = [];
  for (const part of notes.split("|").map((p) => p.trim())) {
    if (!part) continue;
    const match = part.match(/^([^:]+):\s*(.*)$/);
    if (match) {
      const label = match[1].trim().toLowerCase();
      const value = match[2].trim();
      if (label === "branche") {
        result.branche = value || null;
        continue;
      }
      if (label === "adresse") {
        result.adresse = value || null;
        continue;
      }
      if (label === "telefon 2") {
        result.telefon2 = value || null;
        continue;
      }
    }
    rest.push(part);
  }
  result.rest = rest.length > 0 ? rest.join(" | ") : null;
  return result;
}

function formatDateDE(dateString: string, withTime = true) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export default function ContactDetailSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const contactId = searchParams.get("contactId");
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>("info");
  // Aus der Tabellenzeile bekannte Grunddaten — lässt den Header sofort (0ms)
  // mit echten Werten rendern, statt auf den vollständigen Payload zu warten.
  const contactPreview = useCrmStore((s) => s.contactPreview);

  const isOpen = Boolean(contactId);

  // 5 Minuten Cache: Wird derselbe Kontakt innerhalb dieses Fensters erneut
  // geöffnet (z. B. Sheet schließen/wieder öffnen, oder Wechsel deals<->kontakte),
  // liefert TanStack Query die Daten sofort aus dem Cache statt neu zu fetchen.
  const detailQuery = useQuery({
    queryKey: ["contact-detail", contactId],
    queryFn: async () => {
      const result = await getContactDetailPayload(contactId as string);
      if (!result.success || !result.data) {
        throw new Error(result.message ?? "Kontakt nicht gefunden.");
      }
      return result.data;
    },
    enabled: Boolean(contactId),
    staleTime: FIVE_MINUTES,
  });

  // Team/Pipelines/Stages/Phasen ändern sich selten — ein Cache-Eintrag für alle
  // Kontakte, ebenfalls 5 Minuten gültig.
  const bootstrapQuery = useQuery({
    queryKey: ["contact-sheet-bootstrap"],
    queryFn: async () => {
      const result = await getContactSheetBootstrap();
      if (!result.success || !result.data) {
        throw new Error("Bootstrap-Daten konnten nicht geladen werden.");
      }
      return result.data;
    },
    staleTime: FIVE_MINUTES,
  });

  const payload = detailQuery.data ?? null;
  const bootstrap = bootstrapQuery.data ?? null;
  const notFound = detailQuery.isError;
  const payloadMatchesCurrent = Boolean(payload && contactId && payload.contact.id === contactId);
  const preview: ContactPreview | null =
    contactPreview && contactId && contactPreview.id === contactId ? contactPreview : null;

  // Tab-Reset ist reiner UI-Zustand (kein Datenfetch) und bleibt daher als
  // schlanker useEffect — das Laden selbst übernimmt useQuery oben.
  useEffect(() => {
    if (contactId) setTab("info");
    // Kein sofortiges Entfernen des Sheets beim Schließen: Browser-Erweiterungen
    // (Passwort-Manager/Autofill) hängen Listener an die Formularfelder im Sheet
    // und greifen beim Aufräumen per requestIdleCallback teils erst verzögert
    // darauf zu ("Cannot read properties of undefined (reading 'startTime')"),
    // wenn React die Knoten synchron entfernt hat. Das Sheet bleibt daher bis zum
    // nächsten Öffnen im DOM (nur visuell versteckt, siehe isOpen unten).
  }, [contactId]);

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("contactId");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function refreshPayload() {
    if (contactId) queryClient.invalidateQueries({ queryKey: ["contact-detail", contactId] });
    router.refresh();
  }

  if (!isOpen && !payload) return null;

  return (
    <div
      className={`fixed inset-0 z-50 ${isOpen ? "flex justify-end" : "hidden"}`}
      aria-hidden={!isOpen}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={close} />

      <div className="relative flex h-full w-full max-w-full flex-col rounded-none border-l border-border bg-card shadow-2xl sm:max-w-xl sm:rounded-l-2xl">
        {payloadMatchesCurrent && payload ? (
          <SheetContent
            payload={payload}
            bootstrap={bootstrap}
            tab={tab}
            setTab={setTab}
            onClose={close}
            onRefresh={refreshPayload}
          />
        ) : notFound ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Kontakt nicht gefunden.
          </div>
        ) : isOpen ? (
          <SheetSkeleton preview={preview} onClose={close} />
        ) : null}
      </div>
    </div>
  );
}

// Zeigt sofort echte Werte, wenn ein Preview aus der Tabellenzeile vorliegt
// (Name/Telefon/E-Mail), und pulsierende Platzhalter für alles, was erst mit
// dem vollständigen Payload nachgeladen wird — das Sheet öffnet dadurch ohne
// Wartezeit, statt durch einen blockierenden "Lädt..."-Zustand.
function SheetSkeleton({ preview, onClose }: { preview: ContactPreview | null; onClose: () => void }) {
  return (
    <>
      <div className="flex flex-col gap-4 border-b border-border p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {preview ? (
                `${preview.first_name} ${preview.last_name}`
              ) : (
                <span className="inline-block h-5 w-32 animate-pulse rounded bg-muted align-middle" />
              )}
            </h2>
            <p className="mt-1.5 h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
          <button
            onClick={onClose}
            className="ring-focus flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          {preview?.phone && (
            <a
              href={`tel:${preview.phone}`}
              className="ring-focus flex min-h-[44px] items-center rounded-lg border border-border bg-muted/30 px-3 py-1.5 font-medium text-foreground transition-colors hover:border-accent/40 hover:bg-accent-soft"
            >
              📞 {preview.phone}
            </a>
          )}
          {preview?.email && (
            <a
              href={`mailto:${preview.email}`}
              className="ring-focus flex min-h-[44px] items-center rounded-lg border border-border bg-muted/30 px-3 py-1.5 font-medium text-foreground transition-colors hover:border-accent/40 hover:bg-accent-soft"
            >
              ✉️ E-Mail
            </a>
          )}
        </div>
      </div>

      <div className="no-scrollbar overflow-x-auto border-b border-border px-4 py-3">
        <div className="flex min-h-[44px] items-center gap-1 whitespace-nowrap rounded-xl bg-muted/50 p-1">
          {TABS.map(([key, label]) => (
            <span key={key} className="flex-1 shrink-0 rounded-lg px-3 py-1.5 text-center text-sm font-medium text-muted-foreground/40">
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" style={{ opacity: 1 - i * 0.1 }} />
          ))}
        </div>
      </div>
    </>
  );
}

function SheetContent({
  payload,
  bootstrap,
  tab,
  setTab,
  onClose,
  onRefresh,
}: {
  payload: ContactDetailPayload;
  bootstrap: ContactSheetBootstrap | null;
  tab: Tab;
  setTab: (t: Tab) => void;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { contact, deals } = payload;
  const primaryDeal = deals[0] ?? null;

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {contact.first_name} {contact.last_name}
              </h2>
              <Badge tone={STATUS_TONE_MAP[contact.status] ?? "default"}>{contact.status}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{contact.company ?? "—"}</p>
          </div>
          <button
            onClick={onClose}
            className="ring-focus flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <a
            href={`tel:${contact.phone ?? ""}`}
            className="ring-focus flex min-h-[44px] items-center rounded-lg border border-border bg-muted/30 px-3 py-1.5 font-medium text-foreground transition-colors hover:border-accent/40 hover:bg-accent-soft"
          >
            📞 {contact.phone ?? "Keine Nummer"}
          </a>
          <a
            href={`mailto:${contact.email}`}
            className="ring-focus flex min-h-[44px] items-center rounded-lg border border-border bg-muted/30 px-3 py-1.5 font-medium text-foreground transition-colors hover:border-accent/40 hover:bg-accent-soft"
          >
            ✉️ E-Mail
          </a>
        </div>

        {primaryDeal && bootstrap && bootstrap.phases.length > 0 && (
          <PhaseSelect deal={primaryDeal} bootstrap={bootstrap} onRefresh={onRefresh} />
        )}
      </div>

      {/* Tabs */}
      <div className="no-scrollbar overflow-x-auto border-b border-border px-4 py-3">
        <div className="flex min-h-[44px] items-center gap-1 whitespace-nowrap rounded-xl bg-muted/50 p-1">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`ring-focus min-h-[36px] flex-1 shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "info" && <InfoTab payload={payload} />}
        {tab === "activity" && <ActivityTab payload={payload} />}
        {tab === "notes" && <NotesTab payload={payload} onRefresh={onRefresh} />}
      </div>
    </>
  );
}

// Nur aktive, kanonische Pipeline-Phasen sind wählbar (keine veralteten/inaktiven
// deal_stages-Reste). Wechsel wird optimistisch angezeigt, bevor die Server-Action
// abgeschlossen ist; bei Fehlschlag wird der vorherige Wert wiederhergestellt.
function PhaseSelect({
  deal,
  bootstrap,
  onRefresh,
}: {
  deal: { id: string; stage_id: string; pipeline_id: string };
  bootstrap: ContactSheetBootstrap;
  onRefresh: () => void;
}) {
  const currentPhaseKey = bootstrap.phases.find((p) => p.stageIds.includes(deal.stage_id))?.key ?? "";
  const [optimisticKey, setOptimisticKey] = useState(currentPhaseKey);

  useEffect(() => {
    setOptimisticKey(currentPhaseKey);
  }, [currentPhaseKey]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newPhaseKey = e.target.value;
      const previousKey = optimisticKey;
      setOptimisticKey(newPhaseKey);

      const targetStageId = resolveTargetStageId(deal.pipeline_id, newPhaseKey, bootstrap);
      if (!targetStageId) {
        setOptimisticKey(previousKey);
        return;
      }

      updateDealStage(deal.id, targetStageId).then((result) => {
        if (result.success) {
          onRefresh();
        } else {
          setOptimisticKey(previousKey);
        }
      });
    },
    [deal, bootstrap, onRefresh, optimisticKey]
  );

  return (
    <Select value={optimisticKey} onChange={handleChange} className="h-11 min-h-[44px] w-auto text-sm">
      {bootstrap.phases.map((phase) => (
        <option key={phase.key} value={phase.key}>
          {phase.name}
        </option>
      ))}
    </Select>
  );
}

function InfoTab({ payload }: { payload: ContactDetailPayload }) {
  const { contact } = payload;
  const parsedNotes = parseNotesFields(contact.notes);
  const adresse = contact.address || parsedNotes.adresse;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Kontakt</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Ansprechpartner</dt>
            <dd className="mt-0.5 text-foreground">
              {contact.first_name} {contact.last_name}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Position</dt>
            <dd className="mt-0.5 text-foreground">{contact.position ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Firma</dt>
            <dd className="mt-0.5 text-foreground">{contact.company ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Sales Rep</dt>
            <dd className="mt-0.5 text-foreground">
              {contact.assigned_profile
                ? `${contact.assigned_profile.first_name} ${contact.assigned_profile.last_name}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">E-Mail</dt>
            <dd className="mt-0.5 truncate text-foreground">{contact.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Telefon</dt>
            <dd className="mt-0.5 text-foreground">{contact.phone || parsedNotes.telefon2 || "—"}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Adresse & Region</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div className="col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">Adresse</dt>
            <dd className="mt-0.5 text-foreground">{adresse || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Land</dt>
            <dd className="mt-0.5 text-foreground">{contact.country ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Status</dt>
            <dd className="mt-0.5 text-foreground">{contact.status ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">Branche / Event-Kategorie</dt>
            <dd className="mt-0.5 text-foreground">{parsedNotes.branche ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Notizen</h3>
        <p className="whitespace-pre-wrap text-sm text-foreground">{parsedNotes.rest ?? "—"}</p>
      </section>
    </div>
  );
}

function ActivityTab({ payload }: { payload: ContactDetailPayload }) {
  const { notes, callLogs, stageHistory } = payload;

  type Item = { type: "note" | "call" | "stage"; date: string; content: React.ReactNode };

  const items: Item[] = [
    ...notes.map((n) => ({ type: "note" as const, date: n.created_at, content: n.content })),
    ...callLogs.map((c) => ({
      type: "call" as const,
      date: c.called_at || c.created_at,
      content: `${c.call_type}: ${c.notes || "—"}${c.interest_expressed !== null ? ` (Interesse: ${c.interest_expressed ? "Ja" : "Nein"})` : ""}`,
    })),
    ...stageHistory.map((h) => ({
      type: "stage" as const,
      date: h.changed_at,
      content: `Phase geändert: ${h.from_stage?.name ?? "—"} → ${h.to_stage?.name ?? "—"}`,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (items.length === 0) return <p className="text-sm text-muted-foreground">Noch keine Aktivitäten.</p>;

  const icons = { note: "📝", call: "📞", stage: "🔄" };

  return (
    <ul className="flex flex-col gap-4">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="mt-0.5">{icons[item.type]}</span>
          <div>
            <p className="text-foreground">{item.content}</p>
            <p className="text-xs text-muted-foreground">{formatDateDE(item.date)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function NotesTab({ payload, onRefresh }: { payload: ContactDetailPayload; onRefresh: () => void }) {
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await addNoteToContact(payload.contact.id, trimmed);
      if (result.success) {
        setText("");
        onRefresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      {payload.notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Notizen.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {payload.notes.map((n) => (
            <li key={n.id} className="rounded-xl border border-border p-3 text-sm">
              <p className="text-foreground">{n.content}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {n.author ? `${n.author.first_name} ${n.author.last_name} · ` : ""}
                {formatDateDE(n.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="sticky bottom-0 -mx-6 -mb-6 mt-2 flex gap-2 border-t border-border bg-card px-6 py-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Neue Notiz..."
          className="flex-1"
        />
        <Button onClick={submit} disabled={isPending || !text.trim()} size="sm">
          {isPending ? "..." : "Speichern"}
        </Button>
      </div>
    </div>
  );
}

