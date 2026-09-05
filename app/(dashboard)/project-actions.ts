"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACTIVE_PROJECT_COOKIE } from "@/utils/projects/active-project";

export async function setActiveProject(projectId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROJECT_COOKIE, projectId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/kontakte");
  revalidatePath("/dashboard/deals");
  revalidatePath("/dashboard/anrufe");
  revalidatePath("/dashboard/settings");
}
