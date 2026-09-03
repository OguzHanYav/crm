export type ContactStatus = "Lead" | "In Kontakt" | "Kunde" | "Verloren";

export type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  status: ContactStatus;
  notes: string | null;
  created_at: string;
};

export const CONTACT_STATUSES: ContactStatus[] = [
  "Lead",
  "In Kontakt",
  "Kunde",
  "Verloren",
];
