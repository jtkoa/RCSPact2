import { LOT_MIN_SQFT, sources, type SourceId } from "../data/sources";
import type { CheckResult, RuleState, SiteFacts } from "./types";
import { formatSqFt, zoneFamily } from "./text";

function check(partial: CheckResult): CheckResult {
  return partial;
}

function countyScope(facts: SiteFacts): "in" | "out" | "unknown" {
  if (facts.unincorporated === true) return "in";
  if (facts.unincorporated === false) return "out";
  return "unknown";
}

function scopeFinding(facts: SiteFacts, countyRule: string): { ruleState: RuleState; lead: string } {
  const scope = countyScope(facts);
  if (scope === "out") {
    const place = facts.municipality ?? "a municipality";
    return {
      ruleState: "not-applied",
      lead: `County GIS classifies this point as ${place}, not unincorporated Miami-Dade. The retrieved county rule is not applied. For reference only: ${countyRule}`,
    };
  }
  if (scope === "unknown") {
    return {
      ruleState: "retrieved",
      lead: `A county rule was retrieved, but the municipality layer did not classify this point, so the rule is not used to pass or flag. ${countyRule}`,
    };
  }
  return { ruleState: "retrieved", lead: countyRule };
}

export function jurisdictionCheck(facts: SiteFacts): CheckResult {
  const sourceIds: SourceId[] = [sources.memo.id, sources.code.id, sources.muniLayer.id];
  if (!facts.municipality || facts.unincorporated == null) {
    return check({
      id: "jurisdiction",
      title: "Jurisdiction",
      status: "NEEDS_VERIFICATION",
      ruleState: "unverified",
      finding:
        "The county municipalities layer did not classify this point. The 2022 ordinance memorandum describes the accessory-unit ordinance as zoning for the unincorporated area. Without a map class, this screen cannot say whether that ordinance is the one to read.",
      evidence: facts.geocode?.county ? [`Street geocoder county: ${facts.geocode.county}. That is not a boundary determination.`] : [],
      missing: ["County GIS municipality classification for this point."],
      sourceIds,
    });
  }
  if (facts.unincorporated) {
    return check({
      id: "jurisdiction",
      title: "Jurisdiction",
      status: "PASS",
      ruleState: "retrieved",
      finding: `County GIS classifies this point as ${facts.municipality}. The 2022 county memorandum describes the accessory-unit ordinance as pertaining to zoning in the unincorporated area, and § 33-22 was read from the county code. A layer hit is not a survey of the legal boundary.`,
      evidence: [`Municipality layer NAME: ${facts.municipality}.`],
      missing: ["A boundary survey, if the point sits near a city limit."],
      sourceIds,
    });
  }
  return check({
    id: "jurisdiction",
    title: "Jurisdiction",
    status: "FLAG",
    ruleState: "retrieved",
    finding: `County GIS classifies this point as ${facts.municipality}, not unincorporated Miami-Dade. The retrieved ordinance is described as zoning for the unincorporated area. This screen did not retrieve ${facts.municipality}'s zoning code and does not apply the county accessory-unit standards as the rules for this site.`,
    evidence: [`Municipality layer NAME: ${facts.municipality}.`],
    missing: [`The zoning code of ${facts.municipality}.`],
    sourceIds,
  });
}

