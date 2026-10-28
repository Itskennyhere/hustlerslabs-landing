"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { parseHandle } from "@/lib/xscan/handle";
import type { QuotaStatus, ScanResponse, ScanResult } from "@/lib/xscan/types";

const LIMIT_MESSAGE = "You have used today's scan. It resets at midnight, Malaysia time.";

const fmt = (n: number | null) => (n === null ? "Not indexed" : n.toLocaleString("en-US"));

function useCountdown(target: string | null, onDone: () => void): string | null {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!target) {
      setLeft(null);
      return;
    }
    const end = Date.parse(target);
    const tick = () => {
      const ms = Math.max(0, end - Date.now());
      setLeft(ms);
      if (ms === 0) onDone();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target, onDone]);

  if (left === null) return null;
  const s = Math.floor(left / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function quotaLine(quota: QuotaStatus | null): string {
  if (!quota) return "Checking your scans.";
  if (quota.unlimited) return "Unlimited scans. Admin account.";
  return `${quota.remaining} ${quota.remaining === 1 ? "scan" : "scans"} left today.`;
}

/** X Profile Scanner. Self contained, so it can be mounted on any members page. */
export default function XScanner() {
  const [input, setInput] = useState("");
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cached, setCached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limited, setLimited] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/x-scan", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { quota: QuotaStatus };
      setQuota(data.quota);
      if (data.quota.unlimited || data.quota.remaining > 0) {
        setLimited(false);
        setError((e) => (e === LIMIT_MESSAGE ? null : e));
      }
    } catch {
      // The status line stays on its loading text.
    }
  }, []);

  useEffect(() => {
    loadQuota();
  }, [loadQuota]);

  const outOfScans = limited || (quota !== null && !quota.unlimited && quota.remaining === 0);
  const countdown = useCountdown(outOfScans && quota ? quota.resetsAt : null, loadQuota);

  async function onScan(e: FormEvent) {
    e.preventDefault();
    const handle = parseHandle(input);
    if (!handle) {
      setError("Enter a valid X handle, like @name or an x.com profile link.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/x-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<ScanResponse> & { error?: string; quota?: QuotaStatus };
      if (data.quota) setQuota(data.quota);
      if (res.status === 429) {
        setLimited(true);
        setError(LIMIT_MESSAGE);
        return;
      }
      if (!res.ok || !data.result) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setResult(data.result);
      setCached(Boolean(data.cached));
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel xs">
      <div>
        <h2>X Profile Scanner.</h2>
        <p className="note">Rate a profile, find its niche and get three posts ready to go.</p>
      </div>

      <form onSubmit={onScan} className="row">
        <label>
          <span className="sr-only">X handle</span>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="@handle or x.com/handle" />
        </label>
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "Scanning..." : "Scan"}
        </button>
      </form>

      <div className="xs-status">
        <p className="mono note">{quotaLine(quota)}</p>
        {outOfScans && countdown && <p className="mono note">Resets in {countdown}.</p>}
      </div>

      {busy && <p className="note">Pulling the profile and reading recent posts. This takes about 20 seconds.</p>}

      {error && (
        <div className="xs-alert" role="alert">
          <p>{error}</p>
          {limited && countdown && <p className="mono">Resets in {countdown}.</p>}
        </div>
      )}

      {result && <Results result={result} cached={cached} />}
    </section>
  );
}

function Results({ result, cached }: { result: ScanResult; cached: boolean }) {
  const { profile, sorsa, rating, niche, suggestions } = result;

  return (
    <div className="xs-results">
      {cached && <p className="note">Showing a result from the last 24 hours. This did not use a scan.</p>}

      <div className="xs-profile">
        <div className="avatar xs-avatar">
          {profile.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar} alt="" />
          ) : (
            profile.username.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="xs-id">
          <h3>
            {profile.name}
            {profile.verified && <span className="pill on">Verified</span>}
          </h3>
          <a className="mono note" href={`https://x.com/${profile.username}`} target="_blank" rel="noreferrer">
            @{profile.username}
          </a>
          <p className="note">
            {fmt(profile.followers)} followers. {fmt(profile.following)} following.
          </p>
          {profile.bio && <p className="xs-bio">{profile.bio}</p>}
        </div>
      </div>

      <div className="tiles">
        {(
          [
            ["Sorsa score", sorsa.score === null ? null : Math.round(sorsa.score)],
            ["Influencers", sorsa.influencers],
            ["Projects", sorsa.projects],
            ["VC employees", sorsa.vcEmployees],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="tile">
            <span className="tile-title">{label}</span>
            <span className={value === null ? "tile-note" : "tile-value"}>{fmt(value)}</span>
          </div>
        ))}
      </div>

      <div className="xs-block">
        <div className="xs-rating">
          <div>
            <span className="tile-title">Rating</span>
            <p className="tile-value">
              {rating.total}
              <span className="note"> / 100</span>
            </p>
          </div>
          <span className="xs-grade" aria-label={`Grade ${rating.grade}`}>
            {rating.grade}
          </span>
        </div>
        <ul className="bars">
          {rating.parts.map((part) => (
            <li key={part.key}>
              <span>
                {part.label}
                <span className="note xs-detail">{part.detail}</span>
              </span>
              <span className="bars-track">
                <span style={{ width: `${(part.score / part.max) * 100}%` }} />
              </span>
              <span className="bars-n mono">
                {part.score}/{part.max}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="xs-block">
        <span className="tile-title">Niche</span>
        <h3 className="xs-niche">{niche.primary}</h3>
        {niche.secondary.length > 0 && (
          <div className="ccard-tags">
            {niche.secondary.map((s) => (
              <span key={s} className="tagchip">
                {s}
              </span>
            ))}
          </div>
        )}
        <p>{niche.voice}</p>
        <div className="xs-two">
          <List title="Strengths" items={niche.strengths} />
          <List title="Gaps" items={niche.gaps} />
        </div>
      </div>

      <div className="xs-block">
        <h3>Post ideas.</h3>
        {suggestions.map((s, i) => (
          <Suggestion key={i} angle={s.angle} post={s.post} />
        ))}
      </div>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="answers-title">{title}</p>
      <ul className="xs-list">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Suggestion({ angle, post }: { angle: string; post: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(post);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="xs-post">
      <div className="xs-post-head">
        <span className="pill on">{angle}</span>
        <button type="button" className="btn ghost small" onClick={copy}>
          {copied ? "Copied." : "Copy"}
        </button>
      </div>
      <p className="xs-post-text">{post}</p>
      <p className="mono note">{post.length} characters.</p>
    </div>
  );
}
