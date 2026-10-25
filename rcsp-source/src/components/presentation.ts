import type { ChecklistItem } from "../engine/checklist";
import type { SiteFacts } from "../engine/types";
import type { MessageKey } from "../i18n/messages";

export const requirementGroups: Array<{ id: string; title: MessageKey; ids: string[] }> = [
  {
    id: "property",
    title: "group.property",
    ids: ["jurisdiction", "urban-development-boundary", "zoning-district", "overlays", "lot-area"],
  },
  {
    id: "building",
    title: "group.building",
    ids: ["lot-dimensions", "principal-dwelling", "setbacks"],
  },
  {
    id: "permits",
    title: "group.permits",
    ids: ["permits", "occupancy", "sale-and-rental", "private-restrictions", "state-statute"],
  },
  {
    id: "project",
    title: "group.project",
    ids: ["floor-area", "design-placement", "parking"],
  },
];

export function conciseFinding(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const match = clean.match(/^[\s\S]+?\.(?=\s|$)/);
  return match ? match[0] : clean;
}

export function findingRest(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const short = conciseFinding(clean);
  return clean.slice(short.length).trim();
}

export function actorKey(entry: ChecklistItem): MessageKey {
  if (entry.id === "lot-dimensions" && entry.who === "professional") return "who.surveyor";
  if (entry.who === "professional") return "who.designer";
  if (entry.who === "county") return "who.county";
  return "who.homeowner";
}

export function priorityLines(items: ChecklistItem[], facts: SiteFacts): string[] {
  const lines: string[] = [];
  if ((facts.zoningAreas?.length ?? 0) > 1) {
    const zoning = items.find((entry) => entry.id === "zoning-district");
    if (zoning) lines.push(zoning.found);
  }
  for (const entry of items) {
    if (entry.status === "potential_issue") lines.push(conciseFinding(entry.found));
  }
  return lines;
}

export interface ActionGroup {
  actor: MessageKey;
  titles: string[];
  url: string;
  sourceTitle: string;
}

const actorOrder: MessageKey[] = ["who.surveyor", "who.designer", "who.homeowner", "who.county"];

export function actionGroups(items: ChecklistItem[]): ActionGroup[] {
  const open = items.filter((entry) => entry.nextAction && entry.who && entry.who !== "app" && entry.status !== "pass" && entry.status !== "searching" && entry.status !== "not_applicable");
  const buckets = new Map<MessageKey, ChecklistItem[]>();
  for (const entry of open) {
    const key = actorKey(entry);
    const list = buckets.get(key) ?? [];
    list.push(entry);
    buckets.set(key, list);
  }
  const groups: ActionGroup[] = [];
  const city = items.filter((entry) => entry.status === "not_applicable");
  if (city.length) {
    groups.push({ actor: "who.city", titles: city.map((entry) => entry.requirement), url: "", sourceTitle: "" });
  }
  for (const actor of actorOrder) {
    const rows = buckets.get(actor);
    if (!rows?.length) continue;
    const link = rows.find((entry) => officialPage(entry.sourceUrl));
    groups.push({
      actor,
      titles: rows.map((entry) => entry.requirement),
      url: link?.sourceUrl ?? "",
      sourceTitle: link?.sourceTitle ?? "",
    });
  }
  return groups;
}

function officialPage(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return /(^|\.)miamidade\.gov$|(^|\.)flsenate\.gov$|(^|\.)municode\.com$|(^|\.)miamidadepa\.gov$/.test(host) && !url.includes("/arcgis/");
  } catch {
    return false;
  }
}

export function rulesKey(facts: SiteFacts): { key: MessageKey; place?: string } {
  if (facts.unincorporated === true) {
    return { key: "dash.rulesCounty", place: facts.municipality || "unincorporated Miami-Dade" };
  }
  if (facts.unincorporated === false && facts.municipality) {
    return { key: "dash.rulesCity", place: facts.municipality };
  }
  return { key: "dash.rulesUnknown" };
}