export function udbCheck(facts: SiteFacts): CheckResult {
  const sourceIds: SourceId[] = [sources.code.id, sources.udbLayer.id];
  const rule =
    "Section 33-22(1) limits the county permission it states to listed zoning districts located inside the Urban Development Boundary.";
  const scoped = scopeFinding(facts, rule);
  if (scoped.ruleState !== "retrieved") {
    return check({
      id: "urban-development-boundary",
      title: "Urban Development Boundary",
      status: "NEEDS_VERIFICATION",
      ruleState: scoped.ruleState,
      finding: scoped.lead,
      evidence: facts.insideUdb == null ? [] : [`The county UDB polygon ${facts.insideUdb ? "contains" : "does not contain"} this point. That fact is not used to apply § 33-22.`],
      missing: ["The governing municipality's map of any equivalent boundary."],
      sourceIds,
    });
  }
  if (facts.insideUdb == null) {
    return check({
      id: "urban-development-boundary",
      title: "Urban Development Boundary",
      status: "NEEDS_VERIFICATION",
      ruleState: "retrieved",
      finding: `${rule} The county urban-development layer did not answer, so inside-or-outside was not decided.`,
      evidence: [],
      missing: ["A successful query of the county Urban Development polygon."],
      sourceIds,
    });
  }
  if (facts.insideUdb) {
    return check({
      id: "urban-development-boundary",
      title: "Urban Development Boundary",
      status: "PASS",
      ruleState: "retrieved",
      finding: `${rule} The county layer describes its polygon as the area included in the Urban Development Boundary. This point intersects that polygon. The hit is a map test, not a surveyed determination.`,
      evidence: ["Urban Development layer: point intersects the UDB polygon."],
      missing: [],
      sourceIds,
    });
  }
  return check({
    id: "urban-development-boundary",
    title: "Urban Development Boundary",
    status: "FLAG",
    ruleState: "retrieved",
    finding: `${rule} This point does not intersect the county polygon that the layer describes as the area inside the Urban Development Boundary. The permission stated in § 33-22(1) is limited to the inside of that boundary.`,
    evidence: ["Urban Development layer: no intersection."],
    missing: ["Confirmation from Planning if the boundary has moved since the layer was drawn."],
    sourceIds,
  });
}

export function zoningCheck(facts: SiteFacts): CheckResult {
  const sourceIds: SourceId[] = [sources.code.id, sources.zoneLayer.id];
  const rule =
    "Section 33-22(1) says one accessory unit per lot shall be permitted in the AU, EU, and RU zoning districts inside the Urban Development Boundary, and in GU when the property is trended to AU, EU, or RU.";
  const scoped = scopeFinding(facts, rule);
  if (scoped.ruleState !== "retrieved") {
    const city = facts.municipalZoning
      ? `County GIS municipal zoning returned ${facts.municipalZoning.code}. That code is a label only. The city ordinance was not retrieved, so the code is not compared with a rule.`
      : "No municipal zone code was returned.";
    return check({
      id: "zoning-district",
      title: "Zoning district",
      status: "NEEDS_VERIFICATION",
      ruleState: scoped.ruleState,
      finding: `${scoped.lead} ${city}`,
      evidence: facts.municipalZoning ? [`Municipal zoning layer: ${facts.municipalZoning.code}.`] : [],
      missing: ["The municipal zoning ordinance and the official district for the parcel."],
      sourceIds: [...sourceIds, sources.cityZoneLayer.id],
    });
  }
  if ((facts.zoningAreas?.length ?? 0) > 1) {
    return check({
      id: "zoning-district",
      title: "Zoning district",
      status: "NEEDS_VERIFICATION",
      ruleState: "retrieved",
      finding: `The mapped parcel crosses more than one zoning area (${facts.zoningAreas.join(", ")}). The County should confirm which rules apply before a reliable answer. This does not by itself mean an accessory unit is prohibited.`,
      evidence: facts.zoningAreas.map((code) => `Zone polygon: ${code}.`),
      missing: ["The County's confirmation of which zoning area governs this parcel."],
      sourceIds,
    });
  }
  if (facts.zoneDisagreement) {
    return check({
      id: "zoning-district",
      title: "Zoning district",
      status: "NEEDS_VERIFICATION",
      ruleState: "retrieved",
      finding: `${rule} ${facts.zoneDisagreement} A zone code is not an accessory-unit approval.`,
      evidence: [
        facts.addressRecord?.zone ? `GeoProperty Zone: ${facts.addressRecord.zone}.` : "",
        facts.zoning ? `Zone layer: ${facts.zoning.code}. ${facts.zoning.description}`.trim() : "",
      ].filter(Boolean),
      missing: ["One zoning district confirmed for this folio, because the retrieved codes differ."],
      sourceIds,
    });
  }
  if (!facts.zoning) {
    return check({
      id: "zoning-district",
      title: "Zoning district",
      status: "NEEDS_VERIFICATION",
      ruleState: "retrieved",
      finding: `${rule} The unincorporated zone layer did not return a district, so the district test was not made.`,
      evidence: [],
      missing: ["ZONE value from the county zone layer or from Land Management."],
      sourceIds,
    });
  }
  const family = zoneFamily(facts.zoning.code);
  const evidence = [`Zone layer: ${facts.zoning.code}. ${facts.zoning.description}`.trim()];
  if (facts.cdmpDescriptions.length) {
    evidence.push(`CDMP layer description (context only, not a zoning district): ${facts.cdmpDescriptions.join("; ")}.`);
  }
  if (family === "GU") {
    return check({
      id: "zoning-district",
      title: "Zoning district",
      status: "NEEDS_VERIFICATION",
      ruleState: "retrieved",
      finding: `${rule} The zone layer returned ${facts.zoning.code}. GU is listed only when the property is trended to AU, EU, or RU. Trending was not in the attributes retrieved here.`,
      evidence,
      missing: ["The county's trend determination for this GU property."],
      sourceIds,
    });
  }
  if (family === "OTHER") {
    return check({
      id: "zoning-district",
      title: "Zoning district",
      status: "FLAG",
      ruleState: "retrieved",
      finding: `${rule} The zone layer returned ${facts.zoning.code}, which is not AU, EU, RU, or GU. The permission stated in § 33-22(1) does not name this district. A layer label is not itself a zoning determination.`,
      evidence,
      missing: ["A zoning verification letter if the layer and the property's adopted district might differ."],
      sourceIds,
    });
  }
  return check({
    id: "zoning-district",
    title: "Zoning district",
    status: "PASS",
    ruleState: "retrieved",
    finding: `${rule} The zone layer returned ${facts.zoning.code}, which is in the ${family} family named in that subsection. This does not establish that a principal single-family dwelling exists, that the lot is inside the Urban Development Boundary, or that overlays are clear. The GIS description is the layer's text, not a quotation of the zoning table.`,
    evidence,
    missing: ["Overlay districts, if any. They were not reviewed."],
    sourceIds: facts.cdmpDescriptions.length ? [...sourceIds, sources.cdmpLayer.id] : sourceIds,
  });
}

