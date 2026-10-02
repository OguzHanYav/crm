import { COUNTRIES } from "./countries";

// Internationale Vorwahlen -> Ländername (wie in COUNTRIES). Häufige zuerst.
// Bei mehrfach vergebenen Vorwahlen (+1, +7) gilt der erste Eintrag beim Erkennen.
const RAW: [string, string][] = [
  ["+49", "Deutschland"],
  ["+43", "Österreich"],
  ["+41", "Schweiz"],
  ["+90", "Türkei"],
  ["+423", "Liechtenstein"],
  ["+352", "Luxemburg"],
  ["+31", "Niederlande"],
  ["+32", "Belgien"],
  ["+33", "Frankreich"],
  ["+39", "Italien"],
  ["+34", "Spanien"],
  ["+351", "Portugal"],
  ["+44", "Vereinigtes Königreich"],
  ["+353", "Irland"],
  ["+45", "Dänemark"],
  ["+46", "Schweden"],
  ["+47", "Norwegen"],
  ["+358", "Finnland"],
  ["+48", "Polen"],
  ["+420", "Tschechien"],
  ["+421", "Slowakei"],
  ["+36", "Ungarn"],
  ["+386", "Slowenien"],
  ["+385", "Kroatien"],
  ["+387", "Bosnien und Herzegowina"],
  ["+381", "Serbien"],
  ["+382", "Montenegro"],
  ["+383", "Kosovo"],
  ["+389", "Nordmazedonien"],
  ["+355", "Albanien"],
  ["+30", "Griechenland"],
  ["+357", "Zypern"],
  ["+40", "Rumänien"],
  ["+359", "Bulgarien"],
  ["+373", "Moldau"],
  ["+380", "Ukraine"],
  ["+7", "Russland"],
  ["+994", "Aserbaidschan"],
  ["+995", "Georgien"],
  ["+374", "Armenien"],
  ["+971", "Vereinigte Arabische Emirate"],
  ["+966", "Saudi-Arabien"],
  ["+974", "Katar"],
  ["+965", "Kuwait"],
  ["+973", "Bahrain"],
  ["+968", "Oman"],
  ["+964", "Irak"],
  ["+98", "Iran"],
  ["+963", "Syrien"],
  ["+961", "Libanon"],
  ["+962", "Jordanien"],
  ["+972", "Israel"],
  ["+20", "Ägypten"],
  ["+212", "Marokko"],
  ["+213", "Algerien"],
  ["+216", "Tunesien"],
  ["+1", "Vereinigte Staaten"],
  ["+52", "Mexiko"],
  ["+55", "Brasilien"],
  ["+91", "Indien"],
  ["+92", "Pakistan"],
  ["+86", "China"],
  ["+81", "Japan"],
  ["+82", "Südkorea"],
  ["+61", "Australien"],
  ["+27", "Südafrika"],
  ["+234", "Nigeria"],
];

export const DIAL_CODES: { code: string; country: string }[] = RAW.filter(([, country]) => COUNTRIES.includes(country)).map(
  ([code, country]) => ({ code, country })
);

// Längste passende Vorwahl gewinnt (+423 vor +42…, +1 nur wenn nichts Längeres passt).
const BY_LENGTH = [...DIAL_CODES].sort((a, b) => b.code.length - a.code.length);

// Erkannte Vorwahl einer internationalen Eingabe ("+43 664…" / "0043…") inkl.
// restlicher Rufnummer — für das automatische Umspringen des Vorwahl-Selects.
export function splitInternationalNumber(input: string): { code: string; rest: string } | null {
  const normalized = input.trim().replace(/^00/, "+");
  if (!normalized.startsWith("+")) return null;
  const digits = normalized.replace(/[\s()/.-]/g, "");
  const match = BY_LENGTH.find((d) => digits.startsWith(d.code));
  if (!match) return null;
  // Rest ab der ersten Ziffer nach der Vorwahl (Formatierung des Nutzers bleibt erhalten).
  let seen = 0;
  let index = 0;
  const codeDigits = match.code.length; // inkl. "+"
  for (; index < normalized.length && seen < codeDigits; index++) {
    if (/[+\d]/.test(normalized[index])) seen++;
  }
  return { code: match.code, rest: normalized.slice(index).trimStart() };
}

export function countryFromPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const normalized = phone.trim().replace(/^00/, "+").replace(/[\s()/.-]/g, "");
  if (!normalized.startsWith("+")) return null;
  return BY_LENGTH.find((d) => normalized.startsWith(d.code))?.country ?? null;
}

export function dialCodeForCountry(country: string | null | undefined): string | null {
  return DIAL_CODES.find((d) => d.country === country)?.code ?? null;
}
