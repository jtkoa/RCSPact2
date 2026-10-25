import { useRef, useState, type FormEvent } from "react";
import { buildChecklist, checklistCounts, type ChecklistItem, type ChecklistStatus } from "../engine/checklist";
import type { HomeownerAnswers } from "../engine/researchTypes";
import type { Screening } from "../engine/types";
import { formatWhen } from "../engine/text";
import { useI18n } from "../i18n/LanguageProvider";
import type { MessageKey } from "../i18n/messages";
import { updateScreening } from "../services/screening";
import { actorKey, conciseFinding, findingRest, requirementGroups } from "./presentation";
import type { ResearchStatus } from "../engine/checklist";

const statusKey: Record<ChecklistStatus, MessageKey> = {
  searching: "status.searching",
  pass: "status.pass",
  potential_issue: "status.issue",
  missing_information: "status.missing",
  rule_not_confirmed: "status.rule",
  outside_review: "status.outside",
  not_applicable: "status.na",
};

const researchKey: Record<ResearchStatus, MessageKey> = {
  not_started: "research.notStarted",
  searching: "research.searching",
  completed: "research.completed",
  blocked: "research.blocked",
};

export function Checklist({
  screening,
  onChange,
  showForm = true,
  searchError = false,
  onRetry,
}: {
  screening: Screening;
  onChange: (next: Screening) => void;
  showForm?: boolean;
  searchError?: boolean;
  onRetry?: () => void;
}) {
  const { lang, t } = useI18n();
  const items = buildChecklist(screening.facts, screening.checks, screening.research, screening.answers, lang);
  const counts = checklistCounts(items);
  const placed = new Set(requirementGroups.flatMap((group) => group.ids));
  const extras = items.filter((entry) => !placed.has(entry.id));

  return (
    <section className="checklist-section" aria-labelledby="checklist-heading">
      <div className="section-head">
        <h2 id="checklist-heading">{t("list.title")}</h2>
        <p>{t("list.intro")}</p>
      </div>
      {searchError && (
        <div className="notice notice-stop" role="status">
          <p>{t("list.searchError")}</p>
          {onRetry && (
            <button className="btn btn-ghost" type="button" onClick={onRetry}>
              {t("prop.retry")}
            </button>
          )}
        </div>
      )}
      {requirementGroups.map((group) => {
        const rows = group.ids.map((id) => items.find((entry) => entry.id === id)).filter((entry): entry is ChecklistItem => Boolean(entry));
        const withExtras = group.id === "permits" ? [...rows, ...extras] : rows;
        return <RequirementGroup key={group.id} title={t(group.title)} rows={withExtras} />;
      })}
      {showForm && (
        <details className="group">
          <summary>
            <span>{t("group.owner")}</span>
          </summary>
          <div className="group-body">
            {counts.searching > 0 ? (
              <p>{t("dash.formWait")}</p>
            ) : (
              <AnswerForm screening={screening} onChange={onChange} />
            )}
          </div>
        </details>
      )}
    </section>
  );
}

function RequirementGroup({ title, rows }: { title: string; rows: ChecklistItem[] }) {
  const { t } = useI18n();
  const done = rows.filter((entry) => entry.status !== "searching").length;
  return (
    <details className="group">
      <summary>
        <span>{title}</span>
        <span className="group-count">{t("group.count", { done, total: rows.length })}</span>
      </summary>
      <div className="group-body">
        {rows.map((entry) => (
          <ChecklistRow key={entry.id} entry={entry} />
        ))}
      </div>
    </details>
  );
}

