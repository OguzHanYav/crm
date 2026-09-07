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
  // Aktuelle Pipeline-Phase des (jüngsten) verknüpften Deals, falls vorhanden.
  currentStage?: { name: string; color: string } | null;
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

export type CallType = "opening_call" | "follow_up_call";

export type CallLog = {
  id: string;
  contact_id: string;
  user_id: string | null;
  call_type: CallType;
  interest_expressed: boolean | null;
  called_at: string;
  notes: string | null;
  created_at: string;
  author: { id: string; first_name: string; last_name: string } | null;
};

export type ContactDeal = {
  id: string;
  name: string;
  value: number;
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

// Fasst deal_stages mit gleichem Namen über alle Pipelines hinweg zu einer Phase
// zusammen (siehe deals/data.ts getPipelinePhases) — nur aktive Phasen sind wählbar.
export type PipelinePhase = {
  key: string;
  name: string;
  color: string;
  stageIds: string[];
  defaultStageId: string;
};

export type ContactSheetBootstrap = {
  teamMembers: TeamMember[];
  pipelines: { id: string; name: string }[];
  stages: { id: string; pipeline_id: string; name: string; position: number; color: string }[];
  phases: PipelinePhase[];
};

export type ContactDetailPayload = {
  contact: ContactWithRelations;
  notes: Note[];
  callLogs: CallLog[];
  deals: ContactDeal[];
  stageHistory: any[];
};

export const CONTACT_STATUSES: ContactStatus[] = [
  "Lead",
  "In Kontakt",
  "Kunde",
  "Verloren",
];

export type DealStatusFilter = "offen" | "gewonnen" | "verloren";

// Sortierschlüssel für die Kontakte-Tabelle — wird serverseitig in der Supabase-Query
// angewendet (vor .range()), damit "Mehr laden" den global sortierten Bestand
// fortsetzt statt nur die lokal geladenen 100 Zeilen umzusortieren.
export type ContactSortKey = "name" | "company" | "country" | "email" | "phone" | "status" | "createdAt";
export type SortDir = "asc" | "desc";

export type ContactFilters = {
  q?: string;
  status?: ContactStatus;
  company?: string;
  dateFrom?: string;
  dateTo?: string;
  dealStatus?: DealStatusFilter;
  eventCategory?: CallType;
};
