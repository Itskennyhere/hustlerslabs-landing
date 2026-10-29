import { notFound, redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { getAccountType, getWorkspace } from "@/lib/onboarding";
import { BuyingForm, GoalsForm, MarketingForm } from "../SectionForms";

const SECTIONS = {
  goals: { title: "Goals.", sub: "What you are working towards.", Form: GoalsForm },
  marketing: { title: "Current marketing.", sub: "Where your marketing is today.", Form: MarketingForm },
  buying: { title: "Tools and payment.", sub: "What would help most, and how you would like to pay.", Form: BuyingForm },
} as const;

export default async function WorkspaceSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const s = await requireMember();
  if ((await getAccountType(s.userId)) !== "project") redirect("/members");
  const { section } = await params;
  if (!Object.hasOwn(SECTIONS, section)) notFound();
  const { title, sub, Form } = SECTIONS[section as keyof typeof SECTIONS];
  const w = await getWorkspace(s.userId);

  return (
    <>
      <div className="tag">Workspace</div>
      <h1>{title}</h1>
      <p className="sub">{sub}</p>
      <Form values={(w ?? {}) as Record<string, string | string[] | null>} />
    </>
  );
}