export function lotAreaCheck(facts: SiteFacts): CheckResult {
  const sourceIds: SourceId[] = [sources.aduPage.id, sources.memo.id, sources.code.id, sources.parcelLayer.id];
  const rule = `The county accessory-unit page states a minimum lot size of ${LOT_MIN_SQFT.toLocaleString("en-US")} square feet. The 2022 memorandum quotes the CDMP for single-family lots of at least that area. Section 33-22(4)(a) says the minimum follows the CDMP, with an exception for guesthouses in EU districts, and § 33-22(4)(e) allows an administrative lot-size adjustment only to the extent the CDMP authorizes. The CDMP volume and § 33-36.1 were not opened.`;
  const scoped = scopeFinding(facts, rule);
  if (scoped.ruleState !== "retrieved") {
    const area = facts.parcel?.areaSqFt;
    return check({
      id: "lot-area",
      title: "Lot area",
      status: "NEEDS_VERIFICATION",
      ruleState: scoped.ruleState,
      finding: scoped.lead,
      evidence: area == null ? [] : [`GIS polygon area on file: ${formatSqFt(area)}. Not compared with the county minimum because the county rule is not applied.`],
      missing: ["The lot-area rule of the municipality that governs the parcel, and a survey."],
      sourceIds,
    });
  }
  const area = facts.parcel?.areaSqFt;
  if (area == null) {
    return check({
      id: "lot-area",
      title: "Lot area",
      status: "NEEDS_VERIFICATION",
      ruleState: "retrieved",
      finding: `${rule} No polygon area was returned, so the 7,500 square foot figure was not tested.`,
      evidence: [],
      missing: ["Shape.STArea() for the parcel, or a survey."],
      sourceIds,
    });
  }
  const shown = formatSqFt(area);
  if (area >= LOT_MIN_SQFT) {
    return check({
      id: "lot-area",
      title: "Lot area",
      status: "PASS",
      ruleState: "retrieved",
      finding: `${rule} County GIS returned a polygon area of ${shown}, which is at or above the published 7,500 square foot figure. That passes only this published minimum. It is not a survey, it does not cure a zoning flag, and it is not an approval.`,
      evidence: [`Shape.STArea(): ${area} (layer units: feet, so the value is square feet).`],
      missing: ["A signed survey if a lender, designer, or reviewer will rely on the area."],
      sourceIds,
    });
  }
  return check({
    id: "lot-area",
    title: "Lot area",
    status: "FLAG",
    ruleState: "retrieved",
    finding: `${rule} County GIS returned a polygon area of ${shown}, below the 7,500 square foot figure on the county page. EU guesthouses are excepted from the CDMP size standard by § 33-22(4)(a), and an administrative adjustment may exist under § 33-22(4)(e). Neither exception was decided here. This flag is not a denial.`,
    evidence: [`Shape.STArea(): ${area}.`],
    missing: ["Surveyed lot area, the EU-guesthouse exception if relevant, and any administrative adjustment record."],
    sourceIds,
  });
}

