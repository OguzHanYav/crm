// Wandelt eine im CRM gespeicherte Telefonnummer in ein wählbares Ziel um:
// "+49 172 9754…" / "0049 172…" / "0172 …" -> "+49172…" (E.164).
// Kurze Nummern (interne Durchwahlen wie "1002", Echo-Test "600") bleiben unverändert.
// Die Umsetzung ins Format des SIP-Anbieters macht der Dialplan der Telefonanlage.
export function toDialTarget(raw: string, defaultCountryCode: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (hasPlus) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.length <= 5) return digits;
  if (digits.startsWith("0")) return `+${defaultCountryCode}${digits.slice(1)}`;
  // Ohne führende 0/+ ist die Nummer vermutlich schon international ohne "+".
  return `+${digits}`;
}
