import { getContacts, getCurrentUserRole } from "./data";
import ContactsSearch from "./components/ContactsSearch";
import ContactsTable from "./components/ContactsTable";
import ContactFormModal from "./components/ContactFormModal";

export default async function KontaktePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const [contacts, role] = await Promise.all([
    getContacts(q),
    getCurrentUserRole(),
  ]);

  const isAdmin = role === "admin";

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">Kontakte & Leads</h1>
          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
            {contacts.length}
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <ContactsSearch defaultValue={q ?? ""} />
          <ContactFormModal mode="create" triggerLabel="+ Neuer Kontakt" />
        </div>
      </div>

      <ContactsTable contacts={contacts} isAdmin={isAdmin} />
    </div>
  );
}
