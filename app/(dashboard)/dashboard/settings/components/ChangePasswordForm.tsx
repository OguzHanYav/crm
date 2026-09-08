"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function ChangePasswordForm({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);

    if (newPassword.length < 6) {
      setFeedback({ type: "error", text: "Das neue Passwort muss mindestens 6 Zeichen lang sein." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: "error", text: "Die neuen Passwörter stimmen nicht überein." });
      return;
    }

    setIsSubmitting(true);
    (async () => {
      const supabase = createClient();

      // Aktuelles Passwort verifizieren: supabase.auth.updateUser() prüft es nicht selbst,
      // daher zuerst über signInWithPassword bestätigen, dass es korrekt ist.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (signInError) {
        setFeedback({ type: "error", text: "Das aktuelle Passwort ist nicht korrekt." });
        setIsSubmitting(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

      if (updateError) {
        setFeedback({ type: "error", text: updateError.message });
        setIsSubmitting(false);
        return;
      }

      setFeedback({ type: "success", text: "Passwort erfolgreich geändert." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsSubmitting(false);
    })();
  }

  return (
    <div className="mt-6 border-t border-border pt-5">
      <h3 className="text-sm font-semibold text-foreground">Passwort ändern</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Aus Sicherheitsgründen benötigen wir dein aktuelles Passwort.
      </p>

      {feedback && (
        <p
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            feedback.type === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
          }`}
        >
          {feedback.text}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="current-password" className="mb-1 block text-xs font-medium text-muted-foreground">Aktuelles Passwort</label>
          <input
            id="current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="ring-focus min-h-[44px] w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
            required
          />
        </div>
        <div>
          <label htmlFor="new-password" className="mb-1 block text-xs font-medium text-muted-foreground">Neues Passwort</label>
          <input
            id="new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="ring-focus min-h-[44px] w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
            minLength={6}
            required
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1 block text-xs font-medium text-muted-foreground">Neues Passwort bestätigen</label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="ring-focus min-h-[44px] w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
            minLength={6}
            required
          />
        </div>
        <div className="sm:col-span-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="ring-focus min-h-[44px] rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:brightness-110 disabled:opacity-50"
          >
            {isSubmitting ? "Wird geändert..." : "Passwort ändern"}
          </button>
        </div>
      </form>
    </div>
  );
}
