"use client";

import { useState, useTransition } from "react";
import {
  createPipelineStage,
  updatePipelineStage,
  deletePipelineStage,
  moveStagePosition,
  type PipelineStageRow,
} from "../pipeline-actions";

const DEFAULT_COLOR = "#2563EB";

export default function PipelineStagesSettings({
  initialStages,
}: {
  initialStages: PipelineStageRow[];
}) {
  const [stages, setStages] = useState(initialStages);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(DEFAULT_COLOR);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      } else {
        setError(result.message ?? "Löschen fehlgeschlagen.");
      }
    });
  }

  function handleMove(stageId: string, direction: "up" | "down") {
    const index = stages.findIndex((s) => s.id === stageId);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || swapIndex < 0 || swapIndex >= stages.length) return;

    const next = [...stages];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setStages(next);

    startTransition(async () => {
      const result = await moveStagePosition(stageId, direction);
      if (!result.success) {
        setError(result.message ?? "Reihenfolge konnte nicht geändert werden.");
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
      } else {
        setError(result.message ?? "Anlegen fehlgeschlagen.");
      }
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-soft">
      <h2 className="text-base font-semibold text-foreground">Pipeline-Phasen</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Lege fest, welche Phasen im Deals-Kanban angezeigt werden und in welcher Reihenfolge.
      </p>

      {error && (
        <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {stages.map((stage, i) => (
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
                disabled={i === stages.length - 1 || isPending}
                className="ring-focus rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Nach unten"
              >
                ▼
              </button>
            </div>

            {editingId === stage.id ? (
              <>
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent"
                />
                <input
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

        {stages.length === 0 && (
          <li className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Noch keine Phasen vorhanden.
          </li>
        )}
      </ul>

      <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded border border-border bg-transparent"
        />
        <input
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
