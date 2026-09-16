// Gemeinsamer Retry-Helper für Resend/WhatsApp: max. 3 Versuche mit exponentiellem
// Backoff (500ms, 1000ms, 2000ms), nur bei 429 (Rate-Limit) oder 5xx (Server-Fehler).
// Andere Fehler (z. B. 400 Validation) werden sofort durchgereicht, da ein Retry
// dort nichts ändern würde.
export class RetryableStatusError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "RetryableStatusError";
    this.status = status;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  { maxAttempts = 3, baseDelayMs = 500 }: { maxAttempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      const isRetryable = error instanceof RetryableStatusError && isRetryableStatus(error.status);
      const isLastAttempt = attempt === maxAttempts;

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      const delay = baseDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
