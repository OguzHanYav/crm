"use client";

import type { PipelineStage } from "../types";

export default function StageTabs({
  stages,
  counts,
  activeStageId,
  onSelect,
}: {
  stages: PipelineStage[];
  counts: Record<string, number>;
  activeStageId: string;
  onSelect: (stageId: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {stages.map((stage) => {
        const isActive = stage.id === activeStageId;
        const count = counts[stage.id] ?? 0;

        return (
          <button
            key={stage.id}
            onClick={() => onSelect(stage.id)}
            className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {stage.name}
            <span
              className="rounded-full px-1.5 py-0.5 text-xs font-semibold"
              style={
                isActive
                  ? { backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }
                  : { backgroundColor: `${stage.color}20`, color: stage.color }
              }
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}