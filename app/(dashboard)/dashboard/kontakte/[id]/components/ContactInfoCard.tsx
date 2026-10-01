"use client";

import { useState } from "react";
import type { ContactWithRelations } from "../../types";

function CopyableRow({ label, value, href }: { label: string; value: string; href?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href ? (
          <a href={href} className="truncate text-sm text-indigo-600 hover:underline">
            {value}
          </a>
        ) : (
          <p className="truncate text-sm text-foreground">{value}</p>
        )}
      </div>
      <button
        onClick={copy}
        className="shrink-0 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground/70"
        title="Kopieren"
      >
        {copied ? "✓" : "⧉"}
      </button>
    </div>
  );
}

export default function ContactInfoCard({ contact }: { contact: ContactWithRelations }) {
  const address = [contact.address, contact.country].filter(Boolean).join(", ");

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-foreground">Kontaktdaten</h3>
      <div className="divide-y divide-border/60">
        <CopyableRow label="E-Mail" value={contact.email} href={`mailto:${contact.email}`} />
        {contact.phone && (
          <CopyableRow label="Telefon" value={contact.phone} href={`tel:${contact.phone}`} />
        )}
        {contact.company && <CopyableRow label="Firma" value={contact.company} />}
        {contact.position && <CopyableRow label="Position" value={contact.position} />}
        {address && <CopyableRow label="Adresse" value={address} />}
      </div>
    </div>
  );
}