export function floorAreaCheck(facts: SiteFacts): CheckResult {
  const sourceIds: SourceId[] = [sources.aduPage.id, sources.memo.id, sources.code.id];
  const rule =
    "The county accessory-unit page says dwelling size must be between 400 and 800 square feet in RU-1 districts. The 2022 memorandum quotes the CDMP for accessory units ranging from 400 to 800 square feet of habitable area. Section 33-22(4)(a) points the floor-area numbers to the CDMP and excepts EU guesthouses. No floor plan was submitted.";
  const scoped = scopeFinding(facts, rule);
  return check({
    id: "floor-area",
    title: "Accessory unit floor area",
    status: "NEEDS_VERIFICATION",
    ruleState: scoped.ruleState === "retrieved" ? "retrieved" : scoped.ruleState,
    finding:
      scoped.ruleState === "retrieved"
        ? `${rule} Size cannot pass or fail without a proposed habitable area.`
        : scoped.lead,
    evidence: facts.zoning ? [`Zone label on this screen: ${facts.zoning.code}.`] : [],
    missing: ["The proposed habitable floor area, and the CDMP text itself."],
    sourceIds,
  });
}

export function lotDimensionCheck(facts: SiteFacts): CheckResult {
  return check({
    id: "lot-dimensions",
    title: "Lot width and depth",
    status: "NEEDS_VERIFICATION",
    ruleState: "unverified",
    finding:
      "No official lot width or depth was retrieved. Section 33-22 does not state a single countywide width. The district width table was not opened, and this screen does not measure the parcel polygon and call that measurement a lot width.",
    evidence: facts.parcel ? ["A parcel polygon was available and was not used to invent width or depth."] : [],
    missing: ["Lot width and depth from a survey or from the district table in the county code."],
    sourceIds: [sources.code.id],
  });
}

export function setbackCheck(facts: SiteFacts): CheckResult {
  const rule =
    "Section 33-22(4)(b) subjects detached accessory units over one story, and attached accessory units, to the setbacks and lot coverage of the principal dwelling. Subsection (4)(c) subjects one-story detached units to the accessory-structure setbacks of the zoning district. The district numbers were not retrieved, and there is no site plan.";
  const scoped = scopeFinding(facts, rule);
  return check({
    id: "setbacks",
    title: "Setbacks and lot coverage",
    status: "NEEDS_VERIFICATION",
    ruleState: scoped.ruleState,
    finding: scoped.ruleState === "retrieved" ? `${rule} Setbacks cannot pass or fail.` : scoped.lead,
    evidence: [],
    missing: ["District setback and lot-coverage numbers, building height in stories, and a site plan."],
    sourceIds: [sources.code.id],
  });
}

export function parkingCheck(facts: SiteFacts): CheckResult {
  const rule =
    "Section 33-22(2)(e) requires one parking space for the accessory unit in addition to the principal dwelling's spaces, on a driveway or designated area on the property, or on the street or swale directly in front if there is no driveway and on-street parking is permitted. Properties within 660 feet of specified CDMP transit or mixed-use corridors are exempt from that off-street space. No more than two vehicles may be parked at one time during the occupancy period on the property or, where allowed, on the street or swale in front.";
  const scoped = scopeFinding(facts, rule);
  return check({
    id: "parking",
    title: "Parking",
    status: "NEEDS_VERIFICATION",
    ruleState: scoped.ruleState,
    finding:
      scoped.ruleState === "retrieved"
        ? `${rule} There is no site plan and no measurement to a transit corridor, so parking cannot pass or fail. The county webpage's shorter parking sentence was not used in place of this section.`
        : scoped.lead,
    evidence: [],
    missing: ["A site plan showing the space, and the distance to a CDMP corridor if an exemption will be claimed."],
    sourceIds: [sources.code.id],
  });
}

