"use client";

import { useRouter, usePathname } from "next/navigation";
import type { Pipeline } from "../types";

export default function PipelineSelector({
  pipelines,
  selectedPipelineId,
}: {
  pipelines: Pipeline[];
  selectedPipelineId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <select
      value={selectedPipelineId}
      onChange={(e) => router.push(`${pathname}?pipeline=${e.target.value}`)}
      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    >
      {pipelines.map((pipeline) => (
        <option key={pipeline.id} value={pipeline.id}>
          {pipeline.name}
        </option>
      ))}
    </select>
  );
}
