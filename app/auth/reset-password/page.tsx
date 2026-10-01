"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import AuthShell, { authButtonClass, authInputClass } from "@/components/auth/AuthShell";

// "Passwort vergessen?": Supabase schickt einen Link, der auf /auth/update-password führt.
export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("sending");

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    // Aus Sicherheitsgründen immer dieselbe Bestätigung — sonst ließe sich
    // herausfinden, welche E-Mail-Adressen ein Konto haben. Nur Rate-Limits melden.
    if (resetError && /rate|too many|seconds/i.test(resetError.message)) {
      setError("Zu viele Anfragen. Bitte in ein paar Minuten erneut versuchen.");
      setStatus("idle");
      return;
    }
    if (resetError) console.error("resetPasswordForEmail error:", resetError.message);
    setStatus("sent");
  }

  return (
    <AuthShell
      title="Passwort vergessen?"
      subtitle="Gib deine E-Mail-Adresse ein. Wir senden dir einen Link zum Zurücksetzen."
    >
      {status === "sent" ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-lg bg-green-500/10 px-3 py-3 text-sm text-green-700 dark:text-green-400">
            Falls ein Konto mit <strong>{email.trim()}</strong> existiert, ist der Link unterwegs. Bitte prüfe auch den
            Spam-Ordner. Öffne den Link im selben Browser.
          </p>
          <Link href="/login" className="text-center text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
            Zurück zur Anmeldung
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor="reset-email" className="sr-only">
            E-Mail
          </label>
          <input
            id="reset-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-Mail"
            className={authInputClass}
          />

          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button type="submit" disabled={status === "sending"} className={`mt-1 ${authButtonClass}`}>
            {status === "sending" ? "Wird gesendet …" : "Zurücksetzen-Link senden"}
          </button>

          <Link
            href="/login"
            className="mt-2 text-center text-sm text-slate-600 transition-colors hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Zurück zur Anmeldung
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
