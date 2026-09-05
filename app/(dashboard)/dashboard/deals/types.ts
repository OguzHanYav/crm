export type Pipeline = {
  id: string;
  name: string;
  description: string | null;
};

export type DealStage = {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color: string;
};

// Neue, projekt-gebundene Pipeline-Phase (ersetzt DealStage schrittweise).
export type PipelineStage = {
  id: string;
  project_id: string;
  name: string;
  position: number;
  is_visible: boolean;
  color: string;
};

export type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  website?: string | null;
  country?: string | null;
  last_contacted_at?: string | null;
};

export type TeamMember = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
};

export type Deal = {
  id: string;
  name: string;
  pipeline_id: string;
  stage_id: string;
  project_id: string;
  pipeline_stage_id: string | null;
  contact_id: string | null;
  assigned_to: string | null;
  value: number;
  created_at: string;
  contact: Contact | null;
  assigned_profile: TeamMember | null;
};

export type StageHistoryEntry = {
  id: string;
  deal_id: string;
  from_stage_id: string | null;
  to_stage_id: string | null;
  changed_at: string;
  from_stage: { name: string } | null;
  to_stage: { name: string } | null;
};