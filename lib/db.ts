import "server-only";
import postgres from "postgres";

// One small pool per server instance. prepare:false keeps it compatible with
// pooled connection strings (Neon / PgBouncer) used on Vercel.
const globalForDb = globalThis as unknown as { __hlSql?: postgres.Sql };

export function db(): postgres.Sql {
  if (!globalForDb.__hlSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.__hlSql = postgres(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 10 });
  }
  return globalForDb.__hlSql;
}

// Tagged-template helper: values are always sent as parameters, never pasted into SQL.
export async function q<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await db()(strings, ...(values as any[]));
  return rows as unknown as T[];
}
