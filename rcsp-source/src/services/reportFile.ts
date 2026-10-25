import { buildChecklist, checklistCounts, sectionItems, type ChecklistItem } from "../engine/checklist";
import type { Screening } from "../engine/types";
import { sourceById } from "../data/sources";
import { formatFolio, formatSqFt, formatWhen } from "../engine/text";
import { translate, type Lang } from "../i18n/messages";
import { actionGroups } from "../components/presentation";
import { geoFieldLines } from "./geoproperty";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function statusLabel(status: ChecklistItem["status"], lang: Lang): string {
  if (status === "searching") return translate(lang, "status.searching");
  if (status === "pass") return translate(lang, "status.pass");
  if (status === "potential_issue") return translate(lang, "status.issue");
  if (status === "missing_information") return translate(lang, "status.missing");
  if (status === "rule_not_confirmed") return translate(lang, "status.rule");
  if (status === "not_applicable") return translate(lang, "status.na");
  return translate(lang, "status.outside");
}

function locationLines(screening: Screening): string[] {
  const { facts } = screening;
  const lines = [`Address entered: ${facts.query}`];
  if (facts.parcel) {
    lines.push(`GIS site address: ${facts.parcel.siteAddress}`);
    lines.push(`Folio: ${formatFolio(facts.parcel.folio)} (${facts.parcel.folio})`);
    lines.push(`GIS city: ${facts.parcel.siteCity}`);
    if (facts.parcel.areaSqFt != null) {
      lines.push(`GIS polygon area: ${formatSqFt(facts.parcel.areaSqFt)} (not a survey)`);
    }
  }
  if (facts.municipality) lines.push(`Municipality layer: ${facts.municipality}`);
  if (facts.zoning) lines.push(`Zone layer: ${facts.zoning.code} — ${facts.zoning.description}`);
  if (facts.municipalZoning) lines.push(`Municipal zone label: ${facts.municipalZoning.code}`);
  if (facts.insideUdb != null) lines.push(`Inside mapped UDB polygon: ${facts.insideUdb ? "yes" : "no"}`);
  if (facts.addressRecord) {
    lines.push(`Address source: ${facts.addressRecord.sourceName}`);
    lines.push(`GeoProperty retrieved: ${formatWhen(facts.addressRecord.retrievedAt)}`);
    lines.push(...geoFieldLines(facts.addressRecord).map((line) => `GeoProperty ${line}`));
  }
  if (facts.primaryZoneDescription) lines.push(`Primary-zone description: ${facts.primaryZoneDescription}`);
  if (facts.addressDisagreement) lines.push(facts.addressDisagreement);
  if (facts.zoneDisagreement) lines.push(facts.zoneDisagreement);
  if (facts.geocode) lines.push(`Geocoder: ${facts.geocode.displayName}`);
  lines.push(`Site facts: ${facts.dataOrigin}`);
  lines.push(`Screened: ${formatWhen(screening.createdAt)}`);
  return lines;
}

export function reportText(screening: Screening, lang: Lang = "en"): string {
  const items = buildChecklist(screening.facts, screening.checks, screening.research, screening.answers, lang);
  const counts = checklistCounts(items);
  const blocks = [
    "RCSP — Resilient Civic Supply Pipeline",
    translate(lang, "report.title"),
    translate(lang, "report.printNote"),
    translate(lang, "agent.noModel"),
    translate(lang, "list.englishQuote"),
    "",
    ...locationLines(screening),
    "",
    `${translate(lang, "list.checked")}: ${counts.checked}. ${translate(lang, "list.passed")}: ${counts.passed}. ${translate(lang, "list.issues")}: ${counts.issues}. ${translate(lang, "list.unresolved")}: ${counts.unresolved}.`,
    "No approval probability is stated.",
    "",
    translate(lang, "sec.found"),
    ...section(sectionItems(items, "found"), lang),
    "",
    translate(lang, "sec.promising"),
    ...section(sectionItems(items, "promising"), lang),
    "",
    translate(lang, "sec.problems"),
    ...section(sectionItems(items, "problems"), lang),
    "",
    translate(lang, "sec.unknown"),
    ...section(sectionItems(items, "unknown"), lang),
    "",
    translate(lang, "sec.next"),
    ...actionGroups(items).flatMap((group, index) =>
      [`${index + 1}. ${translate(lang, group.actor)}: ${group.titles.join("; ")}`, group.url ? `   ${group.sourceTitle} ${group.url}` : ""].filter(Boolean),
    ),
    "",
    "SOURCES",
    ...sourceBlock(screening, items),
  ];
  return blocks.join("\n");
}

function section(items: ChecklistItem[], lang: Lang): string[] {
  if (!items.length) return ["- None."];
  return items.flatMap((entry) => [
    `- ${entry.requirement} [${statusLabel(entry.status, lang)}]`,
    `  ${entry.found}`,
    entry.whyOpen ? `  ${entry.whyOpen}` : "",
    entry.searched ? `  ${entry.searched}` : "",
    entry.nextAction ? `  ${entry.nextAction}` : "",
    entry.sourceUrl ? `  ${entry.sourceTitle} ${entry.sourceUrl}` : "",
  ].filter(Boolean));
}

