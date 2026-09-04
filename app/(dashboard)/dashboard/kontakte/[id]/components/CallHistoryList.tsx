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
            <span className="text-xs text-gray-400">{formatDateDE(call.created_at)}</span>
          </div>
          <p className="mt-1 text-gray-600">{call.summary}</p>
          {call.duration_minutes != null && (
            <p className="mt-1 text-xs text-gray-400">Dauer: {call.duration_minutes} Min.</p>
          )}
        </li>
      ))}
    </ul>
  );
}
