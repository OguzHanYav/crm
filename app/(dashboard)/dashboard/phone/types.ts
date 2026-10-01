export type PhoneStatus = "active" | "inactive" | "connecting";

export const PHONE_STATUS_LABELS: Record<PhoneStatus, string> = {
  active: "Aktiv",
  inactive: "Inaktiv",
  connecting: "Verbindet",
};

export type PhoneNumber = {
  id: string;
  org_id: string | null;
  number: string;
  label: string | null;
  assigned_user_id: string | null;
  status: PhoneStatus;
  created_at: string;
};

export type PhoneNumberInput = {
  number: string;
  label: string;
  assignedUserId: string | null;
  status: PhoneStatus;
};

export type MemberOption = { id: string; name: string; role: string };
