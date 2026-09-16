// Wie viele Job-Items ein einzelner /process-Call abarbeitet, bevor er dem
// Frontend zurückgibt (das dann erneut triggert). Bei Hobby-Plan (maxDuration
// wird auf 10s begrenzt) auf 5 reduzieren — siehe MANUAL SETUP.
export const JOB_BATCH_SIZE = 20;

// Polling-Intervall im SendNotificationModal für den Live-Fortschritt.
export const JOB_POLL_INTERVAL_MS = 2000;

// Wie lange ein Job für einen /process-Call gelockt bleibt (siehe
// acquireJobLock in notification-queue.ts) — verhindert, dass zwei parallele
// Calls (z. B. durch den Self-Trigger im Frontend) dieselben Items doppelt
// abarbeiten.
export const JOB_LOCK_DURATION_MS = 2 * 60 * 1000;

// Ab dieser Kontaktzahl zeigt das Modal den Hinweis "läuft im Hintergrund".
export const BULK_WARNING_THRESHOLD = 50;

// Ab dieser Kontaktzahl zeigt das Modal die Spam-Warnung für neue Domains.
export const BULK_STRONG_WARNING_THRESHOLD = 500;
