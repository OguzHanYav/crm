// Tageszeit-Begrüßung (Server und Client): 05:00–11:59 Morgen, 12:00–17:59 Tag,
// 18:00–04:59 Abend. Bewusst kein "use client"-Modul, damit auch die
// Server-Komponente die Funktion direkt aufrufen kann.
export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "Guten Morgen";
  if (hour >= 12 && hour < 18) return "Guten Tag";
  return "Guten Abend";
}
