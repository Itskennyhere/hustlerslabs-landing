"use server";

import { redirect } from "next/navigation";
import { db, q } from "@/lib/db";
import { SCHEMA_STATEMENTS } from "@/lib/schema.sql";
import { safeEqual, sha256 } from "@/lib/crypto";
import { hashPassword, validateUsername } from "@/lib/password";
import { checkNewPassword } from "@/lib/security";
import { createSession } from "@/lib/auth";
import { adminExists } from "@/lib/setup";

export type SetupState = { error?: string } | undefined;

export async function runSetup(_: SetupState, form: FormData): Promise<SetupState> {
  const expected = process.env.ADMIN_SETUP_TOKEN ?? "";
  if (expected.length < 24) return { error: "Setup is not enabled on this deployment." };
  if (await adminExists()) return { error: "Setup has already been completed." };

  const token = String(form.get("token") ?? "").trim();
  if (!safeEqual(sha256(token), sha256(expected))) {
    await new Promise((r) => setTimeout(r, 1500)); // slow down guessing
    return { error: "Setup token is wrong." };
  }

  const u = validateUsername(String(form.get("username") ?? ""));
  if (!u.ok) return { error: u.error };
  const password = String(form.get("password") ?? "");
  const err = await checkNewPassword(password, u.value);
  if (err) return { error: err };
  if (password !== String(form.get("confirm") ?? "")) return { error: "Passwords do not match." };

  const sql = db();
  for (const stmt of SCHEMA_STATEMENTS) await sql.unsafe(stmt);

  // Insert only if there is still no admin (guards against a double submit).
  const created = await q<{ id: number }>`
    INSERT INTO users (username, password_hash, role)
    SELECT ${u.value}, ${await hashPassword(password)}, 'admin'
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin')
    RETURNING id`;
  if (!created[0]) return { error: "Setup has already been completed." };

  await createSession(Number(created[0].id), true);
  redirect("/members/account");
}
