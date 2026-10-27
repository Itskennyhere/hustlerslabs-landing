import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { EMAIL_RE } from "./validate";

// Sends plain-text email through Gmail SMTP (or any SMTP server set by env).
// SMTP_USER: the Gmail address. SMTP_PASS: a Google app password, not the normal Gmail password.

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter: Transporter | null = null;
function transport(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? "true") === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (!mailConfigured()) throw new Error("Email is not configured (SMTP_USER / SMTP_PASS).");
  if (!EMAIL_RE.test(to)) throw new Error("Refusing to send to an invalid address.");
  await transport().sendMail({
    from: process.env.MAIL_FROM ?? `Hustlers Labs <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
  });
}

/** Absolute link for emails. Never built from the request's Host header. */
export function appUrl(path: string): string {
  const base = (process.env.APP_URL ?? "https://www.hustlerslabs.com").replace(/\/+$/, "");
  return base + path;
}

/** j***@gmail.com, for showing an address without revealing all of it. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 1)}${"*".repeat(Math.max(1, Math.min(user.length - 1, 5)))}@${domain}`;
}
