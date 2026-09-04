"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Note, CallLog } from "../../types";
import { addNoteToContact } from "../../actions";

type TimelineItem =
  | { type: "note"; id: string; created_at: string; content: string; author: Note["author"] }
  | {
      type: "call";
      id: string;
      created_at: string;
      call_type: string;
      call_result: string;
      call_date: string;
      call_time: string;
      notes: string | null;
      author: CallLog["author"];
    };

function formatDateDE(dateString: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

// Call-Typen für die Anzeige
const CALL_TYPE_LABELS: Record<string, string> = {
  setting_call: "Setting Call",
  closing_call: "Closing Call",
  follow_up_call: "Follow-up",
};

const CALL_RESULT_LABELS: Record<string, string> = {
  gatekeeper_reached: "Gatekeeper erreicht",
  interested: "Interessiert",
  appointment_booked: "Termin vereinbart",
  no_interest: "Kein Interesse",
  no_answer: "Nicht erreicht",
};

export default function ActivityTimeline({
  contactId,
  notes,
  callLogs,
}: {
  contactId: string;
  notes: Note[];
  callLogs: CallLog[];
}) {
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const items: TimelineItem[] = [
    ...notes.map((n) => ({
      type: "note" as const,
      id: n.id,
      created_at: n.created_at,
      content: n.content,
      author: n.author,
    })),
    ...callLogs.map((c) => ({
      type: "call" as const,
      id: c.id,
      created_at: c.created_at,
      call_type: c.call_type,
      call_result: c.call_result,
      call_date: c.call_date,
      call_time: c.call_time,
      notes: c.notes,
      author: c.author,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  function submitNote() {
    const trimmed = text.trim();
    if (!trimmed) return;

    startTransition(async () => {
      const result = await addNoteToContact(contactId, trimmed);
      if (result.success) {
        setText("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitNote();
          }}
          placeholder="Neue Notiz hinzufügen..."
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          onClick={submitNote}
          disabled={isPending || !text.trim()}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? "..." : "Hinzufügen"}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400">Noch keine Aktivitäten.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={`${item.type}-${item.id}`} className="flex gap-3 text-sm">
              <span className="mt-0.5 shrink-0">{item.type === "call" ? "📞" : "📝"}</span>
              <div className="min-w-0">
                {item.type === "call" ? (
                  <>
                    <p className="text-gray-800">
                      <span className="font-medium">
                        {CALL_TYPE_LABELS[item.call_type] || item.call_type}
                      </span>
                      {" · "}
                      <span className="text-gray-600">
                        {CALL_RESULT_LABELS[item.call_result] || item.call_result}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.call_date} {item.call_time}
                    </p>
                    {item.notes && (
                      <p className="mt-1 text-gray-600">{item.notes}</p>
                    )}
                  </>
                ) : (
                  <p className="text-gray-800">{item.content}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  {item.author ? `${item.author.first_name} ${item.author.last_name} · ` : ""}
                  {formatDateDE(item.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
