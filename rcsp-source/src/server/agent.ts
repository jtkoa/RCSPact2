import OpenAI from "openai";
import { sources } from "../data/sources";
import { nextSteps, unknowns, assess } from "../engine/assess";
import type { CheckResult, SiteFacts } from "../engine/types";
import { formatFolio, formatSqFt } from "../engine/text";
import { normalizeStreet } from "../services/address";
import { geoFieldLines } from "../services/geoproperty";
import { lookupAddress, lookupFolio, type LookupResult } from "../services/gis";
import { setServiceOrigin } from "../services/serviceUrl";
import { buildChecklist } from "../engine/checklist";
import { folioDigits, researchKey, runResearchStep } from "./research";
import { researchSteps } from "../engine/researchTypes";

const MODEL_DEFAULT = "gpt-6-luna";
const MAX_ROUNDS = 6;
const MAX_TOOL_CALLS = 8;

export interface AgentRequestOptions {
  apiKey: string;
  model: string;
  origin: string;
}

const tools: OpenAI.Responses.Tool[] = [
  {
    type: "function",
    name: "search_property_address",
    description:
      "Look up a Miami-Dade street address with the live GeoProperty service and county parcel layer. Returns one validated record, a list of site addresses, a miss, or a service error. Never invent a record.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "get_property_details",
    description:
      "Return only the county fields retrieved for an address or a 13-digit folio. Call this after search_property_address, or with the folio that search returned. Missing fields stay missing.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "search_official_adu_rules",
    description:
      "List accessory-unit sources already opened for this product, with their real URLs, the date they were opened, and a fresh HTTP status for that URL. Does not add sources that were not opened.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { topic: { type: "string" } },
      required: ["topic"],
    },
  },
  {
    type: "function",
    name: "check_feasibility_requirements",
    description:
      "Run the screen's deterministic PASS, FLAG, and NEEDS VERIFICATION checks for a live address or folio. Missing facts stay NEEDS VERIFICATION. A pass is not an approval. Residential use is not accessory-unit eligibility.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "research_open_requirements",
    description:
      "Search public Miami-Dade property, permit, overlay, hearing, code, and lot-map sources for one 13-digit folio, then return the checklist. Each row is one requirement. Do not invent a row the tool did not return.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "generate_property_report",
    description:
      "Build a structured report from a fresh live lookup and the deterministic checks. Ignore any measurements or zoning the model might assume. Use only this tool's JSON in the written report.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
];

function instructions(language: string): string {
  const name = language === "es" ? "Spanish" : language === "ht" ? "Haitian Creole" : "English";
  return [
    `You are RCSP, a preliminary accessory-unit screen for Miami-Dade County. Write the reply in ${name}.`,
    "Call the tools before you describe a property, a rule, or a check. Explain only what the tool JSON contains.",
    "Do not invent an address, folio, lot size, zoning code, citation, probability, or eligibility. If a field is missing, say it was not retrieved.",
    "Separate three things: verified county fields, preliminary PASS / FLAG / NEEDS VERIFICATION checks, and what still needs official confirmation.",
    "A tax folio, a zone code, a single-family label, or a residential description is not accessory-unit eligibility and is not an approval.",
    "Check finding sentences are English screen text. If you quote one, say it is the English check text.",
    "If a tool returns an error or no match, say that and do not fill the gap.",
    "When a folio is known, call research_open_requirements before you explain open items. Use only that tool's checklist. Do not turn a missing fact into a pass.",
  ].join(" ");
}

function logTool(name: string, ok: boolean) {
  console.info(`rcsp-agent tool=${name} ok=${ok}`);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  return typeof value === "string" ? value.trim() : "";
}

function publicFacts(facts: SiteFacts) {
  const record = facts.addressRecord;
  return {
    dataOrigin: facts.dataOrigin,
    retrievedAt: facts.retrievedAt,
    entered: facts.query,
    geoProperty: record
      ? {
          sourceName: record.sourceName,
          operation: record.operation,
          retrievedAt: record.retrievedAt,
          fields: geoFieldLines(record),
        }
      : null,
    parcel: facts.parcel
      ? {
          folio: facts.parcel.folio,
          folioDisplay: formatFolio(facts.parcel.folio),
          siteAddress: facts.parcel.siteAddress,
          siteCity: facts.parcel.siteCity,
          zip: facts.parcel.zip,
          areaSqFt: facts.parcel.areaSqFt,
          areaLabel: facts.parcel.areaSqFt == null ? null : formatSqFt(facts.parcel.areaSqFt),
        }
      : null,
    municipalityLayer: facts.municipality,
    unincorporated: facts.unincorporated,
    zoneLayer: facts.zoning,
    zoneNote: facts.zoningNote,
    municipalZoneLabel: facts.municipalZoning,
    insideUrbanDevelopmentBoundary: facts.insideUdb,
    cdmpDescriptions: facts.cdmpDescriptions,
    primaryZoneDescription: facts.primaryZoneDescription,
    addressDisagreement: facts.addressDisagreement,
    zoneDisagreement: facts.zoneDisagreement,
    parcelNote: facts.parcelNote,
    gisErrors: facts.gisErrors,
    scope: facts.scope,
  };
}

