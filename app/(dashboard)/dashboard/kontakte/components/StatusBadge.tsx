import { Badge, STATUS_TONE_MAP } from "@/components/ui/Badge";
import type { ContactStatus } from "../types";

export default function StatusBadge({ status }: { status: ContactStatus }) {
  return <Badge tone={STATUS_TONE_MAP[status] ?? "default"}>{status}</Badge>;
}
