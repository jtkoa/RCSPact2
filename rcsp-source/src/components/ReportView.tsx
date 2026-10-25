import { buildChecklist, checklistCounts, sectionItems, type ChecklistItem } from "../engine/checklist";
import type { Screening } from "../engine/types";
import { formatFolio, formatWhen } from "../engine/text";
import { useI18n } from "../i18n/LanguageProvider";
import type { MessageKey } from "../i18n/messages";
import { sourceById } from "../data/sources";
import { actionGroups, conciseFinding, rulesKey } from "./presentation";

const statusKey: Record<ChecklistItem["status"], MessageKey> = {
  searching: "status.searching",
  pass: "status.pass",
  potential_issue: "status.issue",
  missing_information: "status.missing",
  rule_not_confirmed: "status.rule",
  outside_review: "status.outside",
  not_applicable: "status.na",
};

export function ReportView({ screening }: { screening: Screening }) {
  const { lang, t } = useI18n();
  const items = buildChecklist(screening.facts, screening.checks, screening.research, screening.answers, lang);
  const counts = checklistCounts(items);
  const address = screening.facts.addressRecord?.address ?? screening.facts.parcel?.siteAddress ?? screening.facts.query;
  const folio = screening.facts.parcel?.folio || screening.facts.addressRecord?.folio || "";
  const rules = rulesKey(screening.facts);
  const citations = citationsFor(screening, items);

  return (
    <article className="report-view" id="report">
      <header className="report-head">
        <p className="kicker">{t("report.eyebrow")}</p>
        <h1>{t("report.title")}</h1>
        <p>{address}</p>
        <p>
          {t("report.prepared", {
            address,
            when: formatWhen(screening.createdAt),
            pass: counts.passed,
            flag: counts.issues,
            verify: counts.unresolved,
          })}
        </p>
        {folio && (
          <p>
            {t("dash.parcel")}: {formatFolio(folio)} ({folio})
          </p>
        )}
        <p>{t(rules.key, rules.place ? { place: rules.place } : undefined)}</p>
        <p className="fine">{t("agent.noModel")}</p>
      </header>

      {screening.facts.dataOrigin === "snapshot" && <p className="notice notice-warn">{t("prop.snapshotBody")}</p>}

      <section>
        <h2>{t("sec.found")}</h2>
        {sectionItems(items, "found").length === 0 ? (
          <p>{t("dash.searching", { count: counts.searching })}</p>
        ) : (
          sectionItems(items, "found").map((entry) => (
            <div key={entry.id} className="report-item">
              <h3>
                {entry.requirement} <span className={`pill pill-${entry.status}`}>{t(statusKey[entry.status])}</span>
              </h3>
              <p>{conciseFinding(entry.found)}</p>
              {entry.whyOpen && <p>{entry.whyOpen}</p>}
              {entry.sourceUrl && (
                <p>
                  <a href={entry.sourceUrl}>{entry.sourceTitle}</a>
                </p>
              )}
            </div>
          ))
        )}
      </section>
      <TitleList title={t("sec.promising")} items={sectionItems(items, "promising")} empty={t("assess.emptyPass")} />
      <TitleList title={t("sec.problems")} items={sectionItems(items, "problems")} empty={t("group.flagEmpty")} />
      <TitleList title={t("sec.unknown")} items={sectionItems(items, "unknown")} empty={t("group.verifyEmpty")} />

      <section>
        <h2>{t("sec.next")}</h2>
        <ol>
          {actionGroups(items).map((group) => (
            <li key={group.actor}>
              <strong>{t(group.actor)}. </strong>
              {group.titles.join("; ")}
              {group.url ? (
                <>
                  {" "}
                  <a href={group.url}>{group.sourceTitle}</a>
                </>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2>{t("report.sources")}</h2>
        <ul className="source-list">
          {citations.map((citation) => (
            <li key={citation.url}>
              <a href={citation.url}>{citation.title}</a>
              {citation.when ? <span> {t("report.retrieved", { when: citation.when })}</span> : null}
              {citation.note ? <span> {citation.note}</span> : null}
            </li>
          ))}
        </ul>
      </section>
      <p className="disclaimer print-disclaimer">{t("report.printNote")}</p>
    </article>
  );
}

function TitleList({ title, items, empty }: { title: string; items: ChecklistItem[]; empty: string }) {
  return (
    <section>
      <h2>{title}</h2>
      {items.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <ul>
          {items.map((entry) => (
            <li key={entry.id}>{entry.requirement}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function citationsFor(screening: Screening, items: ChecklistItem[]) {
  const seen = new Set<string>();
  const rows: Array<{ url: string; title: string; when: string; note: string }> = [];
  for (const entry of items) {
    if (!entry.sourceUrl || seen.has(entry.sourceUrl)) continue;
    seen.add(entry.sourceUrl);
    rows.push({ url: entry.sourceUrl, title: entry.sourceTitle, when: entry.retrievedAt, note: "" });
  }
  for (const sourceId of [...new Set(screening.checks.flatMap((item) => item.sourceIds))]) {
    const source = sourceById(sourceId);
    if (!source || seen.has(source.url)) continue;
    seen.add(source.url);
    rows.push({ url: source.url, title: source.title, when: source.retrieved, note: source.note });
  }
  return rows;
}
