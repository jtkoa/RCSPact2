import { checkRunners, statuteCheck } from "./checks";
import type { CheckResult, SiteFacts } from "./types";

function holdSnapshot(facts: SiteFacts, result: CheckResult): CheckResult {
  if (facts.dataOrigin !== "snapshot") return result;
  if (result.status === "NEEDS_VERIFICATION") {
    return {
      ...result,
      finding: `${result.finding} Site facts, if any, are an October 25, 2026 GIS snapshot because the live service did not respond. They are not a live county record and are not used to pass or flag.`,
    };
  }
  return {
    ...result,
    status: "NEEDS_VERIFICATION",
    finding: `Not scored from live records. ${result.finding} These site facts are a GIS snapshot captured on October 25, 2026 because the live county service did not respond. The snapshot is not used to pass or flag.`,
  };
}

function holdAddressConflict(facts: SiteFacts, result: CheckResult): CheckResult {
  if (!facts.addressDisagreement) return result;
  if (result.status === "NEEDS_VERIFICATION") {
    return { ...result, finding: `${result.finding} ${facts.addressDisagreement}` };
  }
  return {
    ...result,
    status: "NEEDS_VERIFICATION",
    finding: `Not scored because county address fields disagree. ${facts.addressDisagreement} ${result.finding}`,
  };
}

export function assess(facts: SiteFacts): CheckResult[] {
  const results = checkRunners.map((run) => holdSnapshot(facts, holdAddressConflict(facts, run(facts))));
  results.push(statuteCheck());
  return results;
}

export function countStatuses(checks: CheckResult[]) {
  return {
    pass: checks.filter((item) => item.status === "PASS").length,
    flag: checks.filter((item) => item.status === "FLAG").length,
    verify: checks.filter((item) => item.status === "NEEDS_VERIFICATION").length,
  };
}

export function nextSteps(facts: SiteFacts): string[] {
  const steps = [
    "Look up the folio on the Miami-Dade Property Appraiser property search and do not treat the GIS polygon area as a survey.",
    "Confirm the zoning district in the county Land Management application before talking with a designer.",
  ];
  if (facts.unincorporated === false) {
    steps.push(
      `County GIS names ${facts.municipality ?? "a municipality"}. Ask that city which rules apply. County § 33-22 was not used as the governing ordinance.`,
    );
  } else {
    steps.push("Read County Code § 33-22 and the county accessory dwelling unit page. This screen is not a filing.");
    steps.push(
      "A certificate of use and a building permit are separate steps. The county Certificate of Use menu includes an accessory dwelling unit application and requires an account.",
    );
  }
  steps.push(
    "Before plans are drawn, look up a Florida-licensed architect in the DBPR license search and, if engineering is needed, a professional engineer through the Florida Board of Professional Engineers. This screen names no firms.",
  );
  steps.push(
    "Ask the Property Appraiser about homestead and assessed value before renting. The county accessory-unit page says an accessory unit may change taxes and exemptions.",
  );
  steps.push("Read any homeowners association rules and deed restrictions. They can be stricter than the zoning code.");
  return steps;
}

export function unknowns(facts: SiteFacts): string[] {
  const items = [
    "Surveyed lot width, depth, and area.",
    "Whether a principal single-family dwelling already exists, and whether an accessory unit already exists.",
    "Proposed habitable floor area, height, and location on the lot.",
    "Parking layout and any distance to a transit corridor.",
    "Who would live in each unit, and whether the proposal is a guesthouse or a rented accessory unit.",
    "Permit and certificate-of-use history.",
    "Homeowners association rules and deed restrictions.",
    "The adopted CDMP text. A 2022 memorandum quotes it; the plan document was not opened.",
    "District setback and lot-coverage tables.",
    "The text of § 33-28 (vacation-rental cross-reference) and § 33-36.1 (administrative adjustment).",
    "Zoning overlays.",
  ];
  if (facts.unincorporated === false) {
    items.unshift(`The zoning ordinance of ${facts.municipality ?? "the municipality"}.`);
  }
  if (facts.dataOrigin === "snapshot") {
    items.unshift("A live response from county GIS. The figures on this screen are a saved snapshot.");
  }
  if (!facts.parcel) {
    items.unshift("A county parcel match for this address.");
  }
  if (!facts.addressRecord) {
    items.unshift("A Miami-Dade GeoProperty record. An address is validated only when that service returns a folio.");
  }
  if (facts.addressDisagreement) {
    items.unshift(facts.addressDisagreement);
  }
  items.push("A residential, single-family, or condo-flag value is not accessory-unit eligibility.");
  return items;
}
