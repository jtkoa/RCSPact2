import { buildChecklist, type ChecklistStatus } from "../engine/checklist";
import { financingLinks, planningLinks, professionalLinks } from "../data/resources";
import { sources } from "../data/sources";
import { nextSteps, unknowns } from "../engine/assess";
import type { CheckResult, Screening, SiteFacts } from "../engine/types";
import { formatFolio, formatSqFt, formatWhen } from "../engine/text";
import { translate, type Lang } from "../i18n/messages";
import { geoFieldLines } from "../services/geoproperty";

export interface ToolTrace {
  id: string;
  title: string;
  lines: string[];
}

function label(lang: Lang, status: ChecklistStatus): string {
  if (status === "searching") return translate(lang, "status.searching");
  if (status === "pass") return translate(lang, "status.pass");
  if (status === "potential_issue") return translate(lang, "status.issue");
  if (status === "missing_information") return translate(lang, "status.missing");
  if (status === "rule_not_confirmed") return translate(lang, "status.rule");
  return translate(lang, "status.outside");
}

function propertyLines(facts: SiteFacts, lang: Lang, goal: string): string[] {
  const lines = [translate(lang, "tool.fieldNote")];
  lines.push(goal.trim() ? translate(lang, "agent.goalLine", { goal: goal.trim() }) : translate(lang, "agent.noGoal"));
  const record = facts.addressRecord;
  if (!record) {
    lines.push(translate(lang, "tool.noRecord"));
  } else {
    lines.push(`${record.sourceName} · ${record.operation}`);
    lines.push(translate(lang, "prop.geoTime", { when: formatWhen(record.retrievedAt) }));
    lines.push(...geoFieldLines(record));
    lines.push(translate(lang, "prop.clucNote"));
  }
  lines.push(`${translate(lang, "fact.gisAddress")}: ${facts.parcel?.siteAddress ?? translate(lang, "fact.notRetrieved")}`);
  lines.push(`${translate(lang, "fact.folio")}: ${facts.parcel ? formatFolio(facts.parcel.folio) : translate(lang, "fact.notRetrieved")}`);
  lines.push(`${translate(lang, "fact.muni")}: ${facts.municipality ?? translate(lang, "fact.notRetrieved")}`);
  lines.push(
    `${translate(lang, "fact.zone")}: ${
      facts.zoning ? `${facts.zoning.code} — ${facts.zoning.description}` : facts.zoningNote ?? translate(lang, "fact.notRetrieved")
    }`,
  );
  lines.push(
    `${translate(lang, "fact.primary")}: ${
      facts.primaryZoneDescription
        ? translate(lang, "fact.primaryNote", { value: facts.primaryZoneDescription })
        : translate(lang, "fact.notRetrieved")
    }`,
  );
  lines.push(
    `${translate(lang, "fact.area")}: ${
      facts.parcel?.areaSqFt != null ? translate(lang, "fact.areaNote", { area: formatSqFt(facts.parcel.areaSqFt) }) : translate(lang, "fact.notRetrieved")
    }`,
  );
  if (facts.addressDisagreement) lines.push(facts.addressDisagreement);
  if (facts.zoneDisagreement) lines.push(facts.zoneDisagreement);
  lines.push(translate(lang, "prop.taxNote"));
  lines.push(translate(lang, "tool.notEligibility"));
  return lines;
}

function sourceLines(lang: Lang, checks: CheckResult[]): string[] {
  const ids = [...new Set(checks.flatMap((item) => item.sourceIds))];
  const lines = [translate(lang, "tool.sourceNote")];
  for (const id of ids) {
    const source = Object.values(sources).find((item) => item.id === id);
    if (!source) continue;
    lines.push(`${source.title} — ${source.url}`);
  }
  if (lines.length === 1) lines.push(translate(lang, "fact.notRetrieved"));
  return lines;
}

export function buildReview(screening: Screening, lang: Lang, goal: string): ToolTrace[] {
  const facts = screening.facts;
  const traces: ToolTrace[] = [
    { id: "get_property_details", title: translate(lang, "tool.property"), lines: propertyLines(facts, lang, goal) },
    { id: "search_planning_sources", title: translate(lang, "tool.sources"), lines: sourceLines(lang, screening.checks) },
    {
      id: "check_adu_requirements",
      title: translate(lang, "tool.checks"),
      lines: [
        translate(lang, "tool.notEligibility"),
        ...buildChecklist(facts, screening.checks, screening.research, screening.answers, lang).map((item) => `${item.requirement}: ${label(lang, item.status)}`),
      ],
    },
    {
      id: "identify_missing_information",
      title: translate(lang, "tool.missing"),
      lines: buildChecklist(facts, screening.checks, screening.research, screening.answers, lang)
        .filter((item) => item.status !== "pass" && item.status !== "searching")
        .map((item) => `${item.requirement}: ${item.whyOpen || item.found}`),
    },
    {
      id: "generate_feasibility_report",
      title: translate(lang, "tool.report"),
      lines: [
        translate(lang, "tool.known"),
        ...propertyLines(facts, lang, goal).slice(0, 8),
        translate(lang, "tool.uncertain"),
        ...unknowns(facts),
        translate(lang, "tool.next"),
        ...nextSteps(facts),
        translate(lang, "tool.links"),
        ...sourceLines(lang, screening.checks).slice(1),
      ],
    },
    {
      id: "find_relevant_resources",
      title: translate(lang, "tool.resources"),
      lines: [...planningLinks, ...professionalLinks, ...financingLinks].map((item) => `${item.title} — ${item.href}`),
    },
  ];
  return traces.filter((trace) => trace.lines.length > 0);
}

export function answerFollowUp(question: string, screening: Screening, lang: Lang): { toolId: string | null; lines: string[] } {
  const text = question.toLowerCase();
  const traces = buildReview(screening, lang, screening.goal ?? "");
  const pick = (id: string): { toolId: string; lines: string[] } => {
    const trace = traces.find((item) => item.id === id);
    return { toolId: id, lines: trace?.lines ?? [translate(lang, "agent.outside")] };
  };
  if (!text.trim()) return { toolId: null, lines: [] };
  if (matches(text, ["resource", "recurso", "resous", "link", "enlace", "lyen", "hud", "permit office"])) return pick("find_relevant_resources");
  if (matches(text, ["missing", "falta", "manke", "unknown", "desconoc", "pa konnen", "conflict", "conflicto", "konfli", "verif"])) {
    return pick("identify_missing_information");
  }
  if (matches(text, ["next", "paso", "pwochen", "what now", "qué hago", "kisa pou m"])) return pick("generate_feasibility_report");
  if (matches(text, ["approv", "aprob", "apwob", "permit", "permis", "pèmi", "eligible", "eligib", "kalifye"])) return pick("check_adu_requirements");
  if (
    matches(text, [
      "folio",
      "address",
      "dirección",
      "direccion",
      "adrès",
      "adres",
      "zone",
      "zona",
      "zòn",
      "lot",
      "lote",
      "teren",
      "juris",
      "city",
      "ciudad",
      "vil",
      "flood",
      "condo",
      "cluc",
      "area",
      "área",
      "sipèfisi",
      "municip",
    ])
  ) {
    return pick("get_property_details");
  }
  return { toolId: null, lines: [translate(lang, "agent.outside")] };
}

function matches(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

