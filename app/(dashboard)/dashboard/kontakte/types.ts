export type ContactStatus = "Lead" | "In Kontakt" | "Kunde" | "Verloren";

export type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  position: string | null;
  address: string | null;
  country: string | null;
  status: ContactStatus;
  notes: string | null;
  assigned_to: string | null;
  last_contacted_at: string | null;
  created_at: string;
};

export type ContactWithRelations = Contact & {
  assigned_profile: { id: string; first_name: string; last_name: string } | null;
};

export type Note = {
  id: string;
  contact_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
  author: { id: string; first_name: string; last_name: string } | null;
};

export type CallLog = {
  id: string;
  contact_id: string;
  user_id: string | null;
  call_type: string;  // z.B. 'setting_call', 'closing_call', 'follow_up_call'
  call_result: string;  // z.B. 'gatekeeper_reached', 'appointment_booked', etc.
  call_date: string;
  call_time: string;
  notes: string | null;
  created_at: string;
  author: { id: string; first_name: string; last_name: string } | null;
};

export type ContactDeal = {
  id: string;
  title: string;
  value: number;
  currency: string;
  stage_id: string;
  pipeline_id: string;
  stage: { name: string; color: string } | null;
  pipeline: { name: string } | null;
};

export type TeamMember = {
  id: string;
  first_name: string;
  last_name: string;
};

export const CONTACT_STATUSES: ContactStatus[] = [
  "Lead",
  "In Kontakt",
  "Kunde",
  "Verloren",
];
