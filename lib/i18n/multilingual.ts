import { COUNTRY_NAME_GROUPS } from "./country-names";
import { INDUSTRY_TERM_GROUPS, INDUSTRY_STOPWORDS } from "./industry-terms";

// Sprachunabhängiger Vergleich für Filter/Suche: Die UI ist deutsch, die Daten in
// der DB sind oft türkisch ("Almanya", "Döner Üretimi"). Statt einer (langsamen,
// kostenpflichtigen, nicht-deterministischen) Übersetzungs-API wird jeder Wert auf
// einen sprachneutralen Schlüssel abgebildet; eine explizite Spracherkennung ist
// dadurch unnötig, weil Eingabe und DB-Wert gegen ALLE bekannten Varianten laufen.

// Kleinschreibung + Diakritika entfernen, türkisch-/deutsch-sicher:
// "İSVİÇRE" / "İsviçre" / "isvicre" -> "isvicre", "Großhandel" -> "grosshandel".
export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return value.split(/[\s/,;()\-–]+/).filter(Boolean);
}

// ==================== LÄNDER ====================

// gefalteter Name (jede Sprache) -> deutscher Name aus COUNTRIES
const countryByFolded = new Map<string, string>();
for (const [de, names] of Object.entries(COUNTRY_NAME_GROUPS)) {
  for (const name of names) countryByFolded.set(foldText(name), de);
}

// Deutscher Name eines Landes, egal in welcher Sprache es gespeichert ist
// ("Almanya" -> "Deutschland"); unbekannte Werte fallen auf die gefaltete Form zurück.
export function countryKey(value: string | null | undefined): string {
  if (!value) return "";
  const folded = foldText(value);
  return countryByFolded.get(folded) ?? folded;
}

// Alle bekannten Bezeichnungen eines Landes — für die Volltextsuche.
export function countrySearchTerms(value: string | null | undefined): string[] {
  if (!value) return [];
  const de = countryByFolded.get(foldText(value));
  return de ? COUNTRY_NAME_GROUPS[de] : [value];
}

// ILIKE-Muster für die serverseitige Vorauswahl (Postgres kennt foldText nicht):
// Sonderzeichen und i/I (wegen İ/ı) werden zum Einzelzeichen-Joker "_", damit
// "Türkiye", "Turkiye" und "TÜRKİYE" alle über "%t_rk__ye%" gefunden werden.
// Bewusst etwas zu großzügig — der Client prüft danach exakt per countryKey().
export function countryIlikePatterns(value: string): string[] {
  const de = countryByFolded.get(foldText(value));
  const names = de ? COUNTRY_NAME_GROUPS[de] : [value.trim()];
  return Array.from(
    new Set(
      names.map((name) => {
        const pattern = name.trim().replace(/[^A-Za-z0-9 ]|[iI]/g, "_");
        // Kürzel wie "DE"/"TR"/"ABD" exakt, sonst träfe "%de%" fast jedes Land.
        return pattern.length <= 3 ? pattern : `%${pattern}%`;
      })
    )
  );
}

// ==================== BRANCHEN ====================

const stopwords = new Set(INDUSTRY_STOPWORDS.map(foldText));
// gefaltetes Wort bzw. Mehrwort-Begriff (z. B. "sut urunleri") -> Wortgruppe (erster Eintrag = Deutsch)
const industryGroupByFolded = new Map<string, string[]>();
for (const group of INDUSTRY_TERM_GROUPS) {
  for (const term of group) industryGroupByFolded.set(foldText(term), group);
}
const maxPhraseWords = Math.max(...INDUSTRY_TERM_GROUPS.flat().map((t) => tokenize(t).length));

type IndustryToken = { raw: string; group: string[] | null };

// Zerlegt eine Branche in Wörter und ordnet sie (längster Treffer zuerst, damit
// Mehrwort-Begriffe wie "Süt Ürünleri" greifen) den Wörterbuch-Gruppen zu.
function parseIndustry(value: string): IndustryToken[] {
  const words = tokenize(value).filter((w) => !stopwords.has(foldText(w)));
  const result: IndustryToken[] = [];
  let i = 0;
  while (i < words.length) {
    let matched = false;
    for (let len = Math.min(maxPhraseWords, words.length - i); len > 0; len--) {
      const phrase = words.slice(i, i + len).join(" ");
      const group = industryGroupByFolded.get(foldText(phrase));
      if (group) {
        result.push({ raw: phrase, group });
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result.push({ raw: words[i], group: null });
      i++;
    }
  }
  return result;
}

// Sprachneutraler Schlüssel: "Döner Üretimi" und "Döner Produktion" -> identisch.
// Wortreihenfolge ist egal, da sie zwischen Deutsch und Türkisch abweichen kann.
export function industryKey(value: string | null | undefined): string {
  if (!value) return "";
  return parseIndustry(value)
    .map((t) => foldText(t.group ? t.group[0] : t.raw))
    .sort()
    .join(" ");
}

// Deutsche Anzeigeform ("Döner Üretimi" -> "Döner Produktion"); unbekannte Wörter bleiben stehen.
export function industryLabel(value: string): string {
  return parseIndustry(value)
    .map((t) => (t.group ? t.group[0] : t.raw))
    .join(" ");
}

// Originalwert + alle Übersetzungen seiner Wörter — für die Volltextsuche.
export function industrySearchTerms(value: string | null | undefined): string[] {
  if (!value) return [];
  return [value, ...parseIndustry(value).flatMap((t) => t.group ?? [])];
}

// ==================== SUCHE ====================

// Jedes Suchwort muss (als Teilstring) irgendwo im gefalteten Suchtext vorkommen —
// so findet "deutschland döner" auch einen Deal mit "Almanya" + "Döner Üretimi".
export function matchesSearch(foldedHaystack: string, term: string): boolean {
  const words = tokenize(foldText(term));
  return words.every((w) => foldedHaystack.includes(w));
}