function ChecklistRow({ entry }: { entry: ChecklistItem }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rest = findingRest(entry.found);
  const kindKey: MessageKey | null =
    entry.sourceKind === "record" ? "kind.record" : entry.sourceKind === "map" ? "kind.map" : entry.sourceKind === "calculated" ? "kind.calculated" : null;
  const hasDetails = Boolean(rest || entry.whyOpen || entry.searched || entry.nextAction || entry.sourceUrl || entry.evidence.length || entry.englishNote || entry.checking);
  return (
    <article className={`req req-${entry.status}`}>
      <div className="req-main">
        <span className={`pill pill-${entry.status}`}>{t(statusKey[entry.status])}</span>
        <div>
          <h3>{entry.requirement}</h3>
          <p>{conciseFinding(entry.found)}</p>
          {hasDetails && (
            <button className="btn btn-ghost evidence-btn" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
              {open ? t("list.hideEvidence") : t("list.viewEvidence")}
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="req-more">
          <p>
            <strong>{t("list.research")}. </strong>
            {t(researchKey[entry.researchStatus])}
          </p>
          {rest && <p>{rest}</p>}
          {entry.whyOpen && (
            <p>
              <strong>{t("list.missingLabel")}. </strong>
              {entry.whyOpen}
            </p>
          )}
          {entry.nextAction && (
            <p>
              <strong>{t("list.next")}. </strong>
              {entry.nextAction}
              {entry.who ? ` (${t(actorKey(entry))})` : ""}
            </p>
          )}
          {entry.searched && (
            <p>
              <strong>{t("list.searched")}. </strong>
              {entry.searched}
            </p>
          )}
          {entry.checking && (
            <p>
              <strong>{t("list.checking")}. </strong>
              {entry.checking}
            </p>
          )}
          {entry.sourceUrl && (
            <p className="source-line">
              {kindKey ? `${t(kindKey)}. ` : ""}
              <a href={entry.sourceUrl}>{entry.sourceTitle}</a>
              {entry.retrievedAt ? ` · ${formatWhen(entry.retrievedAt)}` : ""}
            </p>
          )}
          {entry.evidence.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {entry.englishNote && entry.englishNote !== entry.found && (
            <>
              <p className="fine">{t("list.englishQuote")}</p>
              <p>{entry.englishNote}</p>
            </>
          )}
        </div>
      )}
    </article>
  );
}

function AnswerForm({ screening, onChange }: { screening: Screening; onChange: (next: Screening) => void }) {
  const { t } = useI18n();
  const latest = useRef(screening);
  latest.current = screening;
  const answers = screening.answers ?? {
    proposedSqFt: null,
    sizeUnsure: false,
    placement: "unsure" as const,
    parking: "unsure" as const,
    bedrooms: null,
    bedroomsUnsure: false,
  };
  const [size, setSize] = useState(answers.proposedSqFt?.toString() ?? "");
  const [sizeUnsure, setSizeUnsure] = useState(answers.sizeUnsure === true);
  const [placement, setPlacement] = useState(answers.placement);
  const [parking, setParking] = useState(answers.parking);
  const [bedrooms, setBedrooms] = useState(answers.bedrooms?.toString() ?? "");
  const [bedroomsUnsure, setBedroomsUnsure] = useState(answers.bedroomsUnsure === true);

  function saveAnswers(event: FormEvent) {
    event.preventDefault();
    const parsed = size.trim() ? Number(size) : null;
    const proposedSqFt = !sizeUnsure && parsed != null && Number.isFinite(parsed) && parsed > 0 && parsed < 100000 ? parsed : null;
    const bedroomParsed = bedrooms.trim() ? Number(bedrooms) : null;
    const bedroomCount = !bedroomsUnsure && bedroomParsed != null && Number.isFinite(bedroomParsed) && bedroomParsed >= 0 && bedroomParsed < 20 ? Math.round(bedroomParsed) : null;
    const next: HomeownerAnswers = {
      proposedSqFt,
      sizeUnsure,
      placement,
      parking,
      bedrooms: bedroomCount,
      bedroomsUnsure,
    };
    onChange(updateScreening(latest.current, { answers: next }));
  }

  return (
    <form className="homeowner-form" onSubmit={saveAnswers}>
      <p>{t("list.formBody")}</p>
      <label htmlFor="proposed-size">{t("list.size")}</label>
      <input id="proposed-size" inputMode="numeric" value={size} disabled={sizeUnsure} onChange={(event) => setSize(event.target.value)} />
      <label className="check-line">
        <input type="checkbox" checked={sizeUnsure} onChange={(event) => setSizeUnsure(event.target.checked)} />
        {t("list.notSure")}
      </label>
      <label htmlFor="placement">{t("list.placement")}</label>
      <select id="placement" value={placement} onChange={(event) => setPlacement(event.target.value as HomeownerAnswers["placement"])}>
        <option value="unsure">{t("list.placeUnsure")}</option>
        <option value="behind">{t("list.placeBehind")}</option>
        <option value="in-front">{t("list.placeFront")}</option>
      </select>
      <label htmlFor="parking">{t("list.parking")}</label>
      <select id="parking" value={parking} onChange={(event) => setParking(event.target.value as HomeownerAnswers["parking"])}>
        <option value="unsure">{t("list.parkUnsure")}</option>
        <option value="on-site">{t("list.parkSite")}</option>
        <option value="street">{t("list.parkStreet")}</option>
      </select>
      <label htmlFor="bedrooms">{t("list.bedrooms")}</label>
      <input id="bedrooms" inputMode="numeric" value={bedrooms} disabled={bedroomsUnsure} onChange={(event) => setBedrooms(event.target.value)} />
      <label className="check-line">
        <input type="checkbox" checked={bedroomsUnsure} onChange={(event) => setBedroomsUnsure(event.target.checked)} />
        {t("list.notSure")}
      </label>
      <button className="btn" type="submit">
        {t("list.save")}
      </button>
    </form>
  );
}
