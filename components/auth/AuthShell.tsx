import Logo from "@/components/Logo";

// Gemeinsamer Rahmen der Auth-Seiten (Passwort vergessen / festlegen) im Stil der Login-Seite.
export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-4 dark:bg-zinc-950 sm:p-6">
      <div
        className="pointer-events-none absolute inset-0 text-slate-300/70 dark:text-zinc-800"
        style={{
          backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/15 blur-3xl dark:bg-blue-500/10" />

      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <Logo variant="full" />
          <h1 className="mt-5 text-lg font-semibold text-slate-900 dark:text-zinc-100">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">{subtitle}</p>}
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export const authInputClass =
  "h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500";

export const authButtonClass =
  "h-12 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 dark:focus:ring-offset-zinc-900";