export function occupancyCheck(facts: SiteFacts): CheckResult {
  const rule =
    "Section 33-22(2)(c) caps overnight occupancy at two persons per bedroom, excluding children under three, and at two persons for a single room without a separate bedroom. Overnight is 10:00 p.m. to 7:00 a.m. Occupancy also cannot exceed the Florida Building Code occupant load. A guesthouse is limited to the family that occupies the principal dwelling. The county accessory-unit page says the owner need not live on site, but if the owner lives on site they must live in the principal dwelling rather than the accessory unit. Section 33-22(2)(f)(ii) says an owner shall not live in the guesthouse and rent the principal dwelling.";
  const scoped = scopeFinding(facts, rule);
  return check({
    id: "occupancy",
    title: "Occupancy",
    status: "NEEDS_VERIFICATION",
    ruleState: scoped.ruleState,
    finding:
      scoped.ruleState === "retrieved"
        ? `${rule} No household, bedroom count, or owner-occupancy fact was provided, so occupancy cannot pass or fail.`
        : scoped.lead,
    evidence: [],
    missing: ["Who will live in each unit, the bedroom count, and whether the proposal is a guesthouse or an accessory dwelling unit."],
    sourceIds: [sources.code.id, sources.aduPage.id],
  });
}

export function permitCheck(facts: SiteFacts): CheckResult {
  const rule =
    "Section 33-22(6) requires a certificate of use for each accessory unit, obtainable by the property owner. An accessory dwelling unit certificate is renewed annually; a guesthouse certificate is one-time unless it is converted. The county accessory-unit page says a building permit is required to construct or legalize an accessory unit. No permit record was queried.";
  const scoped = scopeFinding(facts, rule);
  return check({
    id: "permits",
    title: "Permits and certificate of use",
    status: "NEEDS_VERIFICATION",
    ruleState: scoped.ruleState,
    finding:
      scoped.ruleState === "retrieved"
        ? `${rule} Silence in this screen is not evidence that a permit is missing or that one exists.`
        : scoped.lead,
    evidence: [],
    missing: ["Permit and certificate-of-use history for the folio."],
    sourceIds: [sources.code.id, sources.aduPage.id],
  });
}

export function saleRentalCheck(facts: SiteFacts): CheckResult {
  const rule =
    "Section 33-22(2)(f) says the accessory unit shall not be sold separately from the principal dwelling. An accessory dwelling unit may be rented for a fee only for a period of at least one month. A guesthouse shall not be rented for a fee separately from the principal dwelling. Except as provided in § 33-28, the accessory unit shall not be used as a vacation rental. Section 33-28 was not opened.";
  const scoped = scopeFinding(facts, rule);
  return check({
    id: "sale-and-rental",
    title: "Separate sale and rental term",
    status: "NEEDS_VERIFICATION",
    ruleState: scoped.ruleState,
    finding:
      scoped.ruleState === "retrieved"
        ? `${rule} There is no deed, condominium document, or rental term to review, so this cannot pass or fail.`
        : scoped.lead,
    evidence: [],
    missing: ["The intended conveyance and rental term, and the text of § 33-28."],
    sourceIds: [sources.code.id],
  });
}

