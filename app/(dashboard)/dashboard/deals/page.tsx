import { getPipelinePhases, getAllDeals, getDealsTotalCount, getPhaseCounts } from "./data";
import DealsView from "./components/DealsView";
import { isCurrentUserAdmin } from "../settings/admin-actions";
import ContactDetailSheet from "@/components/contacts/ContactDetailSheet";

export default async function DealsPage() {
  const [phases, deals, totalCount, isAdmin] = await Promise.all([
    getPipelinePhases(),
    getAllDeals(),
    getDealsTotalCount(),
    isCurrentUserAdmin(),
  ]);
  const phaseCounts = await getPhaseCounts(phases);

  return (
    <>
      <DealsView
        projectName="Pipeline"
        phases={phases}
        deals={deals}
        totalCount={totalCount}
        phaseCounts={phaseCounts}
        isAdmin={isAdmin}
      />
      <ContactDetailSheet />
    </>
  );
}