function publicLookup(result: LookupResult) {
  if (result.kind === "ready") {
    return { kind: "ready", facts: publicFacts(result.facts) };
  }
  if (result.kind === "choose") {
    return {
      kind: "choose",
      note: result.facts.parcelNote,
      choices: result.choices.map((parcel) => ({
        folio: parcel.folio,
        folioDisplay: formatFolio(parcel.folio),
        siteAddress: parcel.siteAddress,
        siteCity: parcel.siteCity,
      })),
    };
  }
  if (result.kind === "outside") {
    return {
      kind: "outside",
      geocoder: result.facts.geocode?.displayName ?? null,
      county: result.facts.geocode?.county ?? null,
    };
  }
  return {
    kind: "error",
    code: result.code,
    detail: result.detail,
    fallback: result.fallback
      ? "A saved October 25, 2026 snapshot exists for this text. It is not a live record and was not scored."
      : null,
  };
}

function publicChecks(checks: CheckResult[]) {
  return checks.map((item) => ({
    id: item.id,
    title: item.title,
    status: item.status,
    ruleState: item.ruleState,
    finding: item.finding,
    evidence: item.evidence,
    missing: item.missing,
    sources: item.sourceIds,
    findingLanguage: "en",
  }));
}

async function resolveQuery(query: string, cache: Map<string, LookupResult>): Promise<LookupResult> {
  const key = query.trim();
  const cached = cache.get(key);
  if (cached) return cached;
  const digits = key.replace(/\D/g, "");
  const folioShaped = digits.length === 13 && digits === key.replace(/[\s-]/g, "");
  const result = folioShaped
    ? await lookupFolio(digits)
    : await lookupAddress({
        query: key,
        origin: "search",
        normalizedAddress: normalizeStreet(key),
      });
  cache.set(key, result);
  return result;
}

async function officialSources(topic: string) {
  const needle = topic.trim().toLowerCase();
  const rows = Object.values(sources).filter((source) => {
    if (!needle) return true;
    return `${source.title} ${source.note} ${source.id}`.toLowerCase().includes(needle);
  });
  const listed = rows.length ? rows : Object.values(sources);
  const checked = await Promise.all(
    listed.map(async (source) => {
      let liveStatus: number | null = null;
      let liveError: string | null = null;
      try {
        const response = await fetch(source.url, {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(8000),
          headers: { Accept: "text/html,application/pdf,*/*", "User-Agent": "RCSP-Preliminary-Screening/0.1" },
        });
        liveStatus = response.status;
      } catch {
        liveError = "The URL did not respond within 8 seconds.";
      }
      return {
        title: source.title,
        url: source.url,
        publisher: source.publisher,
        openedOn: source.retrieved,
        note: source.note,
        liveHttpStatus: liveStatus,
        liveError,
        topicMatched: rows.length > 0,
      };
    }),
  );
  return {
    note: "Notes are from pages opened on 2026-10-25. The HTTP status is a new request for that same URL. No other rule text was added.",
    sources: checked,
  };
}

async function runTool(name: string, rawArguments: string, cache: Map<string, LookupResult>): Promise<unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments) as unknown;
  } catch {
    return { error: "The tool arguments were not JSON." };
  }
  const args = asRecord(parsed);
  if (!args) return { error: "The tool arguments were not an object." };
  if (name === "search_official_adu_rules") {
    return officialSources(textArg(args, "topic"));
  }
  const query = textArg(args, "query");
  if (!query || query.length > 240) return { error: "A street address or folio is required." };
  if (name === "search_property_address" || name === "get_property_details") {
    const result = await resolveQuery(query, cache);
    return publicLookup(result);
  }
  if (name === "research_open_requirements") {
    const result = await resolveQuery(query, cache);
    const folio = folioDigits(result.kind === "ready" ? result.facts.parcel?.folio || result.facts.addressRecord?.folio || "" : "");
    if (result.kind !== "ready" || !folio) {
      return { lookup: publicLookup(result), checklist: [] };
    }
    const research: Record<string, unknown> = {};
    for (const step of researchSteps) {
      research[researchKey(step)] = await runResearchStep(step, folio);
    }
    const items = buildChecklist(result.facts, assess(result.facts), research, undefined, "en");
    return {
      lookup: publicLookup(result),
      counts: {
        checked: items.filter((entry) => entry.status !== "searching").length,
        passed: items.filter((entry) => entry.status === "pass").length,
        issues: items.filter((entry) => entry.status === "potential_issue").length,
        unresolved: items.filter((entry) => entry.status !== "pass" && entry.status !== "potential_issue" && entry.status !== "searching").length,
      },
      checklist: items.map((entry) => ({
        id: entry.id,
        status: entry.status,
        found: entry.found,
        whyOpen: entry.whyOpen,
        searched: entry.searched,
        nextAction: entry.nextAction,
        sourceUrl: entry.sourceUrl,
      })),
    };
  }
  if (name === "check_feasibility_requirements" || name === "generate_property_report") {
    const result = await resolveQuery(query, cache);
    if (result.kind !== "ready") {
      return { lookup: publicLookup(result), checks: [], report: null };
    }
    const checks = assess(result.facts);
    if (name === "check_feasibility_requirements") {
      return { lookup: publicLookup(result), checks: publicChecks(checks) };
    }
    const sourceIds = [...new Set(checks.flatMap((item) => item.sourceIds))];
    return {
      lookup: publicLookup(result),
      verifiedFacts: publicFacts(result.facts),
      preliminaryChecks: publicChecks(checks),
      uncertainties: unknowns(result.facts),
      nextSteps: nextSteps(result.facts),
      sourceLinks: sourceIds.map((id) => {
        const source = Object.values(sources).find((item) => item.id === id);
        return source ? { title: source.title, url: source.url, openedOn: source.retrieved } : { title: id, url: "", openedOn: "2026-10-25" };
      }),
      limits: [
        "Verified facts are the county fields in verifiedFacts. They are not a survey or an approval.",
        "preliminaryChecks are the screen's deterministic results. Missing data is NEEDS VERIFICATION.",
        "Finding sentences are English.",
        "A residential, single-family, or condo-flag value is not accessory-unit eligibility.",
      ],
    };
  }
  return { error: `Unknown tool ${name}.` };
}

