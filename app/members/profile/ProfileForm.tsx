"use client";

import { startTransition, useActionState, useState } from "react";
import { saveProfile } from "./actions";
import CreatorCard from "@/components/CreatorCard";
import { Pills, SelectField, TextField } from "@/components/fields";
import { COLLAB_STATUS, CREATOR_AUDIENCE, MAX_PLATFORM_ROWS, NICHES, PLATFORMS } from "@/lib/onboarding-options";
import { avatarUrl } from "@/lib/platforms";

type Row = { id: number; platform: string; handle: string };
type Initial = {
  creator_no: number;
  created_at: string;
  display_name: string;
  bio: string;
  platforms: { platform: string; handle: string }[];
  main_handle: string;
  main_platform: string;
  niches: string[];
  audience_band: string;
  region: string;
  languages: string;
  collab_status: string;
  telegram: string;
  verified: boolean;
};

const bare = (h: string) => h.trim().replace(/^@/, "");

export default function ProfileForm({ initial, xConnected }: { initial: Initial | null; xConnected: string | null }) {
  const [state, dispatch, pending] = useActionState(saveProfile, undefined);
  const [v, setV] = useState({
    display_name: initial?.display_name ?? "",
    bio: initial?.bio ?? "",
    niches: initial?.niches ?? [],
    audience_band: initial?.audience_band ?? "",
    region: initial?.region ?? "",
    languages: initial?.languages ?? "",
    collab_status: initial?.collab_status ?? "",
    telegram: initial?.telegram ?? "",
  });
  const [rows, setRows] = useState<Row[]>(
    initial?.platforms.length ? initial.platforms.map((p, i) => ({ id: i, ...p })) : [{ id: 0, platform: "x", handle: "" }],
  );
  const [mainId, setMainId] = useState(() =>
    initial ? Math.max(0, initial.platforms.findIndex((p) => p.platform === initial.main_platform && p.handle === initial.main_handle)) : 0,
  );
  const [nextId, setNextId] = useState(rows.length);

  const set = (k: keyof typeof v) => (val: string | string[]) => setV((o) => ({ ...o, [k]: val }));
  const err = state?.error ? state : undefined;
  const main = rows.find((r) => r.id === mainId) ?? rows[0];
  const filled = rows.filter((r) => bare(r.handle)).map((r) => ({ platform: r.platform, handle: bare(r.handle) }));
  const photo = xConnected ? avatarUrl([], "x", xConnected) : avatarUrl(filled, main.platform, bare(main.handle));
  const platformErr = err && (err.field === "platforms" || err.field?.startsWith("platform_") || err.field?.startsWith("handle_"));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  }

  return (
    <div className="split">
      <form onSubmit={onSubmit} className="stack">
        <TextField name="display_name" label="Display name" required max={40} defaultValue={v.display_name} onChange={set("display_name")} err={err} />

        <p className="note">
          Profile photo: {photo ? "pulled from your X account." : "add an X handle to use your X photo. Until then your initials are shown."}
        </p>

        <TextField name="bio" label="Bio" required max={160} counter defaultValue={v.bio} onChange={set("bio")} err={err} />

        <fieldset className="pills-field" aria-invalid={platformErr || undefined}>
          <legend>Platforms and handles *</legend>
          {rows.map((r, idx) => (
            <div className="platform-row" key={r.id}>
              <select
                name={`platform_${idx}`}
                aria-label="Platform"
                value={r.platform}
                onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, platform: e.target.value } : x)))}
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                name={`handle_${idx}`}
                aria-label="Handle"
                placeholder="@handle"
                maxLength={41}
                required
                value={r.handle}
                aria-invalid={err?.field === `handle_${idx}` || undefined}
                onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, handle: e.target.value } : x)))}
              />
              <label className="main-radio">
                <input type="radio" name="main" value={idx} checked={mainId === r.id} onChange={() => setMainId(r.id)} />
                Main
              </label>
              {rows.length > 1 && (
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => {
                    const left = rows.filter((x) => x.id !== r.id);
                    setRows(left);
                    if (mainId === r.id) setMainId(left[0].id);
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {rows.length < MAX_PLATFORM_ROWS && (
            <button
              type="button"
              className="btn ghost small add-row"
              onClick={() => {
                setRows([...rows, { id: nextId, platform: "x", handle: "" }]);
                setNextId(nextId + 1);
              }}
            >
              Add platform
            </button>
          )}
          {platformErr && (
            <span className="error" role="alert">
              {err.error}
            </span>
          )}
        </fieldset>

        <Pills name="niches" label="Niche" required options={NICHES} defaultValue={v.niches} onChange={set("niches")} err={err} />
        <SelectField
          name="audience_band"
          label="Audience size on main platform"
          required
          options={CREATOR_AUDIENCE}
          defaultValue={v.audience_band}
          onChange={set("audience_band")}
          err={err}
        />
        <TextField name="region" label="Audience region" required max={80} placeholder="For example, Southeast Asia" defaultValue={v.region} onChange={set("region")} err={err} />
        <TextField name="languages" label="Languages" required max={80} placeholder="For example, English, Bahasa" defaultValue={v.languages} onChange={set("languages")} err={err} />
        <Pills
          name="collab_status"
          label="Open to paid collaborations"
          required
          multiple={false}
          options={COLLAB_STATUS}
          defaultValue={v.collab_status ? [v.collab_status] : []}
          onChange={(x) => set("collab_status")(x[0] ?? "")}
          err={err}
        />
        <TextField
          name="telegram"
          label="Telegram handle"
          required
          max={41}
          placeholder="@handle"
          note="Private. Only Hustlers Labs sees this."
          defaultValue={v.telegram}
          onChange={set("telegram")}
          err={err}
        />

        {state?.error && !state.field && (
          <p className="error" role="alert">
            {state.error}
          </p>
        )}
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Saving..." : "Save profile"}
        </button>
      </form>

      <aside className="preview">
        <div className="tag">Preview</div>
        <CreatorCard
          owner
          xConnected={xConnected}
          c={{
            creator_no: initial?.creator_no,
            created_at: initial?.created_at,
            display_name: v.display_name,
            bio: v.bio,
            platforms: filled,
            main_handle: bare(main.handle),
            main_platform: main.platform,
            niches: v.niches,
            audience_band: v.audience_band,
            region: v.region,
            languages: v.languages,
            collab_status: v.collab_status,
            verified: initial?.verified,
          }}
        />
      </aside>
    </div>
  );
}
