import { BUDGETS, CHAINS, PROJECT_CATEGORIES, STAGES, TEAM_SIZES, labelOf } from "@/lib/onboarding-options";
import { cleanHandle, initials } from "@/lib/platforms";
import { WORKSPACE_SECTIONS } from "@/lib/onboarding";
import Avatar from "./Avatar";
import { CardStrip, StatusChip, Stats, Tags, cardNo, joined, since, type MemberStatus } from "./card-parts";

export type ProjectCardData = {
  user_id: number;
  project_name: string;
  x_handle: string;
  category: string;
  chains: string[];
  stage: string;
  budget_band: string;
  team_size: string;
  progress: number;
  created_at: string | Date;
};

/** Contact details are only ever passed in admin views. */
export type ProjectContact = { contact_name: string; contact_role: string };

/**
 * The project ID card. Projects have no member number of their own, so the strip shows the user id.
 * `admin`: show the contact, the status chip and the joined date.
 */
export default function ProjectCard({
  p,
  status,
  contact,
}: {
  p: ProjectCardData;
  status?: MemberStatus;
  contact?: ProjectContact;
}) {
  const handle = cleanHandle(p.x_handle ?? "");
  const total = WORKSPACE_SECTIONS.length;
  return (
    <article className="ccard full pcard">
      <CardStrip type="project" no={cardNo(p.user_id)} />
      <div className="ccard-body">
        <div className="ccard-identity">
          <Avatar src={handle ? `https://unavatar.io/x/${handle}` : null} fallback={initials(p.project_name)} size={72} />
          <div className="ccard-id">
            <h3>
              <span className="ccard-name">{p.project_name}</span>
            </h3>
            {handle && <span className="ccard-handle">@{handle}</span>}
            {contact && (
              <span className="ccard-handle">
                {contact.contact_name}, {contact.contact_role}
              </span>
            )}
          </div>
        </div>

        <Stats
          cells={[
            ["Stage", labelOf(STAGES, p.stage)],
            ["Budget", labelOf(BUDGETS, p.budget_band)],
            ["Team", labelOf(TEAM_SIZES, p.team_size)],
          ]}
        />
        <Tags tags={[labelOf(PROJECT_CATEGORIES, p.category), ...p.chains.map((c) => labelOf(CHAINS, c))]} />

        <div className="pcard-progress">
          <span className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={p.progress}>
            <span style={{ width: `${(p.progress / total) * 100}%` }} />
          </span>
          <span className="ccard-handle">
            Workspace {p.progress}/{total}
          </span>
        </div>
      </div>

      <footer className="ccard-foot">
        {status ? <StatusChip status={status} /> : <span />}
        <span className="ccard-since">{status ? joined(p.created_at) : since(p.created_at)}</span>
      </footer>
    </article>
  );
}