function historyItems(history: unknown): OpenAI.Responses.ResponseInputItem[] {
  if (!Array.isArray(history)) return [];
  const items: OpenAI.Responses.ResponseInputItem[] = [];
  for (const entry of history.slice(-8)) {
    const record = asRecord(entry);
    if (!record) continue;
    const role = record.role === "assistant" ? "assistant" : record.role === "user" ? "user" : null;
    const content = typeof record.content === "string" ? record.content.slice(0, 6000) : "";
    if (!role || !content) continue;
    items.push({ role, content });
  }
  return items;
}

export async function handleAgentRequest(
  body: unknown,
  options: AgentRequestOptions,
): Promise<{ status: number; body: { answer?: string; tools?: string[]; error?: string; status?: number | null } }> {
  if (!options.apiKey.trim()) {
    console.info("rcsp-agent model_status=missing_key");
    return { status: 503, body: { error: "missing_key" } };
  }
  const record = asRecord(body);
  const message = typeof record?.message === "string" ? record.message.trim() : "";
  const language = record?.language === "es" || record?.language === "ht" ? record.language : "en";
  if (!message || message.length > 2000) {
    return { status: 400, body: { error: "bad_response" } };
  }
  const screened = typeof record?.screenedQuery === "string" ? record.screenedQuery.trim().slice(0, 240) : "";
  setServiceOrigin(options.origin);
  const cache = new Map<string, LookupResult>();
  const client = new OpenAI({ apiKey: options.apiKey });
  const model = options.model.trim() || MODEL_DEFAULT;
  let input: OpenAI.Responses.ResponseInput = [
    ...historyItems(record?.history),
    {
      role: "user",
      content: screened
        ? `${message}\n\nThe resident already opened this text in the screen: ${screened}. Call the tools before treating it as a property record.`
        : message,
    },
  ];
  const called: string[] = [];
  try {
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const response = await client.responses.create({
        model,
        instructions: instructions(language),
        input,
        tools,
        tool_choice: called.length >= MAX_TOOL_CALLS ? "none" : "auto",
        reasoning: { effort: "low" },
      });
      const calls = response.output.filter((item) => item.type === "function_call");
      if (calls.length === 0 || called.length >= MAX_TOOL_CALLS) {
        const answer = response.output_text?.trim() ?? "";
        if (!answer) {
          console.info(`rcsp-agent model_status=empty tools=${called.join(",") || "none"}`);
          return { status: 502, body: { error: "bad_response", tools: called } };
        }
        console.info(`rcsp-agent model_status=ok model=${model} tools=${called.join(",") || "none"}`);
        return { status: 200, body: { answer, tools: called } };
      }
      const outputs: OpenAI.Responses.ResponseInputItem[] = [];
      for (const call of calls) {
        if (call.type !== "function_call") continue;
        if (called.length >= MAX_TOOL_CALLS) break;
        called.push(call.name);
        let payload: unknown;
        try {
          payload = await runTool(call.name, call.arguments, cache);
          logTool(call.name, true);
        } catch (error) {
          logTool(call.name, false);
          payload = { error: error instanceof Error ? error.name : "tool_failed" };
        }
        const text = JSON.stringify(payload).slice(0, 24000);
        outputs.push({ type: "function_call_output", call_id: call.call_id, output: text });
      }
      input = [...input, ...(response.output as OpenAI.Responses.ResponseInputItem[]), ...outputs];
    }
    console.info(`rcsp-agent model_status=empty tools=${called.join(",") || "none"}`);
    return { status: 502, body: { error: "bad_response", tools: called } };
  } catch (error) {
    const status = error instanceof OpenAI.APIError ? error.status ?? null : null;
    console.info(`rcsp-agent model_status=error http=${status ?? "none"} model=${model}`);
    return { status: 502, body: { error: "model_failed", status, tools: called } };
  }
}
