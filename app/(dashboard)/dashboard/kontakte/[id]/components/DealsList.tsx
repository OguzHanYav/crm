import Link from "next/link";
import type { ContactDeal } from "../../types";

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DealsList({ deals }: { deals: ContactDeal[] }) {
  if (deals.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine verknüpften Deals.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {deals.map((deal) => (
        <li key={deal.id}>
          <Link
            href={`/dashboard/deals?pipeline=${deal.pipeline_id}`}
            className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{deal.name}</p>
              <p className="text-xs text-muted-foreground">
                {deal.pipeline?.name} · {deal.stage?.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {deal.stage?.color && (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: deal.stage.color }}
                />
              )}
              <span className="font-semibold text-indigo-600">{formatEuro(deal.value)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
