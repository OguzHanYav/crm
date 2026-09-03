"use client";

import { useState, useRef, useEffect } from "react";
import type { Contact } from "../types";
import ContactFormModal from "./ContactFormModal";
import DeleteContactButton from "./DeleteContactButton";

export default function ContactRowActions({
  contact,
  isAdmin,
}: {
  contact: Contact;
  isAdmin: boolean;
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
        className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
        aria-label="Aktionen"
      >
        ⋮
      </button>

      {menuOpen && (
        <div className="absolute right-0 z-10 mt-1 w-40 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          <button
            onClick={() => {
              setEditOpen(true);
              setMenuOpen(false);
            }}
            className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            Bearbeiten
          </button>

          {isAdmin ? (
            <DeleteContactButton contactId={contact.id} onDone={() => setMenuOpen(false)} />
          ) : (
            <span
              title="Nur Admins dürfen Kontakte löschen"
              className="block cursor-not-allowed px-4 py-2 text-left text-sm text-gray-300"
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
          onClose={() => setEditOpen(false)}
          controlledOpen
        />
      )}
    </div>
  );
}
