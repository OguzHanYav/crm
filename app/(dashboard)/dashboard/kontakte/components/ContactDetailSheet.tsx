"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { getContactDetailPayload, getContactSheetBootstrap, addNoteToContact, logCall } from "@/app/(dashboard)/dashboard/kontakte/actions";
import { updateDealStage } from "@/app/(dashboard)/dashboard/deals/actions";
import type { ContactDetailPayload, ContactSheetBootstrap } from "@/app/(dashboard)/dashboard/kontakte/types";
import LinkDealModal from "@/app/(dashboard)/dashboard/kontakte/components/LinkDealModal";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";

type Tab = "info" | "activity" | "notes";

function formatDateDE(dateString: string, withTime = true) {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(dateString));
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

export default function ContactDetailSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const contactId = searchParams.get("contactId");

  const [payload, setPayload] = useState<ContactDetailPayload | null>(null);
  const [bootstrap, setBootstrap] = useState<ContactSheetBootstrap | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("info");
  const [linkDealOpen, setLinkDealOpen] = useState(false);
  const [, startTransition] = useTransition();

  const isOpen = Boolean(contactId);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    const [detailResult, bootstrapResult] = await Promise.all([
      getContactDetailPayload(id),
      getContactSheetBootstrap(),
    ]);
    if (detailResult.success && detailResult.data) setPayload(detailResult.data);
    if (bootstrapResult.success && bootstrapResult.data) setBootstrap(bootstrapResult.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (contactId) {
      setTab("info");
      load(contactId);
    } else {
      setPayload(null);
    }
  }, [contactId, load]);

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("contactId");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function refreshPayload() {
    if (contactId) load(contactId);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />

      <div className="relative flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-2xl">
        {loading && !payload ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Lädt...
          </div>
        ) : payload ? (
          <SheetContent
            payload={payload}
            bootstrap={bootstrap}
            tab={tab}
            setTab={setTab}
            onClose={close}
            onRefresh={refreshPayload}
            onOpenLinkDeal={() => setLinkDealOpen(true)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Kontakt nicht gefunden.
          </div>
        )}

        {linkDealOpen && payload && bootstrap && (
          <LinkDealModal
            contact={payload.contact}
            pipelines={bootstrap.pipelines}
            stages={bootstrap.stages}
            teamMembers={bootstrap.teamMembers}
            onClose={() => {
              setLinkDealOpen(false);
              refreshPayload();
            }}
          />
        )}
      </div>
    </div>
  );
}

function SheetContent({
  payload,
  bootstrap,
  tab,
  setTab,
  onClose,
  onRefresh,
  onOpenLinkDeal,
}: {
  payload: ContactDetailPayload;
  bootstrap: ContactSheetBootstrap | null;
  tab: Tab;
  setTab: (t: Tab) => void;
  onClose: () => void;
  onRefresh: () => void;
  onOpenLinkDeal: () => void;
}) {
  const { contact, deals } = payload;
  const primaryDeal = deals[0] ?? null;
  const stagesForPrimaryPipeline = bootstrap?.stages.filter(
    (s) => s.pipeline_id === primaryDeal?.pipeline_id
  ) ?? [];

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {contact.first_name} {contact.last_name}
            </h2>
            <p className="text-sm text-muted-foreground">{contact.company ?? "—"}</p>
          </div>
          <button onClick={onClose} className="ring-focus rounded p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <a href={`tel:${contact.phone ?? ""}`} className="ring-focus rounded-lg border border-border px-3 py-1.5 text-foreground transition-colors hover:bg-muted/50">
            📞 {contact.phone ?? "Keine Nummer"}
          </a>
          <a href={`mailto:${contact.email}`} className="ring-focus rounded-lg border border-border px-3 py-1.5 text-foreground transition-colors hover:bg-muted/50">
            ✉️ E-Mail
          </a>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {primaryDeal && stagesForPrimaryPipeline.length > 0 && (
            <Select
              defaultValue={primaryDeal.stage_id}
              onChange={(e) => {
                updateDealStage(primaryDeal.id, e.target.value).then(onRefresh);
              }}
              className="h-8 w-auto text-xs"
            >
              {stagesForPrimaryPipeline
                .sort((a, b) => a.position - b.position)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={onOpenLinkDeal}>
            + Deal verknüpfen
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(
          [
            ["info", "Kontakt-Info & Call Log"],
            ["activity", "Aktivitäten"],
            ["notes", "Notizen"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`ring-focus flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
              tab === key ? "border-b-2 border-accent text-accent" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {tab === "info" && <InfoTab payload={payload} onRefresh={onRefresh} />}
        {tab === "activity" && <ActivityTab payload={payload} />}
        {tab === "notes" && <NotesTab payload={payload} onRefresh={onRefresh} />}
      </div>
    </>
  );
}

function InfoTab({ payload, onRefresh }: { payload: ContactDetailPayload; onRefresh: () => void }) {
  const { contact, deals } = payload;
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await logCall(contact.id, formData);
      if (result.success) onRefresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Stammdaten</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Position</dt>
            <dd className="text-foreground">{contact.position ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Firma</dt>
            <dd className="text-foreground">{contact.company ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Adresse / Land</dt>
            <dd className="text-foreground">
              {[contact.address, contact.country].filter(Boolean).join(", ") || "—"}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Sales Rep</dt>
            <dd className="text-foreground">
              {contact.assigned_profile
                ? `${contact.assigned_profile.first_name} ${contact.assigned_profile.last_name}`
                : "—"}
            </dd>
          </div>
        </dl>
      </div>

      {deals.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Deals</h3>
          <ul className="flex flex-col gap-1.5">
            {deals.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span className="text-foreground">{d.name}</span>
                <span className="font-medium text-accent">{formatEuro(d.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Anruf protokollieren</h3>
        <form action={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Anruf-Typ</label>
              <Select name="call_type" className="h-8 text-sm">
                <option value="opening_call">Opening-Call</option>
                <option value="follow_up_call">Follow-Up</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Interesse bekundet</label>
              <Select name="interest_expressed" className="h-8 text-sm">
                <option value="">— unklar —</option>
                <option value="true">Ja</option>
                <option value="false">Nein</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Datum/Uhrzeit</label>
            <Input
              type="datetime-local"
              name="called_at"
              defaultValue={new Date().toISOString().slice(0, 16)}
              className="h-8 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Notiz</label>
            <Textarea name="summary" rows={2} required className="text-sm" />
          </div>

          <Button type="submit" disabled={isPending} size="sm" className="self-end">
            {isPending ? "Speichern..." : "Anruf speichern"}
          </Button>
        </form>
      </div>
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
    <ul className="flex flex-col gap-3">
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
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
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

      {payload.notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Notizen.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {payload.notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-border p-3 text-sm">
              <p className="text-foreground">{n.content}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {n.author ? `${n.author.first_name} ${n.author.last_name} · ` : ""}
                {formatDateDE(n.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
