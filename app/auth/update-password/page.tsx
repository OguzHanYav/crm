"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import AuthShell, { authButtonClass, authInputClass } from "@/components/auth/AuthShell";

const MIN_PASSWORD_LENGTH = 8;

type LinkState = "checking" | "ready" | "invalid";

// Ziel der Supabase-Mails "Passwort zurücksetzen" und "Einladung". Unterstützt
// alle Link-Formate von Supabase:
//   ?code=…                (PKCE — Reset aus diesem Browser angefordert)
//   ?token_hash=…&type=…   (eigene E-Mail-Vorlage mit {{ .TokenHash }})
//   #access_token=…        (Einladung durch Admin — implizite Sitzung)
// Danach wird mit der so entstandenen Sitzung das neue Passwort gesetzt.
export default function UpdatePasswordPage() {
  const router = useRouter();
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isInvite, setIsInvite] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = (url.searchParams.get("type") ?? hash.get("type")) as EmailOtpType | null;
      const linkErrorText = url.searchParams.get("error_description") ?? hash.get("error_description");
      setIsInvite(type === "invite" || type === "signup");

      try {
        if (linkErrorText) throw new Error(linkErrorText);

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (tokenHash && type) {
          const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
          if (otpError) throw otpError;
        } else if (hash.get("access_token") && hash.get("refresh_token")) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: hash.get("access_token") as string,
            refresh_token: hash.get("refresh_token") as string,
          });
          if (sessionError) throw sessionError;
        }

        // Tokens nicht in der Adressleiste/Historie stehen lassen.
        if (code || tokenHash || url.hash) window.history.replaceState(null, "", url.pathname);

        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new Error("no session");
        setLinkState("ready");
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        console.error("update-password link error:", message);
        setLinkError(
          /code verifier|both auth code and code verifier/i.test(message)
            ? "Bitte öffne den Link im selben Browser, in dem du ihn angefordert hast — oder fordere einen neuen an."
            : "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an."
        );
        setLinkState("invalid");
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`);
      return;
    }
    if (password !== confirm) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(
        /different from the old|same password/i.test(updateError.message)
          ? "Das neue Passwort muss sich vom bisherigen unterscheiden."
          : `Passwort konnte nicht gespeichert werden: ${updateError.message}`
      );
      return;
    }

    setDone(true);
    setTimeout(() => {
      router.replace("/dashboard");
      router.refresh();
    }, 1500);
  }

  return (
    <AuthShell
      title={isInvite ? "Willkommen! Passwort festlegen" : "Neues Passwort festlegen"}
      subtitle={linkState === "ready" ? "Wähle ein sicheres Passwort mit mindestens 8 Zeichen." : undefined}
    >
      {linkState === "checking" && <p className="text-center text-sm text-slate-500 dark:text-zinc-400">Link wird geprüft …</p>}

      {linkState === "invalid" && (
        <div className="flex flex-col gap-4">
          <p className="rounded-lg bg-red-500/10 px-3 py-3 text-sm text-red-600 dark:text-red-400">{linkError}</p>
          <Link href="/auth/reset-password" className={`flex items-center justify-center ${authButtonClass}`}>
            Neuen Link anfordern
          </Link>
          <Link href="/login" className="text-center text-sm text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            Zurück zur Anmeldung
          </Link>
        </div>
      )}

      {linkState === "ready" && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor="new-password" className="sr-only">
            Neues Passwort
          </label>
          <input
            id="new-password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Neues Passwort"
            className={authInputClass}
          />
          <label htmlFor="confirm-password" className="sr-only">
            Passwort bestätigen
          </label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Passwort bestätigen"
            className={authInputClass}
          />

          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button type="submit" disabled={saving || done} className={`mt-1 ${authButtonClass}`}>
            {saving ? "Wird gespeichert …" : "Passwort speichern"}
          </button>
        </form>
      )}

      {/* Bestätigungs-Toast */}
      {done && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg"
        >
          Passwort gespeichert — du wirst weitergeleitet …
        </div>
      )}
    </AuthShell>
  );
}
