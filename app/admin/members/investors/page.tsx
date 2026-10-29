import { requireAdmin } from "@/lib/auth";
import { SAMPLE_INVESTOR } from "@/lib/sample-cards";
import InvestorCard from "@/components/InvestorCard";
import { ExampleFrame } from "@/components/card-parts";
import { BackLink } from "@/components/list";

// Preview only. There is no investor account type yet.
export default async function InvestorsPage() {
  await requireAdmin();
  return (
    <>
      <BackLink href="/admin/members">Back to members</BackLink>
      <div className="tag">Members</div>
      <h1>Investors.</h1>
      <div className="empty-type">
        <p>Investor sign-up is not open yet. This is how their card will look.</p>
      </div>
      <div className="example-solo">
        <ExampleFrame>
          <InvestorCard i={SAMPLE_INVESTOR} status="approved" />
        </ExampleFrame>
      </div>
    </>
  );
}
