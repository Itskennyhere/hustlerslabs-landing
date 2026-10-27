import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { BUDGETS, GOALS, PAYMENT_PREFS, TOOLS, labelOf, type Option } from "@/lib/onboarding-options";

type Count = { value: string; n: number };

function CountTable({ title, rows, list, total }: { title: string; rows: Count[]; list: readonly Option[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="section">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <div className="empty">No answers yet.</div>
      ) : (
        <ul className="bars">
          {rows.map((r) => (
            <li key={r.value}>
              <span className="bars-label">{labelOf(list, r.value)}</span>
              <span className="bars-track">
                <span style={{ width: `${(r.n / max) * 100}%` }} />
              </span>
              <span className="mono bars-n">
                {r.n}
                {total > 0 && <span className="note"> ({Math.round((r.n / total) * 100)}%)</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function InsightsPage() {
  await requireAdmin();
  const [tools, payment, budget, goals, totals] = await Promise.all([
    q<Count>`SELECT t AS value, count(*)::int AS n FROM project_workspace, unnest(wanted_tools) AS t
             WHERE buying_done_at IS NOT NULL GROUP BY t ORDER BY n DESC, t`,
    q<Count>`SELECT payment_pref AS value, count(*)::int AS n FROM project_workspace
             WHERE buying_done_at IS NOT NULL AND payment_pref IS NOT NULL GROUP BY payment_pref ORDER BY n DESC, payment_pref`,
    q<Count>`SELECT budget_band AS value, count(*)::int AS n FROM project_profiles GROUP BY budget_band ORDER BY n DESC, budget_band`,
    q<Count>`SELECT g AS value, count(*)::int AS n FROM project_workspace, unnest(goals) AS g
             WHERE goals_done_at IS NOT NULL GROUP BY g ORDER BY n DESC, g`,
    q<{ projects: number; buying: number; goals: number }>`
      SELECT (SELECT count(*)::int FROM project_profiles) AS projects,
             (SELECT count(*)::int FROM project_workspace WHERE buying_done_at IS NOT NULL) AS buying,
             (SELECT count(*)::int FROM project_workspace WHERE goals_done_at IS NOT NULL) AS goals`,
  ]);
  const t = totals[0];

  return (
    <>
      <div className="tag">Admin</div>
      <h1>Insights.</h1>
      <p className="sub">
        What projects ask for. {t.projects} {t.projects === 1 ? "project" : "projects"} signed up. Percentages are of projects
        that answered that section.
      </p>
      <CountTable title="Tools requested" rows={tools} list={TOOLS} total={t.buying} />
      <CountTable title="Payment preference" rows={payment} list={PAYMENT_PREFS} total={t.buying} />
      <CountTable title="Monthly budget (USD)" rows={budget} list={BUDGETS} total={t.projects} />
      <CountTable title="Project goals" rows={goals} list={GOALS} total={t.goals} />
    </>
  );
}
