import { LOGO_MARK_PATH, LOGO_MARK_VIEWBOX } from "@/components/brand/logo-mark";

// Marken-Logo "OY LeadFlow": blaues Badge mit der geometrischen OY-Bildmarke (+ Schriftzug "LeadFlow" in
// der Variante "full"). Farben über Theme-Tokens, passt sich Light/Dark an.
export default function Logo({
  variant = "full",
  className = "",
}: {
  variant?: "full" | "collapsed";
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center ${className}`} aria-label="LeadFlow">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent p-1.5 text-accent-foreground shadow-sm ring-1 ring-inset ring-white/10">
        <svg viewBox={LOGO_MARK_VIEWBOX} className="h-[30px] w-[30px]" aria-hidden>
          <path d={LOGO_MARK_PATH} fill="currentColor" fillRule="evenodd" />
        </svg>
      </span>
      {variant === "full" && (
        <span className="ml-2.5 text-xl font-bold tracking-tight text-foreground">LeadFlow</span>
      )}
    </span>
  );
}
