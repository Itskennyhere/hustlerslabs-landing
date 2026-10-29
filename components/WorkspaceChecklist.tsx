import { WORKSPACE_SECTIONS, workspaceProgress, type Workspace } from "@/lib/onboarding";

export function ProgressBar({ done, total = WORKSPACE_SECTIONS.length }: { done: number; total?: number }) {
  return (
    <div className="progress-line">
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <span style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <span className="mono note">
        {done}/{total} done
      </span>
    </div>
  );
}

/** Workspace card with the three sections and a progress bar. */
export default function WorkspaceChecklist({ w }: { w: Workspace | null }) {
  const done = workspaceProgress(w);
  return (
    <div className="panel">
      <h2>{done === WORKSPACE_SECTIONS.length ? "Workspace complete." : "Complete your workspace."}</h2>
      <p className="note" style={{ marginBottom: "1rem" }}>
        Three short sections, in any order. You can edit them later. Tools unlock when all three are done.
      </p>
      <ProgressBar done={done} />
      <ul className="checklist">
        {WORKSPACE_SECTIONS.map((s) => {
          const ok = Boolean(w?.[s.doneKey]);
          return (
            <li key={s.slug}>
              <span className={`check${ok ? " on" : ""}`} aria-hidden="true">
                {ok ? "✓" : ""}
              </span>
              <span className="checklist-title">{s.title}</span>
              <span className="pill">{ok ? "Done" : "To do"}</span>
              <a className="btn ghost small" href={`/members/workspace/${s.slug}`}>
                {ok ? "Edit" : "Start"}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