export function principalDwellingCheck(facts: SiteFacts): CheckResult {
  const rule =
    "Section 33-22(2)(a) allows one accessory unit on a lot developed with a principal single-family dwelling. The county code definition retrieved with § 33-22 describes an accessory dwelling unit as a separate housekeeping unit on that lot, and says a fee for separate use is not by itself an unlawful duplex.";
  const scoped = scopeFinding(facts, rule);
  return check({
    id: "principal-dwelling",
    title: "Principal single-family dwelling",
    status: "NEEDS_VERIFICATION",
    ruleState: scoped.ruleState,
    finding:
      scoped.ruleState === "retrieved"
        ? `${rule} This screen did not retrieve a building card or a photograph, so it does not find that a principal single-family house is there, or that no accessory unit already exists.`
        : scoped.lead,
    evidence: [
      ...(facts.primaryZoneDescription
        ? [
            `Property Search primary-zone description: ${facts.primaryZoneDescription}. A single-family or residential description is not proof of a principal dwelling and is not accessory-unit eligibility.`,
          ]
        : []),
      ...(facts.addressRecord?.condoFlg
        ? [`GeoProperty CondoFlg: ${facts.addressRecord.condoFlg}. A condo flag is not a finding that a detached house exists.`]
        : []),
      ...(facts.addressRecord?.cluc
        ? [`GeoProperty CLUC: ${facts.addressRecord.cluc}. No official CLUC table was retrieved, so this code is not read as a land use.`]
        : []),
      ...(facts.cdmpDescriptions.length
        ? [`CDMP map description, which is not proof of a house and is not accessory-unit eligibility: ${facts.cdmpDescriptions.join("; ")}.`]
        : []),
    ],
    missing: ["Evidence of one existing principal single-family dwelling and of no existing accessory unit."],
    sourceIds: [
      sources.code.id,
      ...(facts.primaryZoneDescription ? [sources.primaryZone.id] : []),
      ...(facts.addressRecord ? [sources.geoProperty.id] : []),
    ],
  });
}

export function hoaCheck(facts: SiteFacts): CheckResult {
  const rule =
    "Section 33-22(2)(i) requires an applicant to give advance notice to a homeowners or condominium association when the principal dwelling is part of one, and to follow that association's rules for accessory structures. Deed restrictions were not retrieved.";
  const scoped = scopeFinding(facts, rule);
  return check({
    id: "private-restrictions",
    title: "Association and deed restrictions",
    status: "NEEDS_VERIFICATION",
    ruleState: scoped.ruleState,
    finding:
      scoped.ruleState === "retrieved"
        ? `${rule} It is unknown whether an association or a deed restriction applies, so this cannot pass or fail.`
        : scoped.lead,
    evidence: [],
    missing: ["Association documents and deed restrictions."],
    sourceIds: [sources.code.id],
  });
}

export function designCheck(facts: SiteFacts): CheckResult {
  const rule =
    "Section 33-22(3) and (4)(d) say a detached accessory unit may not sit in front of the principal dwelling or closer to the front lot line, and that a detached unit's height may not exceed the principal dwelling. The unit must be architecturally compatible and of similar scale. An attached unit may have a separate entrance that is not visible from a roadway. No plans were submitted.";
  const scoped = scopeFinding(facts, rule);
  return check({
    id: "design-placement",
    title: "Design and placement",
    status: "NEEDS_VERIFICATION",
    ruleState: scoped.ruleState,
    finding: scoped.ruleState === "retrieved" ? `${rule} Placement and design cannot pass or fail.` : scoped.lead,
    evidence: [],
    missing: ["Elevations and a site plan showing the unit relative to the house and the front lot line."],
    sourceIds: [sources.code.id],
  });
}

export function statuteCheck(): CheckResult {
  return check({
    id: "state-statute",
    title: "State accessory dwelling unit statute",
    status: "NEEDS_VERIFICATION",
    ruleState: "retrieved",
    finding:
      "Florida Statutes § 163.31771 was retrieved. It finds a public purpose in permitting accessory units, defines one as an ancillary living unit with its own kitchen, bathroom, and sleeping area, and says a local government may adopt an ordinance allowing them in single-family areas. Subsection (4) says a building-permit application to construct an accessory dwelling unit must include an affidavit that the unit will be rented at an affordable rate to an extremely-low-income, very-low-income, low-income, or moderate-income person. The statute does not approve this parcel. Whether the county requires that affidavit on a particular application was not confirmed beyond the statute's text.",
    evidence: [],
    missing: ["A permit application, if the affidavit will be needed, and local practice on that affidavit."],
    sourceIds: [sources.statute.id],
  });
}

export const checkRunners = [
  jurisdictionCheck,
  udbCheck,
  zoningCheck,
  lotAreaCheck,
  floorAreaCheck,
  lotDimensionCheck,
  setbackCheck,
  parkingCheck,
  occupancyCheck,
  permitCheck,
  saleRentalCheck,
  principalDwellingCheck,
  hoaCheck,
  designCheck,
];
