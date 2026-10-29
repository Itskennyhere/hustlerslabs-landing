import { requireAdmin } from "@/lib/auth";
import { memberTypeCounts } from "@/lib/member-lists";
import { plural } from "@/lib/list";

function TypeTile({ href, title, lines }: { href: string; title: string; lines: string[] }) {
  return (
    <a className="type-tile" href={href}>
      <span className="tile-title">{title}</span>
      {lines.map((l, i) => (
        <span key={i} className={i === 0 ? "type-tile-main" : "tile-note"}>
          {l}
        </span>
      ))}
    </a>
  );
}

export default async function MembersChooserPage() {
  await requireAdmin();
  const c = await memberTypeCounts();
  return (
    <>
      <div className="tag">Admin</div>
      <h1>Members.</h1>
      <p className="sub">Pick a type to see everyone who registered as it, with their card and status.</p>

      <div className="type-tiles">
        <TypeTile
          href="/admin/members/projects"
          title="Projects"
          lines={[plural(c.projects, "project"), `${c.projects_waiting} waiting for approval`, `${c.projects_finished} workspace finished`]}
        />
        <TypeTile href="/admin/members/investors" title="Investors" lines={["Coming soon", "Preview the investor card"]} />
        <TypeTile
          href="/admin/members/creators"
          title="Creators"
          lines={[plural(c.creators, "creator"), `${c.creators_waiting} waiting for approval`, `${c.creators_pending_review} pending review`]}
        />
      </div>

      <p className="alt">
        <a href="/admin/members/all">All members (table)</a>
      </p>
    </>
  );
}
