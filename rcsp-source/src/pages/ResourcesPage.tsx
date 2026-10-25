import { financingLinks, planningLinks, professionalLinks, type ResourceLink } from "../data/resources";
import { useI18n } from "../i18n/LanguageProvider";

export function ResourcesPage() {
  const { t } = useI18n();
  return (
    <>
      <p className="fine">{t("resources.english")}</p>
      <p className="eyebrow">Resources</p>
      <h1>Where to go after a screen</h1>
      <p className="lede">
        Every link below was opened on October 25, 2026. RCSP does not name architecture firms, engineering
        firms, or permit expeditors. Use the public directories and the county offices.
      </p>
      <ResourceGroup title="Planning and the county record" links={planningLinks} />
      <ResourceGroup title="Licensed professionals and permits" links={professionalLinks} />
      <ResourceGroup title="Financing" links={financingLinks} />
      <section className="panel">
        <h2>What this page will not do</h2>
        <p>
          It will not estimate rent, quote a construction cost, or match a lender. The county accessory-unit
          page warns that adding a unit can change assessed value, homestead treatment, and senior exemptions.
          Ask the Property Appraiser before renting.
        </p>
      </section>
    </>
  );
}

function ResourceGroup({ title, links }: { title: string; links: ResourceLink[] }) {
  return (
    <section>
      <h2>{title}</h2>
      <ul className="resource-list">
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href}>{link.title}</a>
            <p>{link.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
