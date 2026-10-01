// Marken-Logo "OY LeadFlow": blaues Badge mit "OY" (+ Schriftzug "LeadFlow" in
// der Variante "full"). Farben über Theme-Tokens, passt sich Light/Dark an.
export default function Logo({
  variant = "full",
  className = "",
}: {
  variant?: "full" | "collapsed";
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label="OY LeadFlow">
      <span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-accent px-2.5 py-1 text-sm font-bold tracking-tight text-accent-foreground shadow-sm">
        OY
      </span>
      {variant === "full" && (
        <span className="text-lg font-semibold tracking-tight text-foreground">LeadFlow</span>
      )}
    </span>
  );
}
