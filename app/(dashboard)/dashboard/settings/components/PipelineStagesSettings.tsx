"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPipelineStage,
  updatePipelineStage,
  deletePipelineStage,
  moveStagePosition,
  toggleStageActive,
  type PipelineStageRow,
} from "../pipeline-actions";

const DEFAULT_COLOR = "#2563EB";

export default function PipelineStagesSettings({
  initialStages,
}: {
  initialStages: PipelineStageRow[];
}) {
  const router = useRouter();
  const [stages, setStages] = useState(initialStages);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(DEFAULT_COLOR);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Kurze visuelle "Gespeichert"-Bestätigung neben der jeweiligen Phase.
  function flashSaved(stageId: string) {
    setSavedId(stageId);
    setTimeout(() => setSavedId((current) => (current === stageId ? null : current)), 1500);
  }

  // Nach position sortieren (nicht nur filtern) — sonst bleibt die Anzeige nach einem
  // optimistischen Positions-Swap in der alten Array-Reihenfolge stehen und der Klick
  // auf ▲/▼ wirkt wirkungslos, bis router.refresh() die Liste neu vom Server holt.
  const activeStages = useMemo(
    () => stages.filter((s) => s.is_active).sort((a, b) => a.position - b.position),
    [stages]
  );

  function startEdit(stage: PipelineStageRow) {
    setEditingId(stage.id);
    setEditName(stage.name);
    setEditColor(stage.color);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit(stageId: string) {
    startTransition(async () => {
      const result = await updatePipelineStage(stageId, editName, editColor);
      if (result.success && result.data) {
        setStages((prev) =>
          prev.map((s) => (s.id === stageId ? (result.data as PipelineStageRow) : s))
        );
        setEditingId(null);
        setError(null);
        flashSaved(stageId);
        router.refresh();
      } else {
        setError(result.message ?? "Speichern fehlgeschlagen.");
      }
    });
  }

  function handleDelete(stageId: string) {
    const confirmed = window.confirm("Diese Phase wirklich löschen?");
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deletePipelineStage(stageId);
      if (result.success) {
        setStages((prev) => prev.filter((s) => s.id !== stageId));
        setError(null);
        router.refresh();
      } else {
        setError(result.message ?? "Löschen fehlgeschlagen.");
      }
    });
  }

  function handleMove(stageId: string, direction: "up" | "down") {
    const index = activeStages.findIndex((s) => s.id === stageId);
    const swapId = direction === "up" ? activeStages[index - 1]?.id : activeStages[index + 1]?.id;
    if (index === -1 || !swapId) return;

    setStages((prev) => {
      const next = [...prev];
      const a = next.findIndex((s) => s.id === stageId);
      const b = next.findIndex((s) => s.id === swapId);
      const posA = next[a].position;
      const posB = next[b].position;
      next[a] = { ...next[a], position: posB };
      next[b] = { ...next[b], position: posA };
      return next;
    });

    startTransition(async () => {
      const result = await moveStagePosition(stageId, direction);
      if (result.success) {
        // Autoritativen Stand übernehmen statt dem rein optimistischen Swap zu vertrauen.
        if (result.data) setStages(result.data);
        flashSaved(stageId);
        router.refresh();
      } else {
        setError(result.message ?? "Reihenfolge konnte nicht geändert werden.");
      }
    });
  }

  // Optimistisch: Aktiv/Inaktiv wird sofort umgeschaltet, unabhängig vom Server-Roundtrip.
  function handleToggleActive(stage: PipelineStageRow) {
    const nextActive = !stage.is_active;
    const previous = stages;
    setStages((prev) => prev.map((s) => (s.id === stage.id ? { ...s, is_active: nextActive } : s)));

    startTransition(async () => {
      const result = await toggleStageActive(stage.id, nextActive);
      if (result.success) {
        flashSaved(stage.id);
        router.refresh();
      } else {
        setStages(previous);
        setError(result.message ?? "Status konnte nicht geändert werden.");
      }
    });
  }

  function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;

    startTransition(async () => {
      const result = await createPipelineStage(trimmed, newColor);
      if (result.success && result.data) {
        setStages((prev) => [...prev, result.data as PipelineStageRow]);
        setNewName("");
        setNewColor(DEFAULT_COLOR);
        setError(null);
        flashSaved(result.data.id);
        router.refresh();
      } else {
        setError(result.message ?? "Anlegen fehlgeschlagen.");
      }
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-soft">
      <h2 className="text-base font-semibold text-foreground">Pipeline-Phasen</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Aktive Phasen erscheinen als Tabs in der Pipeline-Ansicht. Erstelle beliebig neue Phasen
        oder aktiviere/deaktiviere bestehende weiter unten.
      </p>

      {error && (
        <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {/* Aktive Phasen (Reihenfolge + Bearbeiten) */}
      <ul className="mt-4 flex flex-col gap-2">
        {activeStages.map((stage, i) => (
          <li
            key={stage.id}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
          >
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => handleMove(stage.id, "up")}
                disabled={i === 0 || isPending}
                className="ring-focus rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Nach oben"
              >
                ▲
              </button>
              <button
                onClick={() => handleMove(stage.id, "down")}
                disabled={i === activeStages.length - 1 || isPending}
                className="ring-focus rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Nach unten"
              >
                ▼
              </button>
            </div>

            {editingId === stage.id ? (
              <>
                <input
                  id={`edit-stage-color-${stage.id}`}
                  name="editStageColor"
                  aria-label="Farbe"
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent"
                />
                <input
                  id={`edit-stage-name-${stage.id}`}
                  name="editStageName"
                  aria-label="Name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="ring-focus h-9 flex-1 rounded-lg border border-border bg-input px-3 text-sm text-foreground"
                />
                <button
                  onClick={() => saveEdit(stage.id)}
                  disabled={isPending}
                  className="ring-focus rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:brightness-110 disabled:opacity-50"
                >
                  Speichern
                </button>
                <button
                  onClick={cancelEdit}
                  className="ring-focus rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50"
                >
                  Abbrechen
                </button>
              </>
            ) : (
              <>
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <span className="flex-1 text-sm font-medium text-foreground">{stage.name}</span>
                {savedId === stage.id && (
                  <span className="text-xs font-medium text-success">✓ Gespeichert</span>
                )}
                <button
                  onClick={() => startEdit(stage)}
                  className="ring-focus rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50"
                >
                  Bearbeiten
                </button>
                <button
                  onClick={() => handleDelete(stage.id)}
                  disabled={isPending}
                  className="ring-focus rounded-md border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                >
                  Löschen
                </button>
              </>
            )}
          </li>
        ))}

        {activeStages.length === 0 && (
          <li className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Keine aktiven Phasen.
          </li>
        )}
      </ul>

      {/* Alle Phasen: aktivieren/deaktivieren */}
      <div className="mt-6 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground">Alle Phasen</h3>
        <ul className="mt-3 flex flex-col gap-2">
          {[...stages].sort((a, b) => a.position - b.position).map((stage) => (
            <li
              key={stage.id}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              <span className={`flex-1 text-sm ${stage.is_active ? "text-foreground" : "text-muted-foreground line-through"}`}>
                {stage.name}
              </span>
              {savedId === stage.id && (
                <span className="text-xs font-medium text-success">✓ Gespeichert</span>
              )}
              <button
                onClick={() => handleToggleActive(stage)}
                disabled={isPending}
                className={`ring-focus rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                  stage.is_active
                    ? "border border-danger/30 text-danger hover:bg-danger/10"
                    : "bg-accent text-accent-foreground hover:brightness-110"
                }`}
              >
                {stage.is_active ? "Deaktivieren" : "Aktivieren"}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
        <input
          id="new-stage-color"
          name="newStageColor"
          aria-label="Farbe der neuen Phase"
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded border border-border bg-transparent"
        />
        <input
          id="new-stage-name"
          name="newStageName"
          aria-label="Name der neuen Phase"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="Neue Phase, z. B. 'Angebot verschickt'"
          className="ring-focus h-9 flex-1 rounded-lg border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <button
          onClick={handleCreate}
          disabled={isPending || !newName.trim()}
          className="ring-focus rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:brightness-110 disabled:opacity-50"
        >
          + Phase hinzufügen
        </button>
      </div>
    </section>
  );
}
