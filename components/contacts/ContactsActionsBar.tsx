"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCrmStore } from "@/lib/store/useCrmStore";
import { deleteContactsByAdmin } from "@/app/(dashboard)/dashboard/kontakte/actions";
import SendNotificationModal from "./SendNotificationModal";

export default function ContactsActionsBar({ isAdmin = false }: { isAdmin?: boolean }) {
  const selectedContactIds = useCrmStore((s) => s.selectedContactIds);
  const clearContactSelection = useCrmStore((s) => s.clearContactSelection);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const router = useRouter();
  const queryClient = useQueryClient();

  function handleDelete() {
    const count = selectedContactIds.length;
    const confirmed = window.confirm(
      `${count} Kontakt${count === 1 ? "" : "e"} wirklich löschen?\n\n` +
        "Zugehörige Deals, Notizen und Anrufe werden ebenfalls gelöscht. Das kann nicht rückgängig gemacht werden."
    );
    if (!confirmed) return;

    startDelete(async () => {
      const result = await deleteContactsByAdmin(selectedContactIds);
      if (!result.success) {
        alert(result.message ?? "Löschen fehlgeschlagen.");
        return;
      }
      clearContactSelection();
      // Tabelle lädt über useInfiniteQuery (Cache-Key "contacts") — den Cache
      // verwerfen, sonst blieben gelöschte Zeilen bis zum staleTime-Ablauf sichtbar.
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      router.refresh();
    });
  }

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
          {isAdmin && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="ring-focus min-h-[40px] rounded-xl border border-danger/40 bg-transparent px-3 py-2 text-sm font-medium text-danger transition-all hover:bg-danger/10 disabled:opacity-50"
            >
              {isDeleting ? "Wird gelöscht…" : "Löschen"}
            </button>
          )}
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
