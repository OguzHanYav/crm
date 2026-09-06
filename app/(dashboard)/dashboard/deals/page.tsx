import { getPipelinePhases, getAllStages, getAllDeals } from "./data";
import DealsView from "./components/DealsView";
import ContactDetailSheet from "@/components/contacts/ContactDetailSheet";

export default async function DealsPage() {
  const [phases, allStages, deals] = await Promise.all([
    getPipelinePhases(),
    getAllStages(),
    getAllDeals(),
  ]);

  return (
    <>
      <DealsView projectName="Pipeline" phases={phases} allStages={allStages} deals={deals} />
      <ContactDetailSheet />
    </>
  );
}
