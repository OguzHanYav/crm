"use client";

import { useState } from "react";
import { useCrmStore } from "@/lib/store/useCrmStore";
import SendNotificationModal from "./SendNotificationModal";

export default function ContactsActionsBar() {
  const selectedContactIds = useCrmStore((s) => s.selectedContactIds);
  const clearContactSelection = useCrmStore((s) => s.clearContactSelection);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (selectedContactIds.length === 0) return null;

  return (
    <>
      <div className="sticky bottom-4 z-30 flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
        <span className="text-sm font-medium text-foreground">
          {selectedContactIds.length} Kontakt{selectedContactIds.length === 1 ? "" : "e"} ausgewählt
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearContactSelection}
            className="ring-focus min-h-[40px] rounded-xl border border-border bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-muted/50"
          >
            Auswahl aufheben
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="ring-focus flex min-h-[40px] items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.98]"
          >
            Nachricht senden (E-Mail / WhatsApp)
          </button>
        </div>
      </div>

      {isModalOpen && (
        <SendNotificationModal
          contactIds={selectedContactIds}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            clearContactSelection();
          }}
        />
      )}
    </>
  );
}
