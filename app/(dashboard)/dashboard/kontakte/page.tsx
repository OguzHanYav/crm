import { getContacts, getCurrentUserRole, getTeamMembers, getContactCompanies, getContactsTotalCount } from "./data";
import ContactsSearch from "./components/ContactsSearch";
import ContactsTable from "./components/ContactsTable";
import ContactsFilterBar from "./components/ContactsFilterBar";
import ContactFormModal from "./components/ContactFormModal";
import ContactDetailSheet from "@/components/contacts/ContactDetailSheet";
import ContactsActionsBar from "@/components/contacts/ContactsActionsBar";
import { isAdminRole } from "@/lib/roles";
import type { ContactFilters, ContactStatus, CallType, DealStatusFilter } from "./types";

export default async function KontaktePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    company?: string;
    from?: string;
    to?: string;
    dealStatus?: string;
    event?: string;
  }>;
}) {
  const { q, status, company, from, to, dealStatus, event } = await searchParams;

  const filters: ContactFilters = {
    q,
    status: status as ContactStatus | undefined,
    company,
    dateFrom: from,
    dateTo: to,
    dealStatus: dealStatus as DealStatusFilter | undefined,
    eventCategory: event as CallType | undefined,
  };

  const [contacts, role, teamMembers, companies, totalCount] = await Promise.all([
    getContacts(filters),
    getCurrentUserRole(),
    getTeamMembers(),
    getContactCompanies(),
    getContactsTotalCount(filters),
  ]);

  const isAdmin = isAdminRole(role);

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">Kontakte & Leads</h1>
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
            {totalCount}
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <ContactsSearch defaultValue={q ?? ""} />
          <ContactFormModal mode="create" triggerLabel="+ Neuer Kontakt" teamMembers={teamMembers} />
        </div>
      </div>

      <ContactsFilterBar companies={companies} />

      <ContactsTable contacts={contacts} isAdmin={isAdmin} teamMembers={teamMembers} totalCount={totalCount} />

      <ContactsActionsBar isAdmin={isAdmin} />

      <ContactDetailSheet />
    </div>
  );
}
