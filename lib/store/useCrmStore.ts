import { create } from "zustand";

export type DealsFilterState = {
  search: string;
  companyFilter: string;
  contactFilter: string;
  countryFilter: string;
  industryFilter: string;
};

export type ContactsFilterState = {
  q: string;
};

const initialDealsFilters: DealsFilterState = {
  search: "",
  companyFilter: "",
  contactFilter: "",
  countryFilter: "",
  industryFilter: "",
};

const initialContactsFilters: ContactsFilterState = {
  q: "",
};

type CrmStore = {
  dealsFilters: DealsFilterState;
  setDealsFilter: <K extends keyof DealsFilterState>(key: K, value: DealsFilterState[K]) => void;
  resetDealsFilters: () => void;

  contactsFilters: ContactsFilterState;
  setContactsFilter: <K extends keyof ContactsFilterState>(key: K, value: ContactsFilterState[K]) => void;

  selectedContactId: string | null;
  setSelectedContactId: (id: string | null) => void;

  selectedDealId: string | null;
  setSelectedDealId: (id: string | null) => void;
};

// Schlanker, globaler Store für seitenübergreifenden Filter-/Auswahlzustand.
// Komponenten sollten mit selektiven Selektoren lesen (z. B. useCrmStore((s) => s.dealsFilters))
// statt den gesamten Store zu destrukturieren, damit sie nur bei Änderung ihrer eigenen Slice neu rendern.
export const useCrmStore = create<CrmStore>((set) => ({
  dealsFilters: initialDealsFilters,
  setDealsFilter: (key, value) =>
    set((state) => ({ dealsFilters: { ...state.dealsFilters, [key]: value } })),
  resetDealsFilters: () => set({ dealsFilters: initialDealsFilters }),

  contactsFilters: initialContactsFilters,
  setContactsFilter: (key, value) =>
    set((state) => ({ contactsFilters: { ...state.contactsFilters, [key]: value } })),

  selectedContactId: null,
  setSelectedContactId: (id) => set({ selectedContactId: id }),

  selectedDealId: null,
  setSelectedDealId: (id) => set({ selectedDealId: id }),
}));