function sourceBlock(screening: Screening, items: ChecklistItem[]): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const entry of items) {
    if (!entry.sourceUrl || seen.has(entry.sourceUrl)) continue;
    seen.add(entry.sourceUrl);
    lines.push(`- ${entry.sourceTitle}`, `  ${entry.sourceUrl}`, entry.retrievedAt ? `  ${entry.retrievedAt}` : "");
  }
  const ids = [...new Set(screening.checks.flatMap((item) => item.sourceIds))];
  for (const id of ids) {
    const source = sourceById(id);
    if (!source || seen.has(source.url)) continue;
    seen.add(source.url);
    lines.push(`- ${source.title}`, `  ${source.url}`, `  Retrieved ${source.retrieved}. ${source.note}`);
  }
  return lines.filter(Boolean);
}

export function reportHtml(screening: Screening, lang: Lang = "en"): string {
  const items = buildChecklist(screening.facts, screening.checks, screening.research, screening.answers, lang);
  const counts = checklistCounts(items);
  const body = `
  <h1>${escapeHtml(translate(lang, "report.title"))}</h1>
  <p class="sub">Resilient Civic Supply Pipeline</p>
  <p class="banner">${escapeHtml(translate(lang, "report.printNote"))} ${escapeHtml(translate(lang, "agent.noModel"))}</p>
  <p>${escapeHtml(translate(lang, "list.englishQuote"))}</p>
  ${screening.facts.dataOrigin === "snapshot" ? `<p class="banner">${escapeHtml(translate(lang, "prop.snapshotBody"))}</p>` : ""}
  <ul>${locationLines(screening).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
  <p>${escapeHtml(translate(lang, "list.checked"))}: ${counts.checked}. ${escapeHtml(translate(lang, "list.passed"))}: ${counts.passed}. ${escapeHtml(translate(lang, "list.issues"))}: ${counts.issues}. ${escapeHtml(translate(lang, "list.unresolved"))}: ${counts.unresolved}.</p>
  ${htmlGroup(translate(lang, "sec.promising"), sectionItems(items, "promising"), lang)}
  ${htmlGroup(translate(lang, "sec.problems"), sectionItems(items, "problems"), lang)}
  ${htmlGroup(translate(lang, "sec.unknown"), sectionItems(items, "unknown"), lang)}
  <h2>${escapeHtml(translate(lang, "sec.next"))}</h2>
  <ol>${actionGroups(items)
    .map((group) => `<li><strong>${escapeHtml(translate(lang, group.actor))}.</strong> ${escapeHtml(group.titles.join("; "))}${group.url ? ` <a href="${escapeHtml(group.url)}">${escapeHtml(group.sourceTitle)}</a>` : ""}</li>`)
    .join("")}</ol>
  <h2>${escapeHtml(translate(lang, "report.sources"))}</h2>
  <ul>${sourceBlock(screening, items)
    .map((line) => `<li>${escapeHtml(line.replace(/^- /, ""))}</li>`)
    .join("")}</ul>
  `;
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"/><title>RCSP screening</title>
  <style>
    body{font-family:Georgia,serif;color:#1b2421;margin:2rem;line-height:1.45}
    h1{font-size:1.6rem;margin-bottom:0} .sub{margin-top:0.2rem}
    .banner{background:#f4ead7;padding:0.7rem 0.9rem} .badge{display:inline-block;border:1px solid #8d4b24;color:#8d4b24;padding:0.15rem 0.45rem;font-family:sans-serif;font-size:0.8rem;letter-spacing:0.04em;text-transform:uppercase}
    h2{font-size:1.15rem;margin-top:1.6rem} article{border-top:1px solid #ddd;padding-top:0.6rem;margin-top:0.8rem}
  </style></head><body>${body}</body></html>`;
}

function htmlGroup(title: string, items: ChecklistItem[], lang: Lang): string {
  const inner = items.length
    ? items
        .map(
          (entry) => `<article><h3>${escapeHtml(entry.requirement)} — ${escapeHtml(statusLabel(entry.status, lang))}</h3>
          <p>${escapeHtml(entry.found)}</p>
          ${entry.whyOpen ? `<p>${escapeHtml(entry.whyOpen)}</p>` : ""}
          ${entry.nextAction ? `<p>${escapeHtml(entry.nextAction)}</p>` : ""}
          ${entry.sourceUrl ? `<p><a href="${escapeHtml(entry.sourceUrl)}">${escapeHtml(entry.sourceTitle)}</a></p>` : ""}
          </article>`,
        )
        .join("")
    : "<p>None.</p>";
  return `<h2>${escapeHtml(title)}</h2>${inner}`;
}

export function downloadFile(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
