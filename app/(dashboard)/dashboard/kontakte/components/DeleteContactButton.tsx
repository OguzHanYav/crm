"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteContact } from "../actions";

export default function DeleteContactButton({
  contactId,
  onDone,
}: {
  contactId: string;
  onDone?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    const confirmed = window.confirm(
      "Diesen Kontakt wirklich löschen? Das kann nicht rückgängig gemacht werden."
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteContact(contactId);
      onDone?.();
      if (!result.success) {
        alert(result.message ?? "Löschen fehlgeschlagen.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {isPending ? "Wird gelöscht..." : "Löschen"}
    </button>
  );
}
