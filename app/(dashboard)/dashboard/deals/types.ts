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

export type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
};

export type TeamMember = {
  id: string;
  full_name: string;
  role: string;
};

export type Deal = {
  id: string;
  title: string;
  pipeline_id: string;
  stage_id: string;
  contact_id: string | null;
  assigned_to: string | null;
  value: number;
  currency: string;
  created_at: string;
  contact: Contact | null;
  assigned_profile: TeamMember | null;
};
