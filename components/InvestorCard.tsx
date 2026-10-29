import { cleanHandle, initials } from "@/lib/platforms";
import type { InvestorCardData } from "@/lib/sample-cards";
import Avatar from "./Avatar";
import { CardStrip, StatusChip, Stats, Tags, VerifiedTick, cardNo, joined, since, type MemberStatus } from "./card-parts";

/** The investor ID card. Preview only until investor sign-up opens; built against `InvestorCardData`. */
export default function InvestorCard({ i, status }: { i: InvestorCardData; status?: MemberStatus }) {
  const handle = cleanHandle(i.x_handle ?? "");
  return (
    <article className="ccard full icard">
      <CardStrip type="investor" no={cardNo(i.member_no)} />
      <div className="ccard-body">
        <div className="ccard-identity">
          <Avatar src={handle ? `https://unavatar.io/x/${handle}` : null} fallback={initials(i.display_name)} size={72} />
          <div className="ccard-id">
            <h3>
              <span className="ccard-name">{i.display_name}</span>
              {i.verified && <VerifiedTick />}
            </h3>
            <span className="ccard-handle">
              {i.role}, {i.fund_name}
            </span>
            {handle && <span className="ccard-handle">@{handle}</span>}
          </div>
        </div>

        {i.bio && <p className="ccard-bio">{i.bio}</p>}
        <Stats
          cells={[
            ["Check size", i.check_size],
            ["Type", i.investor_type],
            ["Region", i.region],
          ]}
        />
        <Tags tags={[...i.stages, ...i.sectors]} />
      </div>

      <footer className="ccard-foot">
        {status ? <StatusChip status={status} /> : <span />}
        <span className="ccard-since">{status ? joined(i.created_at) : since(i.created_at)}</span>
      </footer>
    </article>
  );
}
