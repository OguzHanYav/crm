"use client";

function IconSearch() {
  return (
    <svg
      className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  );
}

// Alle ungenutzten Dropdown-Platzhalter ("Filter", "Spalten-Optionen",
// "Mehr Optionen" ohne Funktion) sowie der globale "Deal erstellen"-Button
// wurden entfernt (Deals entstehen nur noch aus der Kontaktansicht).
export default function DealsActionsBar({
  search,
  onSearchChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-sm">
        <IconSearch />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Suche nach Name, E-Mail, Firma, Telefon oder Land"
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
      </div>
    </div>
  );
}