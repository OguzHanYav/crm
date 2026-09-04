import type { CallLog } from "../../types";

function formatDateDE(dateString: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

const CALL_TYPE_LABELS: Record<string, string> = {
  opening_call: "Opening-Call",
  follow_up_call: "Follow-Up",
};

export default function CallHistoryList({ callLogs }: { callLogs: CallLog[] }) {
  if (callLogs.length === 0) {
    return <p className="text-sm text-gray-400">Noch keine Anrufe protokolliert.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {callLogs.map((call) => (
        <li key={call.id} className="rounded-md border border-gray-200 px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-800">
              {call.author ? `${call.author.first_name} ${call.author.last_name}` : "Unbekannt"}
            </p>
            <span className="text-xs text-gray-400">{formatDateDE(call.called_at)}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
              {CALL_TYPE_LABELS[call.call_type] || call.call_type}
            </span>
            {call.interest_expressed !== null && (
              <span className={`rounded-full px-2 py-0.5 text-xs ${call.interest_expressed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                Interesse: {call.interest_expressed ? "Ja" : "Nein"}
              </span>
            )}
          </div>
          {call.notes && <p className="mt-1 text-gray-600">{call.notes}</p>}
          <p className="mt-1 text-xs text-gray-400">{formatDateDE(call.created_at)}</p>
        </li>
      ))}
    </ul>
  );
}
