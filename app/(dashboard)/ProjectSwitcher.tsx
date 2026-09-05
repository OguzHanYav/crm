"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActiveProject } from "./project-actions";

export default function ProjectSwitcher({
  projects,
  activeProjectId,
}: {
  projects: { id: string; name: string }[];
  activeProjectId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const projectId = e.target.value;
    startTransition(async () => {
      await setActiveProject(projectId);
      router.refresh();
    });
  }

  if (projects.length === 0) return null;

  return (
    <select
      value={activeProjectId}
      onChange={handleChange}
      disabled={isPending}
      title="Projekt wechseln"
      className="h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-900 disabled:opacity-60"
    >
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
