import { getPipelinePhases, getAllDeals, getDealsTotalCount, getPhaseCounts } from "./data";
import DealsView from "./components/DealsView";
import ContactDetailSheet from "@/components/contacts/ContactDetailSheet";

export default async function DealsPage() {
  const [phases, deals, totalCount] = await Promise.all([
    getPipelinePhases(),
    getAllDeals(),
    getDealsTotalCount(),
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
      />
      <ContactDetailSheet />
    </>
  );
}
