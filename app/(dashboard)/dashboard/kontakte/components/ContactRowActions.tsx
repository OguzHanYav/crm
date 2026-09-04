"use client";

import { useState, useRef, useEffect } from "react";
import type { Contact, TeamMember } from "../types";
import ContactFormModal from "./ContactFormModal";
import DeleteContactButton from "./DeleteContactButton";

export default function ContactRowActions({
  contact,
  isAdmin,
  teamMembers,
}: {
  contact: Contact;
  isAdmin: boolean;
  teamMembers: TeamMember[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="ring-focus rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        aria-label="Aktionen"
      >
        ⋮
      </button>

      {menuOpen && (
        <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-border bg-popover py-1 shadow-card">
          <button
            onClick={() => {
              setEditOpen(true);
              setMenuOpen(false);
            }}
            className="block w-full px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/60"
          >
            Bearbeiten
          </button>

          {isAdmin ? (
            <DeleteContactButton contactId={contact.id} onDone={() => setMenuOpen(false)} />
          ) : (
            <span
              title="Nur Admins dürfen Kontakte löschen"
              className="block cursor-not-allowed px-4 py-2 text-left text-sm text-muted-foreground/50"
            >
              Löschen
            </span>
          )}
        </div>
      )}

      {editOpen && (
        <ContactFormModal
          mode="edit"
          contact={contact}
          teamMembers={teamMembers}
          onClose={() => setEditOpen(false)}
          controlledOpen
        />
      )}
    </div>
  );
}
