function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function TotalValueCard({
  totalValue,
}: {
  totalValue: number;
  currency: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 shadow-sm">
      <p className="text-xs font-medium text-gray-500">Gesamtwert der Pipeline</p>
      <p className="text-lg font-semibold text-gray-900">{formatEuro(totalValue)}</p>
    </div>
  );
}
