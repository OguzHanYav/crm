import { getOrCreateStandardStages, getAllDeals } from "./data";
import DealsView from "./components/DealsView";
import ContactDetailSheet from "@/components/contacts/ContactDetailSheet";

export default async function DealsPage() {
  const [stages, deals] = await Promise.all([
    getOrCreateStandardStages(),
    getAllDeals(),
  ]);

  return (
    <>
      <DealsView projectName="Pipeline" stages={stages} deals={deals} />
      <ContactDetailSheet />
    </>
  );
}
