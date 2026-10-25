import { Link } from "react-router-dom";
import { buildChecklist, checklistCounts } from "../engine/checklist";
import type { Screening, SiteFacts } from "../engine/types";
import { formatFolio, formatSqFt, formatWhen } from "../engine/text";
import { useI18n } from "../i18n/LanguageProvider";
import type { MessageKey } from "../i18n/messages";
import { propertySearchUrl } from "../data/samples";
import { geoFieldLines } from "../services/geoproperty";
import { MapPanel } from "./MapPanel";
import { ScreenTabs } from "./ScreenTabs";
import { Checklist } from "./Checklist";
import { AgentPanel } from "./AgentPanel";
import { actionGroups, priorityLines, rulesKey } from "./presentation";
import { usePropertyResearch } from "./usePropertyResearch";

export function Dashboard({ screening, onChange }: { screening: Screening; onChange: (next: Screening) => void }) {
  const { lang, t } = useI18n();
  const { searchError, retrySearch } = usePropertyResearch(screening, onChange);
  const items = buildChecklist(screening.facts, screening.checks, screening.research, screening.answers, lang);
  const counts = checklistCounts(items);
  const facts = screening.facts;
  const actions = actionGroups(items);
  const priorities = priorityLines(items, facts);
  const address = facts.addressRecord?.address || facts.parcel?.siteAddress || "";
  const folio = facts.parcel?.folio || facts.addressRecord?.folio || "";
  const rules = rulesKey(facts);

  return (
    <>
      <ScreenTabs id={screening.id} />
      <section className="summary" aria-label={t("dash.confirmed")}>
        <div>
          <p className="kicker">{t("dash.confirmed")}</p>
          <h1>{address || facts.query}</h1>
          <dl className="summary-facts">
            {address && (
              <div>
                <dt>{t("dash.address")}</dt>
                <dd>{address}</dd>
              </div>
            )}
            {folio && (
              <div>
                <dt>{t("dash.parcel")}</dt>
                <dd>
                  {formatFolio(folio)} <span className="fine">({folio})</span>
                </dd>
              </div>
            )}
            <div>
              <dt>{t("dash.rules")}</dt>
              <dd>{t(rules.key, rules.place ? { place: rules.place } : undefined)}</dd>
            </div>
          </dl>
          <p className="fine">{t("prop.screened", { when: formatWhen(screening.createdAt) })}</p>
          <details className="record-details">
            <summary>{t("dash.details")}</summary>
            <RecordFacts facts={facts} />
          </details>
        </div>
        <MapPanel facts={facts} />
      </section>

      <section className="stat-grid" aria-label={t("list.title")}>
        <Stat label={t("stat.checked")} value={counts.checked} />
        <Stat label={t("stat.passed")} value={counts.passed} />
        <Stat label={t("stat.issues")} value={counts.issues} />
        <Stat label={t("stat.unresolved")} value={counts.unresolved} />
      </section>
      <p className="open-note">{t("dash.openNote")}</p>
      {counts.searching > 0 && (
        <p className="searching-line" role="status">
          {t("dash.searching", { count: counts.searching })}
        </p>
      )}

      <section className="panel priority-panel" aria-labelledby="priority-heading">
        <h2 id="priority-heading">{t("priority.title")}</h2>
        {priorities.length === 0 ? (
          <p>{t("priority.empty")}</p>
        ) : (
          <ul className="priority-list">
            {priorities.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </section>

      <Checklist screening={screening} onChange={onChange} searchError={searchError} onRetry={retrySearch} />

      <section className="panel next-panel" aria-labelledby="next-heading">
        <h2 id="next-heading">{t("next.title")}</h2>
        <p>{t("next.intro")}</p>
        {counts.searching > 0 && actions.length === 0 ? (
          <p>{t("next.wait")}</p>
        ) : actions.length === 0 ? (
          <p>{t("next.empty")}</p>
        ) : (
          <ol className="next-list">
            {actions.map((group) => (
              <li key={group.actor}>
                <p className="next-do">{t(group.actor)}</p>
                <p>{t(nextIntroKey(group.actor))}</p>
                <p>{group.titles.join("; ")}</p>
                {group.url && (
                  <p>
                    <a href={group.url}>{group.sourceTitle}</a>
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
        <div className="action-row">
          <Link className="btn btn-ghost" to={`/property/${screening.id}/report`}>
            {t("tab.report")}
          </Link>
          <Link className="btn btn-ghost" to="/">
            {t("prop.newSearch")}
          </Link>
        </div>
      </section>

      <AgentPanel screening={screening} onChange={onChange} />
    </>
  );
}

function nextIntroKey(actor: MessageKey): MessageKey {
  if (actor === "who.surveyor") return "next.surveyor";
  if (actor === "who.designer") return "next.designer";
  if (actor === "who.homeowner") return "next.homeowner";
  if (actor === "who.city") return "next.city";
  return "next.county";
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <p className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </p>
  );
}

function RecordFacts({ facts }: { facts: SiteFacts }) {
  const { t } = useI18n();
  const rows: Array<{ term: string; value: string }> = [];
  if (facts.query) rows.push({ term: t("fact.entered"), value: facts.query });
  if (facts.parcel?.siteAddress) rows.push({ term: t("fact.gisAddress"), value: facts.parcel.siteAddress });
  if (facts.parcel?.siteCity) rows.push({ term: t("fact.gisCity"), value: facts.parcel.siteCity });
  if (facts.municipality) rows.push({ term: t("fact.muni"), value: facts.municipality });
  if (facts.zoning) rows.push({ term: t("fact.zone"), value: `${facts.zoning.code} — ${facts.zoning.description}` });
  if (facts.municipalZoning) {
    rows.push({
      term: t("fact.cityZone"),
      value: `${facts.municipalZoning.code}${facts.municipalZoning.description ? ` (${facts.municipalZoning.description})` : ""}`,
    });
  }
  if (facts.parcel?.areaSqFt != null) rows.push({ term: t("fact.area"), value: t("fact.areaNote", { area: formatSqFt(facts.parcel.areaSqFt) }) });
  if (facts.insideUdb != null) rows.push({ term: t("fact.udb"), value: facts.insideUdb ? t("fact.udbYes") : t("fact.udbNo") });
  if (facts.cdmpDescriptions.length) rows.push({ term: t("fact.cdmp"), value: facts.cdmpDescriptions.join("; ") });
  if (facts.primaryZoneDescription) rows.push({ term: t("fact.primary"), value: t("fact.primaryNote", { value: facts.primaryZoneDescription }) });
  rows.push({ term: t("fact.source"), value: originLabel(facts.dataOrigin, t) });
  return (
    <>
      <dl className="facts">
        {rows.map((row) => (
          <div key={row.term}>
            <dt>{row.term}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {facts.addressRecord && (
        <>
          <p className="fine">{t("prop.geoTime", { when: formatWhen(facts.addressRecord.retrievedAt) })}</p>
          <ul className="field-list">
            {geoFieldLines(facts.addressRecord).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="fine">{t("prop.clucNote")}</p>
        </>
      )}
      {facts.addressDisagreement && <p>{facts.addressDisagreement}</p>}
      {facts.zoneDisagreement && <p>{facts.zoneDisagreement}</p>}
      {facts.parcelNote && <p className="fine">{facts.parcelNote}</p>}
      {facts.parcel && (
        <p>
          <a href={propertySearchUrl}>{t("home.recordLink")}</a>
        </p>
      )}
      <p className="fine">{t("home.recordNote")}</p>
    </>
  );
}

function originLabel(origin: SiteFacts["dataOrigin"], t: (key: MessageKey) => string): string {
  if (origin === "live") return t("origin.live");
  if (origin === "snapshot") return t("origin.snapshot");
  return t("origin.none");
}
