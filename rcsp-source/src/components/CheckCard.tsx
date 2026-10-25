import type { CheckResult } from "../engine/types";
import { sourceById } from "../data/sources";
import { useI18n } from "../i18n/LanguageProvider";
import { RulePill, StatusPill } from "./StatusPill";

export function CheckCard({ item }: { item: CheckResult }) {
  const { t } = useI18n();
  return (
    <article className={`check check-${item.status}`}>
      <header>
        <h3>{item.title}</h3>
        <div className="pill-row">
          <StatusPill status={item.status} />
          <RulePill rule={item.ruleState} />
        </div>
      </header>
      <p>{item.finding}</p>
      {item.evidence.length > 0 && (
        <ul>
          {item.evidence.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {item.missing.length > 0 && (
        <p className="missing">
          <strong>{t("missing.lead")} </strong>
          {item.missing.join(" ")}
        </p>
      )}
      {item.sourceIds.length > 0 && (
        <p className="source-line">
          {item.sourceIds.map((id, index) => {
            const source = sourceById(id);
            if (!source) return null;
            return (
              <span key={id}>
                {index > 0 ? " · " : `${t("source.lead")} `}
                <a href={source.url}>{source.title}</a>
              </span>
            );
          })}
        </p>
      )}
    </article>
  );
}

export function CheckGroups({ checks, emptyPass }: { checks: CheckResult[]; emptyPass?: string }) {
  const { t } = useI18n();
  const groups: Array<{ title: string; status: CheckResult["status"]; empty: string }> = [
    { title: t("group.pass"), status: "PASS", empty: emptyPass ?? t("assess.emptyPass") },
    { title: t("group.flag"), status: "FLAG", empty: t("group.flagEmpty") },
    { title: t("group.verify"), status: "NEEDS_VERIFICATION", empty: t("group.verifyEmpty") },
  ];
  return (
    <>
      {groups.map((group) => {
        const items = checks.filter((item) => item.status === group.status);
        return (
          <section key={group.status} className="check-group">
            <h2>{group.title}</h2>
            {items.length === 0 ? <p className="muted">{group.empty}</p> : items.map((item) => <CheckCard key={item.id} item={item} />)}
          </section>
        );
      })}
    </>
  );
}
