import "server-only";
import { WORKSPACE_SECTIONS, getAccountType, getWorkspace, workspaceProgress } from "./onboarding";

/**
 * Projects unlock tools by completing their workspace. Creators and admins are not affected.
 * Returns the number of finished sections when tools are locked, or null when they are open.
 */
export async function toolsLockedAt(userId: number): Promise<number | null> {
  if ((await getAccountType(userId)) !== "project") return null;
  const done = workspaceProgress(await getWorkspace(userId));
  return done < WORKSPACE_SECTIONS.length ? done : null;
}
