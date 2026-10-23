import "server-only";
import { q } from "./db";

export async function adminExists(): Promise<boolean> {
  try {
    const rows = await q<{ n: number }>`SELECT count(*)::int AS n FROM users WHERE role = 'admin'`;
    return (rows[0]?.n ?? 0) > 0;
  } catch {
    return false; // tables not created yet
  }
}
