import { getOrCreateStandardStages, getAllDeals } from "./data";
import DealsBoard from "./components/DealsBoard";
import DealsHeader from "./components/DealsHeader";
import ContactDetailSheet from "@/components/contacts/ContactDetailSheet";

export default async function DealsPage() {
  const [stages, deals] = await Promise.all([
    getOrCreateStandardStages(),
    getAllDeals(),
  ]);

  return (
    <>
      <div className="flex min-h-screen flex-col gap-4 bg-background p-6">
        <DealsHeader pipelineName="Pipeline" totalCount={deals.length} />
        <DealsBoard stages={stages} initialDeals={deals} />
      </div>
      <ContactDetailSheet />
    </>
  );
}
