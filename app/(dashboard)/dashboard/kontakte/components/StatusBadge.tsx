import type { ContactStatus } from "../types";

const STATUS_STYLES: Record<ContactStatus, string> = {
  Lead: "bg-blue-100 text-blue-700",
  "In Kontakt": "bg-amber-100 text-amber-700",
  Kunde: "bg-green-100 text-green-700",
  Verloren: "bg-red-100 text-red-700",
};

export default function StatusBadge({ status }: { status: ContactStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {status}
    </span>
  );
}
