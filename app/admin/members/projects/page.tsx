import { requireAdmin } from "@/lib/auth";
import { BUDGETS, PROJECT_CATEGORIES, STAGES, labelOf } from "@/lib/onboarding-options";
import { anyOf, fmtDate, pageNumber, pick, searchText, type Search } from "@/lib/list";
import { STATUS_TABS, listProjects } from "@/lib/member-lists";
import { SAMPLE_PROJECT } from "@/lib/sample-cards";
import ProjectCard from "@/components/ProjectCard";
import { ExampleFrame, STATUS_LABEL, StatusChip } from "@/components/card-parts";
import { CardGrid, CardLink, StatusTabs, VIEWS, ViewBar } from "@/components/admin-members";
import { BackLink, Empty, FilterSelect, ListSearch, ListTotal, Pager, TableBox } from "@/components/list";

const BASE = "/admin/members/projects";
const WORKSPACE = [0, 1, 2, 3].map((n) => ({ value: String(n), label: `Workspace ${n}/3` }));

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const f = {
    tab: pick(sp.tab, STATUS_TABS, "waiting"),
    term: searchText(sp.q),
    category: pick(sp.category, anyOf(PROJECT_CATEGORIES), ""),
    stage: pick(sp.stage, anyOf(STAGES), ""),
    budget: pick(sp.budget, anyOf(BUDGETS), ""),
    workspace: pick(sp.workspace, anyOf(WORKSPACE), ""),
    page: pageNumber(sp.page),
  };
  const view = pick(sp.view, VIEWS, "cards");
  const preview = sp.preview === "1";
  const { rows, counts } = await listProjects(f);
  const params = { tab: f.tab, q: f.term, category: f.category, stage: f.stage, budget: f.budget, workspace: f.workspace, view: view === "cards" ? "" : view, preview: preview ? "1" : "" };
  const filtered = Boolean(f.term || f.category || f.stage || f.budget || f.workspace);
  const example = (
    <ExampleFrame>
      <ProjectCard p={SAMPLE_PROJECT} contact={SAMPLE_PROJECT} status="waiting" />
    </ExampleFrame>
  );

  if (counts.everyone === 0) {
    return (
      <>
        <BackLink href="/admin/members">Back to members</BackLink>
        <div className="tag">Members</div>
        <h1>Projects.</h1>
        <div className="empty-type">
          <p>
            <strong>No projects yet.</strong> They sign up at hustlerslabs.com/join and appear here for approval.
          </p>
        </div>
        <div className="example-solo">{example}</div>
      </>
    );
  }

  return (
    <>
      <BackLink href="/admin/members">Back to members</BackLink>
      <div className="tag">Members</div>
      <h1>Projects.</h1>
      <p className="sub">Open a card to approve, decline, sign out or disable.</p>

      <StatusTabs base={BASE} params={params} current={f.tab} counts={counts} />
      <ListSearch base={BASE} q={f.term} placeholder="Search project, username, email or contact" keep={{ tab: f.tab, view: params.view, preview: params.preview }}>
        <FilterSelect name="category" label="Category" value={f.category} options={PROJECT_CATEGORIES} />
        <FilterSelect name="stage" label="Stage" value={f.stage} options={STAGES} />
        <FilterSelect name="budget" label="Budget" value={f.budget} options={BUDGETS} />
        <FilterSelect name="workspace" label="Workspace" value={f.workspace} options={WORKSPACE} />
      </ListSearch>
      <ViewBar base={BASE} params={params} view={view} preview={preview} />
      {preview && <div className="example-solo">{example}</div>}
      <ListTotal total={counts[f.tab]} one="project" />

      {rows.length === 0 ? (
        <Empty>
          {filtered ? (
            <>
              No projects match. <a href={`${BASE}?tab=${f.tab}`}>Clear the filters.</a>
            </>
          ) : (
            `No projects are ${STATUS_LABEL[f.tab].toLowerCase()}.`
          )}
        </Empty>
      ) : view === "table" ? (
        <TableBox>
          <thead>
            <tr>
              <th>Project</th>
              <th>Username</th>
              <th>Email</th>
              <th>Status</th>
              <th>Stage</th>
              <th>Budget</th>
              <th>Workspace</th>
              <th>Contact</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <a href={`/admin/members/${r.id}`}>{r.project_name}</a>
                </td>
                <td className="mono">@{r.username}</td>
                <td className="mono">{r.email ?? "-"}</td>
                <td>
                  <StatusChip status={r.status} />
                </td>
                <td>{labelOf(STAGES, r.stage)}</td>
                <td>{labelOf(BUDGETS, r.budget_band)}</td>
                <td className="mono">{r.progress}/3</td>
                <td>
                  {r.contact_name}, {r.contact_role}
                  <div className="note mono">TG @{r.contact_telegram}</div>
                </td>
                <td>{fmtDate(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </TableBox>
      ) : (
        <CardGrid>
          {rows.map((r) => (
            <CardLink key={r.id} id={r.id} label={`Open ${r.project_name}`}>
              <ProjectCard p={{ ...r, user_id: r.id }} contact={r} status={r.status} />
            </CardLink>
          ))}
        </CardGrid>
      )}
      <Pager base={BASE} params={params} page={f.page} total={counts[f.tab]} />
    </>
  );
}
