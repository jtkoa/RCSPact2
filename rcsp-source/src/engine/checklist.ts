import type { Lang } from "../i18n/messages";
import { LOT_MIN_SQFT, sources } from "../data/sources";
import { extentEstimate, formatSqFt } from "./text";
import type { CheckResult, SiteFacts } from "./types";
import type { HomeownerAnswers, ResearchState } from "./researchTypes";

export type ChecklistStatus =
  | "searching"
  | "pass"
  | "potential_issue"
  | "missing_information"
  | "rule_not_confirmed"
  | "outside_review"
  | "not_applicable";

export type ResearchStatus = "not_started" | "searching" | "completed" | "blocked";

export type Actor = "app" | "homeowner" | "professional" | "county";

export interface ChecklistItem {
  id: string;
  requirement: string;
  checking: string;
  status: ChecklistStatus;
  found: string;
  whyOpen: string;
  searched: string;
  nextAction: string;
  who: Actor | "";
  evidence: string[];
  englishNote: string;
  sourceTitle: string;
  sourceUrl: string;
  retrievedAt: string;
  sourceKind: "record" | "map" | "calculated" | "";
  researchStatus: ResearchStatus;
}

type Phrase = Record<Lang, string>;

function say(lang: Lang, phrase: Phrase): string {
  return phrase[lang];
}

function item(partial: Omit<ChecklistItem, "researchStatus"> & { researchStatus?: ResearchStatus }): ChecklistItem {
  const researchStatus = partial.researchStatus ?? (partial.status === "searching" ? "searching" : "completed");
  return { ...partial, researchStatus };
}

function byId(checks: CheckResult[], id: string): CheckResult | undefined {
  return checks.find((check) => check.id === id);
}

function countyBlocked(check: CheckResult | undefined): boolean {
  return check?.ruleState === "not-applied";
}

export function checklistCounts(items: ChecklistItem[]) {
  const finished = items.filter((entry) => entry.status !== "searching");
  const passed = finished.filter((entry) => entry.status === "pass").length;
  const issues = finished.filter((entry) => entry.status === "potential_issue").length;
  const unresolved = finished.filter((entry) => entry.status !== "pass" && entry.status !== "potential_issue" && entry.status !== "not_applicable").length;
  return { checked: finished.length, passed, issues, unresolved, searching: items.length - finished.length };
}

export function buildChecklist(
  facts: SiteFacts,
  checks: CheckResult[],
  research: ResearchState | undefined,
  answers: HomeownerAnswers | undefined,
  lang: Lang,
): ChecklistItem[] {
  const area = facts.parcel?.areaSqFt;
  const zone = facts.zoning?.code ?? "";
  const ru = zone.toUpperCase().startsWith("RU");
  const proposed = answers?.proposedSqFt ?? null;
  const sketch = research?.sketch;
  const permits = research?.permits;
  const overlays = research?.overlays;
  const cases = research?.cases;
  const code = research?.code;
  const lots = research?.lotFields;

  const jurisdiction = byId(checks, "jurisdiction");
  const place = facts.municipality ?? say(lang, { en: "the mapped place", es: "el lugar del mapa", ht: "kote kat la montre" });

  const rows: ChecklistItem[] = [
    fromPassOrFlag(jurisdiction, lang, {
      id: "jurisdiction",
      requirement: say(lang, {
        en: "Which government sets the rules for this lot",
        es: "Qué gobierno pone las reglas de este lote",
        ht: "Ki gouvènman ki mete règ pou teren sa a",
      }),
      checking: say(lang, {
        en: "The county municipality map, before any county accessory-unit rule is used.",
        es: "El mapa de municipios del condado, antes de usar una regla del condado.",
        ht: "Kat minisipalite konte a, anvan nou sèvi ak yon règ konte a.",
      }),
      passFound: say(lang, {
        en: `The county map calls this point ${place}. This screen reads the unincorporated county rules for that reason. A map class is not a surveyed boundary, and it is not an approval.`,
        es: `El mapa del condado llama este punto ${place}. Por eso esta pantalla lee las reglas del área no incorporada. La clase del mapa no es un límite medido ni una aprobación.`,
        ht: `Kat konte a rele pwen sa a ${place}. Se poutèt sa ekran sa a li règ zòn ki pa enkòpore a. Klas kat la pa yon limit ki mezire epi li pa yon apwobasyon.`,
      }),
      sourceTitle: sources.muniLayer.title,
      sourceUrl: sources.muniLayer.url,
      retrievedAt: facts.retrievedAt,
      sourceKind: "map",
    }),
    fromPassOrFlag(byId(checks, "urban-development-boundary"), lang, {
      id: "urban-development-boundary",
      requirement: say(lang, {
        en: "Whether the lot is inside the Urban Development Boundary",
        es: "Si el lote está dentro del límite de desarrollo urbano",
        ht: "Si teren an andedan limit devlopman iben an",
      }),
      checking: say(lang, {
        en: "The county map of the area inside that boundary.",
        es: "El mapa del condado del área dentro de ese límite.",
        ht: "Kat konte a pou zòn ki andedan limit sa a.",
      }),
      passFound: say(lang, {
        en: "The county map includes this point in the Urban Development Boundary. The county accessory-unit section we opened applies inside that boundary. This is a map test, not a survey or an approval.",
        es: "El mapa del condado incluye este punto en el límite de desarrollo urbano. La sección del condado que abrimos aplica dentro de ese límite. Es una prueba de mapa, no un levantamiento ni una aprobación.",
        ht: "Kat konte a mete pwen sa a andedan limit devlopman iben an. Seksyon konte a nou te ouvri a aplike andedan limit sa a. Sa se yon tès kat, pa yon sondaj ni yon apwobasyon.",
      }),
      sourceTitle: sources.udbLayer.title,
      sourceUrl: sources.udbLayer.url,
      retrievedAt: facts.retrievedAt,
      sourceKind: "map",
    }),
    fromPassOrFlag(byId(checks, "zoning-district"), lang, {
      id: "zoning-district",
      requirement: say(lang, {
        en: "Whether the zoning district is one the county rule names",
        es: "Si el distrito de zonificación es uno que nombra la regla del condado",
        ht: "Si distri zonaj la se youn règ konte a nonmen",
      }),
      checking: say(lang, {
        en: "The unincorporated zoning map against the districts named in the county accessory-unit section.",
        es: "El mapa de zonificación no incorporada contra los distritos nombrados en la sección del condado.",
        ht: "Kat zonaj zòn ki pa enkòpore a, konpare ak distri seksyon konte a nonmen.",
      }),
      passFound: say(lang, {
        en: `The zoning map says ${zone || "a district"}. The county section we opened allows one accessory unit in AU, EU, and RU districts inside the Urban Development Boundary. A map label is not the County's final zoning decision and is not permission to build.`,
        es: `El mapa de zonificación dice ${zone || "un distrito"}. La sección del condado que abrimos permite una unidad accesoria en distritos AU, EU y RU dentro del límite de desarrollo urbano. La etiqueta del mapa no es la decisión final del Condado ni un permiso para construir.`,
        ht: `Kat zonaj la di ${zone || "yon distri"}. Seksyon konte a nou te ouvri a pèmèt yon inite akseswa nan distri AU, EU, ak RU andedan limit devlopman iben an. Etikèt kat la pa desizyon final Konte a epi li pa pèmisyon pou bati.`,
      }),
      sourceTitle: sources.zoneLayer.title,
      sourceUrl: sources.zoneLayer.url,
      retrievedAt: facts.retrievedAt,
      sourceKind: "map",
      extra: cases
        ? say(lang, {
            en: `The zoning-hearing layer returned ${cases.hearings ?? "no"} row(s) for this folio, and the plat layer returned ${cases.plats ?? "no"}. A zero is not a full hearing history.`,
            es: `La capa de audiencias devolvió ${cases.hearings ?? "sin"} fila(s) para este folio, y la de planos devolvió ${cases.plats ?? "sin"}. Un cero no es un historial completo.`,
            ht: `Kouch odyans zonaj la voye ${cases.hearings ?? "okenn"} ranje pou folio sa a, epi kouch plan yo voye ${cases.plats ?? "okenn"}. Zewo pa vle di tout istwa a la.`,
          })
        : cases === undefined
          ? ""
          : "",
    }),
    overlayItem(lang, overlays, facts),
    fromPassOrFlag(byId(checks, "lot-area"), lang, {
      id: "lot-area",
      requirement: say(lang, {
        en: "Whether the lot meets the published minimum size",
        es: "Si el lote alcanza el tamaño mínimo publicado",
        ht: "Si teren an rive nan gwosè minimòm ki pibliye a",
      }),
      checking: say(lang, {
        en: `The parcel map area against the ${LOT_MIN_SQFT.toLocaleString("en-US")} square foot figure on the county accessory-unit page.`,
        es: `El área del mapa de la parcela contra la cifra de ${LOT_MIN_SQFT.toLocaleString("en-US")} pies cuadrados de la página del condado.`,
        ht: `Sipèfisi kat pasèl la konpare ak ${LOT_MIN_SQFT.toLocaleString("en-US")} pye kare nan paj konte a.`,
      }),
      passFound: say(lang, {
        en: `The parcel map reports ${area == null ? "no area" : formatSqFt(area)}. That is at or above the published ${LOT_MIN_SQFT.toLocaleString("en-US")} square foot minimum. This number is a map measurement, not a survey, and it is not an approval.`,
        es: `El mapa de la parcela informa ${area == null ? "sin área" : formatSqFt(area)}. Eso está en o por encima del mínimo publicado de ${LOT_MIN_SQFT.toLocaleString("en-US")} pies cuadrados. Es una medida de mapa, no un levantamiento, y no es una aprobación.`,
        ht: `Kat pasèl la di ${area == null ? "pa gen sipèfisi" : formatSqFt(area)}. Sa depase oswa egal minimòm ${LOT_MIN_SQFT.toLocaleString("en-US")} pye kare ki pibliye a. Se yon mezi kat, pa yon sondaj, epi se pa yon apwobasyon.`,
      }),
      sourceTitle: sources.parcelLayer.title,
      sourceUrl: sources.parcelLayer.url,
      retrievedAt: facts.retrievedAt,
      sourceKind: "calculated",
    }),
    lotItem(lang, lots, byId(checks, "lot-dimensions"), extentEstimate(facts.parcel?.rings ?? [])),
    dwellingItem(lang, sketch, overlays, byId(checks, "principal-dwelling")),
    sizeItem(lang, proposed, ru, countyBlocked(byId(checks, "floor-area")), code, answers?.sizeUnsure === true),
    setbackItem(lang, code, countyBlocked(byId(checks, "setbacks"))),
    designItem(lang, answers?.placement ?? "unsure", countyBlocked(byId(checks, "design-placement")), code),
    parkingItem(lang, answers?.parking ?? "unsure", countyBlocked(byId(checks, "parking")), code),
    permitItem(lang, permits, countyBlocked(byId(checks, "permits")), code),
    occupancyItem(lang, countyBlocked(byId(checks, "occupancy")), answers, code),
    saleItem(lang, code, countyBlocked(byId(checks, "sale-and-rental"))),
    hoaItem(lang, code),
    statuteItem(lang, code),
  ];
  return rows.map((row) => {
    if ((facts.zoningAreas?.length ?? 0) > 1 && row.id === "zoning-district") {
      const zones = facts.zoningAreas.join(", ");
      return {
        ...row,
        status: "rule_not_confirmed" as const,
        researchStatus: "completed" as const,
        found: say(lang, {
          en: `The mapped parcel crosses more than one zoning area (${zones}). The County should confirm which rules apply before a reliable answer. This does not by itself mean an accessory unit is prohibited.`,
          es: `La parcela del mapa cruza más de un área de zonificación (${zones}). El Condado debe confirmar qué reglas aplican antes de una respuesta confiable. Esto por sí solo no significa que una unidad accesoria esté prohibida.`,
          ht: `Pasèl kat la travèse plis pase yon zòn zonaj (${zones}). Konte a dwe konfime ki règ ki aplike anvan yon repons ou ka konte sou li. Sa pou kont li pa vle di yon inite akseswa entèdi.`,
        }),
        whyOpen: say(lang, {
          en: "Two map areas overlap this parcel, so one district was not chosen.",
          es: "Dos áreas del mapa cubren esta parcela, así que no se eligió un solo distrito.",
          ht: "De zòn nan kat la kouvri pasèl sa a, kidonk yo pa chwazi yon sèl distri.",
        }),
        nextAction: say(lang, {
          en: "Ask the County which zoning area governs this parcel before you rely on a district rule.",
          es: "Pregunte al Condado qué área de zonificación rige esta parcela antes de confiar en una regla de distrito.",
          ht: "Mande Konte a ki zòn zonaj ki gouvène pasèl sa a anvan ou konte sou yon règ distri.",
        }),
      };
    }
    const ruleRow = row.id === "lot-area" || row.id === "urban-development-boundary" || row.id === "zoning-district";
    if (!code && ruleRow) {
      return {
        ...row,
        status: "searching" as const,
        researchStatus: "searching" as const,
        found: say(lang, {
          en: "The map record is in hand. The county page that states this rule is still being read.",
          es: "El registro del mapa ya está. La página del condado que indica esta regla todavía se está leyendo.",
          ht: "Dosye kat la deja la. Paj konte a ki di règ sa a toujou ap li.",
        }),
        nextAction: "",
        who: "app" as const,
      };
    }
    if (row.id === "lot-area" && code && !code.lotMinPublished && (row.status === "pass" || row.status === "potential_issue")) {
      return {
        ...row,
        status: "rule_not_confirmed" as const,
        researchStatus: "completed" as const,
        found: say(lang, {
          en: "The parcel area was retrieved, but this search did not find the 7,500 square foot minimum on a page that opened. The stored figure was not used as a pass or a conflict.",
          es: "Se obtuvo el área de la parcela, pero esta búsqueda no encontró el mínimo de 7,500 pies cuadrados en una página que se abrió. No se usó la cifra guardada como cumplimiento ni como conflicto.",
          ht: "Sipèfisi pasèl la jwenn, men rechèch sa a pa jwenn minimòm 7,500 pye kare nan yon paj ki te ouvri. Chif ki te sove a pa itilize kòm yon pase ni kòm yon konfli.",
        }),
      };
    }
    if (row.id === "lot-area" && code?.lotMinPublished && row.status === "pass") {
      return {
        ...row,
        found: say(lang, {
          en: `The parcel map reports ${area == null ? "no area" : formatSqFt(area)}. The county accessory-unit page opened in this search and states a minimum of 7,500 square feet. The map area is at or above that figure. It is a map measurement, not a survey, and it is not an approval.`,
          es: `El mapa de la parcela informa ${area == null ? "sin área" : formatSqFt(area)}. La página del condado abierta en esta búsqueda indica un mínimo de 7,500 pies cuadrados. El área del mapa está en o por encima de esa cifra. Es una medida de mapa, no un levantamiento, y no es una aprobación.`,
          ht: `Kat pasèl la di ${area == null ? "pa gen sipèfisi" : formatSqFt(area)}. Paj konte a ki ouvri nan rechèch sa a di yon minimòm 7,500 pye kare. Sipèfisi kat la depase oswa egal chif sa a. Se yon mezi kat, pa yon sondaj, epi se pa yon apwobasyon.`,
        }),
        evidence: [`County page: ${sources.aduPage.url}`],
      };
    }
    if (row.id === "urban-development-boundary" && code && row.status === "pass") {
      if (!code.eligibilityDistrictsPublished) {
        return {
          ...row,
          status: "rule_not_confirmed" as const,
          found: say(lang, {
            en: "The county layer places this point inside the Urban Development Boundary polygon. This search did not find the page sentence that ties the districts to that boundary, so the map hit was not scored as a pass.",
            es: "La capa del condado ubica este punto dentro del polígono del límite de desarrollo urbano. Esta búsqueda no encontró la frase que une los distritos con ese límite, así que el resultado del mapa no se calificó como cumplimiento.",
            ht: "Kouch konte a mete pwen sa a andedan poligòn limit devlopman iben an. Rechèch sa a pa jwenn fraz ki mare distri yo ak limit sa a, kidonk rezilta kat la pa nòte kòm yon pase.",
          }),
        };
      }
      return {
        ...row,
        found: say(lang, {
          en: "The county page opened in this search says AU, EU, and RU districts inside the Urban Development Boundary are where one accessory unit per lot shall be permitted. The county layer places this point inside that polygon. The hit is a map test, not a survey, and it is not an approval.",
          es: "La página del condado abierta en esta búsqueda dice que en los distritos AU, EU y RU dentro del límite de desarrollo urbano se permite una unidad accesoria por lote. La capa del condado ubica este punto dentro de ese polígono. Es una prueba de mapa, no un levantamiento, y no es una aprobación.",
          ht: "Paj konte a ki ouvri nan rechèch sa a di nan distri AU, EU, ak RU andedan limit devlopman iben an, yo dwe pèmèt yon inite akseswa pou chak lot. Kouch konte a mete pwen sa a andedan poligòn sa a. Se yon tès kat, pa yon sondaj, epi se pa yon apwobasyon.",
        }),
      };
    }
    if (row.id === "zoning-district" && code && (facts.zoningAreas?.length ?? 0) <= 1 && facts.zoning) {
      const zoneCode = facts.zoning.code;
      if (!code.eligibilityDistrictsPublished && (row.status === "pass" || row.status === "potential_issue")) {
        return {
          ...row,
          status: "rule_not_confirmed" as const,
          found: say(lang, {
            en: `The zone layer returned ${zoneCode}. This search did not find the district list on a page that opened, so that label was not scored as a pass or a conflict.`,
            es: `La capa de zonas devolvió ${zoneCode}. Esta búsqueda no encontró la lista de distritos en una página que se abrió, así que esa etiqueta no se calificó como cumplimiento ni como conflicto.`,
            ht: `Kouch zòn nan voye ${zoneCode}. Rechèch sa a pa jwenn lis distri yo nan yon paj ki te ouvri, kidonk etikèt sa a pa nòte kòm yon pase ni kòm yon konfli.`,
          }),
        };
      }
      if (code.eligibilityDistrictsPublished && row.status === "pass") {
        return {
          ...row,
          sourceTitle: sources.aduPage.title,
          sourceUrl: sources.aduPage.url,
          retrievedAt: code.retrievedAt,
          found: say(lang, {
            en: `The county page opened in this search says one accessory unit per lot shall be permitted in AU, EU, and RU districts inside the Urban Development Boundary. The zone layer returned ${zoneCode}, which is in one of those families. A layer label is not an official determination, and this is not an approval.`,
            es: `La página del condado abierta en esta búsqueda dice que se permite una unidad accesoria por lote en los distritos AU, EU y RU dentro del límite de desarrollo urbano. La capa de zonas devolvió ${zoneCode}, que está en una de esas familias. Una etiqueta de capa no es una determinación oficial, y esto no es una aprobación.`,
            ht: `Paj konte a ki ouvri nan rechèch sa a di yo dwe pèmèt yon inite akseswa pou chak lot nan distri AU, EU, ak RU andedan limit devlopman iben an. Kouch zòn nan voye ${zoneCode}, ki nan youn nan fanmi sa yo. Yon etikèt kouch pa yon desizyon ofisyèl, epi sa pa yon apwobasyon.`,
          }),
        };
      }
      if (code.eligibilityDistrictsPublished && row.status === "potential_issue") {
        return {
          ...row,
          sourceTitle: sources.aduPage.title,
          sourceUrl: sources.aduPage.url,
          retrievedAt: code.retrievedAt,
          found: say(lang, {
            en: `The county page opened in this search names AU, EU, and RU. The zone layer returned ${zoneCode}, which that sentence does not name. The page does not say this district is prohibited. The County should confirm which rules apply.`,
            es: `La página del condado abierta en esta búsqueda nombra AU, EU y RU. La capa de zonas devolvió ${zoneCode}, que esa frase no nombra. La página no dice que este distrito esté prohibido. El Condado debe confirmar qué reglas aplican.`,
            ht: `Paj konte a ki ouvri nan rechèch sa a nonmen AU, EU, ak RU. Kouch zòn nan voye ${zoneCode}, fraz sa a pa nonmen l. Paj la pa di distri sa a entèdi. Konte a dwe konfime ki règ ki aplike.`,
          }),
        };
      }
    }
    return row;
  });
}

function fromPassOrFlag(
  check: CheckResult | undefined,
  lang: Lang,
  copy: {
    id: string;
    requirement: string;
    checking: string;
    passFound: string;
    sourceTitle: string;
    sourceUrl: string;
    retrievedAt: string;
    sourceKind: ChecklistItem["sourceKind"];
    extra?: string;
  },
): ChecklistItem {
  const status: ChecklistStatus = check?.status === "FLAG" ? "potential_issue" : check?.status === "PASS" ? "pass" : check?.ruleState === "not-applied" ? "not_applicable" : "missing_information";
  const open = status !== "pass";
  return item({
    id: copy.id,
    requirement: copy.requirement,
    checking: copy.checking,
    status,
    found: status === "pass" ? copy.passFound : check?.finding ?? copy.passFound,
    whyOpen: open
      ? say(lang, {
          en: "The retrieved facts and the opened rule do not line up as a pass.",
          es: "Los datos obtenidos y la regla abierta no coinciden como un cumplimiento.",
          ht: "Enfòmasyon yo jwenn ak règ ki ouvri a pa dakò pou di li pase.",
        })
      : "",
    searched: say(lang, {
      en: "County map layers already used for this screen.",
      es: "Capas de mapas del condado que esta pantalla ya consultó.",
      ht: "Kouch kat konte a ekran sa a deja gade.",
    }),
    nextAction: open
      ? say(lang, {
          en: status === "not_applicable" ? "Ask the city that governs this lot which rules apply. County accessory-unit rules were not used." : "Ask the County to confirm this item. This screen is not an approval.",
          es: status === "not_applicable" ? "Pregunte a la ciudad que gobierna este lote qué reglas aplican. No se usaron las reglas del condado." : "Pida al Condado que confirme este punto. Esta pantalla no es una aprobación.",
          ht: status === "not_applicable" ? "Mande vil ki gouvène teren an ki règ ki aplike. Règ konte a pa te itilize." : "Mande Konte a konfime pwen sa a. Ekran sa a pa yon apwobasyon.",
        })
      : say(lang, { en: "No further search on this item. This is not an approval.", es: "No hay más búsqueda en este punto. No es una aprobación.", ht: "Pa gen plis rechèch sou pwen sa a. Sa pa yon apwobasyon." }),
    who: open ? "county" : "",
    evidence: [copy.extra, check?.evidence.join(" ")].filter((line): line is string => Boolean(line)),
    englishNote: check?.finding ?? "",
    sourceTitle: copy.sourceTitle,
    sourceUrl: copy.sourceUrl,
    retrievedAt: copy.retrievedAt,
    sourceKind: copy.sourceKind,
  });
}

function overlayItem(lang: Lang, overlays: ResearchState["overlays"], facts: SiteFacts): ChecklistItem {
  const base = {
    id: "overlays",
    requirement: say(lang, { en: "Whether a special map overlay covers the lot", es: "Si una capa especial cubre el lote", ht: "Si yon kouch espesyal kouvri teren an" }),
    checking: say(lang, {
      en: "Wellfield, wetland, urban-center, and rapid-transit maps, plus the overlay field on the zoning polygon.",
      es: "Mapas de pozo, humedal, centro urbano y tránsito rápido, y el campo de superposición del polígono de zona.",
      ht: "Kat pi, marekaj, sant iben, ak transpò rapid, ansanm ak chan sipèpozisyon nan poligòn zòn nan.",
    }),
    sourceTitle: "Miami-Dade environmental and zoning map layers",
    sourceUrl: "https://gis.miamidade.gov/arcgis/rest/services/MD_EnvironmentalConsiderations/MapServer/4",
    sourceKind: "map" as const,
  };
  if (!overlays) {
    return searching(lang, base);
  }
  const well = overlays.wellfieldName;
  const blanks = [
    overlays.wetlandCount === 0 ? say(lang, { en: "wetlands", es: "humedales", ht: "marekaj" }) : "",
    overlays.urbanCenterCount === 0 ? say(lang, { en: "urban centers", es: "centros urbanos", ht: "sant iben" }) : "",
    overlays.rapidTransitCount === 0 ? say(lang, { en: "rapid transit zones", es: "zonas de tránsito rápido", ht: "zòn transpò rapid" }) : "",
  ].filter(Boolean);
  const failed = overlays.failedLayers.length
    ? say(lang, {
        en: `These lookups failed: ${overlays.failedLayers.join(", ")}.`,
        es: `Estas consultas fallaron: ${overlays.failedLayers.join(", ")}.`,
        ht: `Rechèch sa yo echwe: ${overlays.failedLayers.join(", ")}.`,
      })
    : "";
  const found = [
    well
      ? say(lang, {
          en: `The wellfield map places this point in ${well}.`,
          es: `El mapa de pozos coloca este punto en ${well}.`,
          ht: `Kat pi a mete pwen sa a nan ${well}.`,
        })
      : say(lang, { en: "The wellfield map returned no area at this point.", es: "El mapa de pozos no devolvió un área en este punto.", ht: "Kat pi a pa voye yon zòn nan pwen sa a." }),
    overlays.zoneOverlay
      ? say(lang, { en: `The zoning polygon overlay field says ${overlays.zoneOverlay}.`, es: `El campo de superposición dice ${overlays.zoneOverlay}.`, ht: `Chan sipèpozisyon zòn nan di ${overlays.zoneOverlay}.` })
      : say(lang, { en: "The zoning polygon's overlay field was blank.", es: "El campo de superposición del polígono de zona estaba vacío.", ht: "Chan sipèpozisyon poligòn zòn nan te vid." }),
    blanks.length
      ? say(lang, {
          en: `No feature came back for ${blanks.join(", ")}.`,
          es: `No volvió ningún elemento para ${blanks.join(", ")}.`,
          ht: `Pa gen eleman ki tounen pou ${blanks.join(", ")}.`,
        })
      : "",
    overlays.landUse
      ? say(lang, {
          en: `Existing-land-use map description: ${overlays.landUse}. That description is not proof of a house and is not accessory-unit eligibility.`,
          es: `Descripción del mapa de uso del suelo: ${overlays.landUse}. Esa descripción no prueba que haya una casa ni es elegibilidad para una unidad accesoria.`,
          ht: `Deskripsyon kat itilizasyon tè a: ${overlays.landUse}. Deskripsyon sa a pa pwouve gen yon kay epi li pa vle di li kalifye pou yon inite akseswa.`,
        })
      : "",
    failed,
  ]
    .filter(Boolean)
    .join(" ");
  return item({
    ...base,
    status: overlays.failedLayers.includes("parcel") ? "missing_information" : "rule_not_confirmed",
    found,
    whyOpen: say(lang, {
      en: "A map hit, a blank field, or a missing feature is not a County letter about overlays. The rule for an accessory unit inside a wellfield was not opened.",
      es: "Un resultado de mapa, un campo vacío o un elemento ausente no es una carta del Condado sobre superposiciones. No se abrió la regla de una unidad accesoria dentro de un área de pozo.",
      ht: "Yon rezilta kat, yon chan vid, oswa yon eleman ki pa la se pa yon lèt Konte a sou kouch espesyal. Règ pou yon inite akseswa andedan yon zòn pi pa te ouvri.",
    }),
    searched: say(lang, {
      en: "Wellfield, wetland, urban-center, rapid-transit, existing-land-use, and zoning-overlay field.",
      es: "Pozo, humedal, centro urbano, tránsito rápido, uso del suelo y el campo de superposición.",
      ht: "Pi, marekaj, sant iben, transpò rapid, itilizasyon tè, ak chan sipèpozisyon an.",
    }),
    nextAction: say(lang, {
      en: "Ask Miami-Dade zoning what the wellfield area, if any, means for an accessory unit.",
      es: "Pregunte a zonificación de Miami-Dade qué significa el área de pozo, si hay una, para una unidad accesoria.",
      ht: "Mande zonaj Miami-Dade kisa zòn pi a, si gen youn, vle di pou yon inite akseswa.",
    }),
    who: "county",
    evidence: overlays.zoneDescription ? [`Zone description from the map: ${overlays.zoneDescription}`] : [],
    englishNote: overlays.landUse ? `Map text: ${overlays.landUse}` : "",
    retrievedAt: overlays.retrievedAt || facts.retrievedAt,
  });
}

function lotItem(
  lang: Lang,
  lots: ResearchState["lotFields"],
  check: CheckResult | undefined,
  estimate: { eastWestFt: number; northSouthFt: number } | null,
): ChecklistItem {
  const base = {
    id: "lot-dimensions",
    requirement: say(lang, { en: "Lot width and depth", es: "Ancho y fondo del lote", ht: "Lajè ak pwofondè teren an" }),
    checking: say(lang, {
      en: "Whether the county lot map has official width and depth fields. The parcel outline is not measured and called a width.",
      es: "Si el mapa de lotes del condado tiene campos oficiales de ancho y fondo. No se mide el contorno y se le llama ancho.",
      ht: "Si kat lot konte a gen chan ofisyèl pou lajè ak pwofondè. Kontou pasèl la pa mezire pou rele l lajè.",
    }),
    sourceTitle: "Miami-Dade lot map",
    sourceUrl: "https://gis.miamidade.gov/arcgis/rest/services/MD_LandInformation/MapServer/27",
    sourceKind: "map" as const,
  };
  if (!lots) return searching(lang, base);
  if (!lots.ok) {
    return failed(lang, base, lots.httpStatus, lots.retrievedAt);
  }
  return item({
    ...base,
    status: "outside_review",
    found: lots.hasWidthOrDepth
      ? say(lang, { en: "The lot map has a width or depth field, but this screen still does not treat it as a survey.", es: "El mapa de lotes tiene un campo de ancho o fondo, pero esta pantalla no lo trata como un levantamiento.", ht: "Kat lot la gen yon chan lajè oswa pwofondè, men ekran sa a pa pran l pou yon sondaj." })
      : estimate
        ? say(lang, {
            en: `The parcel outline spans about ${estimate.eastWestFt.toLocaleString("en-US")} feet east-west and ${estimate.northSouthFt.toLocaleString("en-US")} feet north-south, which is a geometry estimate, not a survey and not the lot width or depth.`,
            es: `El contorno de la parcela abarca unos ${estimate.eastWestFt.toLocaleString("en-US")} pies de este a oeste y ${estimate.northSouthFt.toLocaleString("en-US")} pies de norte a sur, y eso es una estimación geométrica, no un levantamiento ni el ancho o el fondo del lote.`,
            ht: `Kontou pasèl la fè anviwon ${estimate.eastWestFt.toLocaleString("en-US")} pye lès-lwès ak ${estimate.northSouthFt.toLocaleString("en-US")} pye nò-sid, e sa se yon estimasyon jewometri, pa yon sondaj ni lajè oswa pwofondè teren an.`,
          })
        : say(lang, {
            en: "The county lot map responded. Its fields do not include width, depth, or frontage. No width or depth was established.",
            es: "El mapa de lotes del condado respondió. Sus campos no incluyen ancho, fondo ni frente. No se estableció el ancho ni el fondo.",
            ht: "Kat lot konte a reponn. Chan li yo pa gen lajè, pwofondè, ni fasad. Lajè a ak pwofondè a pa etabli.",
          }),
    whyOpen: say(lang, {
      en: "The district width table was not in the lot map, and a polygon outline is not a lot width.",
      es: "La tabla de ancho del distrito no estaba en el mapa de lotes, y el contorno no es el ancho del lote.",
      ht: "Tablo lajè distri a pa nan kat lot la, epi kontou a pa lajè teren an.",
    }),
    searched: say(lang, {
      en: `Lot-map fields checked: ${lots.fieldNames.join(", ") || "none returned"}.`,
      es: `Campos del mapa de lotes revisados: ${lots.fieldNames.join(", ") || "ninguno"}.`,
      ht: `Chan kat lot yo ki tcheke: ${lots.fieldNames.join(", ") || "okenn"}.`,
    }),
    nextAction: say(lang, {
      en: "A surveyor needs to measure the width and depth. This screen will not invent them.",
      es: "Un topógrafo tiene que medir el ancho y el fondo. Esta pantalla no los inventa.",
      ht: "Yon sipèy dwe mezire lajè a ak pwofondè a. Ekran sa a pap envante yo.",
    }),
    who: "professional",
    evidence: [],
    englishNote: check?.finding ?? "",
    retrievedAt: lots.retrievedAt,
  });
}

function dwellingItem(lang: Lang, sketch: ResearchState["sketch"], overlays: ResearchState["overlays"], check: CheckResult | undefined): ChecklistItem {
  const base = {
    id: "principal-dwelling",
    requirement: say(lang, {
      en: "A principal house on the lot, and no extra unit already there",
      es: "Una casa principal en el lote, y que no haya ya otra unidad",
      ht: "Yon kay prensipal sou teren an, epi pa gen yon lòt inite deja la",
    }),
    checking: say(lang, {
      en: "The Property Appraiser building sketch for living area. A living-area number is not proof of a principal house and is not accessory-unit eligibility.",
      es: "El croquis del Tasador para el área habitable. Un número de área no prueba que haya una casa principal ni es elegibilidad.",
      ht: "Desen Property Appraiser la pou sipèfisi kote moun ka rete. Yon chif sipèfisi pa pwouve gen yon kay prensipal epi li pa kalifikasyon.",
    }),
    sourceTitle: "Miami-Dade Property Appraiser building sketch",
    sourceUrl: sketch?.url || "https://apps.miamidadepa.gov/PAOnlineTools/PropertySketch/Sketch.aspx",
    sourceKind: "record" as const,
  };
  if (!sketch) return searching(lang, base);
  if (!sketch.ok || !sketch.matchedFolio) {
    return failed(lang, base, sketch.httpStatus, sketch.retrievedAt);
  }
  const living = sketch.livingSqFt == null ? "" : formatSqFt(sketch.livingSqFt);
  return item({
    ...base,
    status: countyBlocked(check) ? "not_applicable" : "missing_information",
    found: say(lang, {
      en: `The Property Appraiser sketch for this folio shows living area ${living || "not stated"}, actual area ${sketch.actualSqFt == null ? "not stated" : formatSqFt(sketch.actualSqFt)}, at ${sketch.address ?? "the folio"}. The sketch does not say that this is one principal house or that no accessory unit already exists.`,
      es: `El croquis del Tasador para este folio muestra área habitable ${living || "no indicada"}, área real ${sketch.actualSqFt == null ? "no indicada" : formatSqFt(sketch.actualSqFt)}, en ${sketch.address ?? "el folio"}. El croquis no dice que sea una sola casa principal ni que no exista ya una unidad accesoria.`,
      ht: `Desen Taxatè a pou folio sa a montre sipèfisi kote moun ka rete ${living || "pa di"}, sipèfisi reyèl ${sketch.actualSqFt == null ? "pa di" : formatSqFt(sketch.actualSqFt)}, nan ${sketch.address ?? "folio a"}. Desen an pa di se yon sèl kay prensipal ni li pa di pa gen yon inite akseswa deja la.`,
    }),
    whyOpen: say(lang, {
      en: "A tax sketch is an official record of area. It is not a zoning finding that a principal single-family house exists.",
      es: "El croquis fiscal es un registro oficial del área. No es un hallazgo de zonificación de que existe una casa unifamiliar principal.",
      ht: "Desen taks la se yon dosye ofisyèl sou sipèfisi. Li pa yon konklizyon zonaj ki di gen yon kay prensipal pou yon sèl fanmi.",
    }),
    searched: [
      say(lang, { en: "Property Appraiser sketch page for this folio.", es: "Página del croquis del Tasador para este folio.", ht: "Paj desen Taxatè a pou folio sa a." }),
      overlays?.landUse
        ? say(lang, {
            en: `Existing-land-use map says: ${overlays.landUse}. That is a map description, not eligibility.`,
            es: `El mapa de uso del suelo dice: ${overlays.landUse}. Es una descripción de mapa, no elegibilidad.`,
            ht: `Kat itilizasyon tè a di: ${overlays.landUse}. Se yon deskripsyon kat, pa kalifikasyon.`,
          })
        : "",
    ]
      .filter(Boolean)
      .join(" "),
    nextAction: say(lang, {
      en: "You can look at the property and say whether one house is there and whether a second unit already exists. The County building record can confirm it. This screen will not guess.",
      es: "Usted puede mirar la propiedad y decir si hay una casa y si ya existe una segunda unidad. El registro de construcción del Condado puede confirmarlo. Esta pantalla no lo adivina.",
      ht: "Ou ka gade pwopriyete a epi di si gen yon kay epi si yon dezyèm inite deja egziste. Dosye konstriksyon Konte a ka konfime l. Ekran sa a pap devine.",
    }),
    who: "homeowner",
    evidence: [],
    englishNote: check?.finding ?? "",
    retrievedAt: sketch.retrievedAt,
  });
}

function sizeItem(lang: Lang, proposed: number | null, ru: boolean, blocked: boolean, code: ResearchState["code"], sizeUnsure: boolean): ChecklistItem {
  const base = {
    id: "floor-area",
    requirement: say(lang, { en: "Size of the new unit", es: "Tamaño de la unidad nueva", ht: "Gwosè nouvo inite a" }),
    checking: say(lang, {
      en: "A proposed size against the 400 to 800 square foot range the county accessory-unit page states for RU-1.",
      es: "Un tamaño propuesto contra el rango de 400 a 800 pies cuadrados que la página del condado indica para RU-1.",
      ht: "Yon gwosè ou pwopoze konpare ak 400 a 800 pye kare paj konte a di pou RU-1.",
    }),
    sourceTitle: sources.aduPage.title,
    sourceUrl: sources.aduPage.url,
    sourceKind: "record" as const,
    retrievedAt: code?.retrievedAt || "2026-10-25",
  };
  if (blocked) {
    return item({
      ...base,
      status: "not_applicable",
      found: say(lang, { en: "County size rules were not applied because the map does not place this lot in unincorporated Miami-Dade.", es: "No se aplicaron las reglas de tamaño del condado porque el mapa no ubica este lote en el área no incorporada.", ht: "Règ gwosè konte a pa aplike paske kat la pa mete teren sa a nan zòn Miami-Dade ki pa enkòpore." }),
      whyOpen: say(lang, { en: "The city's rule was not retrieved.", es: "No se obtuvo la regla de la ciudad.", ht: "Règ vil la pa jwenn." }),
      searched: say(lang, { en: "Municipality map.", es: "Mapa de municipios.", ht: "Kat minisipalite." }),
      nextAction: say(lang, { en: "Ask the city that governs the lot.", es: "Pregunte a la ciudad que gobierna el lote.", ht: "Mande vil ki gouvène teren an." }),
      who: "county",
      evidence: [],
      englishNote: "",
    });
  }
  if (!code) return searching(lang, base);
  if (sizeUnsure || proposed == null) {
    return item({
      ...base,
      status: "missing_information",
      found: say(lang, {
        en: sizeUnsure
          ? "You marked the size as not sure. The check stays open until there is a number."
          : code.ruSizePublished
            ? "No proposed size is on file. The county page opened in this search says 400 to 800 square feet in RU-1."
            : "No proposed size is on file, and this search did not find a published size range on a page that opened.",
        es: sizeUnsure
          ? "Marcó el tamaño como no seguro. El control sigue abierto hasta que haya un número."
          : code.ruSizePublished
            ? "No hay un tamaño propuesto. La página del condado abierta en esta búsqueda dice 400 a 800 pies cuadrados en RU-1."
            : "No hay un tamaño propuesto, y esta búsqueda no encontró un rango publicado en una página que se abrió.",
        ht: sizeUnsure
          ? "Ou make gwosè a kòm ou pa sèten. Tès la rete ouvè jiskaske gen yon chif."
          : code.ruSizePublished
            ? "Pa gen yon gwosè ou pwopoze. Paj konte a ki ouvri nan rechèch sa a di 400 a 800 pye kare nan RU-1."
            : "Pa gen yon gwosè ou pwopoze, epi rechèch sa a pa jwenn yon limit ki pibliye nan yon paj ki te ouvri.",
      }),
      whyOpen: say(lang, { en: "The size depends on the unit you want to build. Records of the existing house are not the proposed unit.", es: "El tamaño depende de la unidad que quiere construir. Los datos de la casa existente no son la unidad propuesta.", ht: "Gwosè a depann de inite ou vle bati a. Dosye kay ki deja la a se pa inite ou pwopoze a." }),
      searched: say(lang, { en: "County accessory-unit page. No floor plan was in the public records this screen queried.", es: "Página del condado. No había un plano en los registros públicos que esta pantalla consultó.", ht: "Paj konte a. Pa te gen yon plan nan dosye piblik ekran sa a gade." }),
      nextAction: say(lang, { en: "Enter the size you have in mind. The check will run again.", es: "Escriba el tamaño que tiene en mente. El control se volverá a hacer.", ht: "Antre gwosè ou gen nan tèt ou. Tès la ap fèt ankò." }),
      who: "homeowner",
      evidence: [],
      englishNote: "",
    });
  }
  if (code.ruSizePublished !== true || !ru) {
    return item({
      ...base,
      status: "rule_not_confirmed",
      found: say(lang, {
        en: `You said ${proposed} square feet, and ${code.ruSizePublished ? "the 400 to 800 square foot range on the county page is for RU-1" : "this search did not find a published size range on a page that opened"}, so that figure was not scored as a pass or a conflict.`,
        es: `Usted indicó ${proposed} pies cuadrados, y ${code.ruSizePublished ? "el rango de 400 a 800 pies cuadrados de la página del condado es para RU-1" : "esta búsqueda no encontró un rango publicado en una página que se abrió"}, así que esa cifra no se calificó como cumplimiento ni como conflicto.`,
        ht: `Ou di ${proposed} pye kare, epi ${code.ruSizePublished ? "limit 400 a 800 pye kare nan paj konte a se pou RU-1" : "rechèch sa a pa jwenn yon limit ki pibliye nan yon paj ki te ouvri"}, kidonk chif sa a pa nòte kòm yon pase ni kòm yon konfli.`,
      }),
      whyOpen: say(lang, { en: "The published range that was opened does not decide this district.", es: "El rango publicado que se abrió no decide este distrito.", ht: "Limit ki pibliye ki te ouvri a pa deside distri sa a." }),
      searched: say(lang, { en: "County accessory-unit page, then your answer.", es: "Página del condado y luego su respuesta.", ht: "Paj konte a, epi repons ou." }),
      nextAction: say(lang, { en: "Ask the County what size is allowed in the district that governs this parcel.", es: "Pregunte al Condado qué tamaño se permite en el distrito que rige esta parcela.", ht: "Mande Konte a ki gwosè ki pèmèt nan distri ki gouvène pasèl sa a." }),
      who: "county",
      evidence: [],
      englishNote: "",
    });
  }
  const inRange = proposed >= 400 && proposed <= 800;
  return item({
    ...base,
    status: inRange ? "pass" : "potential_issue",
    found: say(lang, {
      en: `You said ${proposed} square feet. The county page states 400 to 800 square feet in RU-1. ${inRange ? "That stated size is inside the published range." : "That stated size is outside the published range."} Your statement is not a stamped plan, and this is not an approval.`,
      es: `Usted indicó ${proposed} pies cuadrados. La página del condado indica 400 a 800 pies cuadrados en RU-1. ${inRange ? "Ese tamaño está dentro del rango publicado." : "Ese tamaño está fuera del rango publicado."} Su dato no es un plano sellado y esto no es una aprobación.`,
      ht: `Ou di ${proposed} pye kare. Paj konte a di 400 a 800 pye kare nan RU-1. ${inRange ? "Gwosè sa a andedan limit ki pibliye a." : "Gwosè sa a deyò limit ki pibliye a."} Sa ou di a pa yon plan ki gen so, epi sa pa yon apwobasyon.`,
    }),
    whyOpen: inRange
      ? ""
      : say(lang, { en: "The stated size does not fit the published RU-1 range.", es: "El tamaño indicado no entra en el rango publicado de RU-1.", ht: "Gwosè ou bay la pa antre nan limit RU-1 ki pibliye a." }),
    searched: say(lang, { en: "County accessory-unit page, then your answer.", es: "Página del condado y luego su respuesta.", ht: "Paj konte a, epi repons ou." }),
    nextAction: inRange
      ? say(lang, { en: "A designer still has to draw the unit. This pass is only the published range.", es: "Un diseñador todavía tiene que dibujar la unidad. Este cumplimiento es solo el rango publicado.", ht: "Yon designer toujou dwe desine inite a. Pase sa a se sèlman limit ki pibliye a." })
      : say(lang, { en: "Change the size or ask the County about an exception. This screen did not find one.", es: "Cambie el tamaño o pregunte al Condado por una excepción. Esta pantalla no encontró una.", ht: "Chanje gwosè a oswa mande Konte a sou yon eksepsyon. Ekran sa a pa jwenn youn." }),
    who: inRange ? "" : "homeowner",
    evidence: [],
    englishNote: "",
  });
}

function setbackItem(lang: Lang, code: ResearchState["code"], blocked: boolean): ChecklistItem {
  const base = {
    id: "setbacks",
    requirement: say(lang, { en: "Distance to the lot lines and how much of the lot can be covered", es: "Distancia a los linderos y cuánto del lote se puede cubrir", ht: "Distans ak limit teren an ak konbyen nan teren an ki ka kouvri" }),
    checking: say(lang, {
      en: "The district numbers for setbacks and coverage. The county section says which setbacks apply, but the numbers live in the district rules.",
      es: "Los números del distrito para retiros y cobertura. La sección del condado dice qué retiros aplican, pero los números están en las reglas del distrito.",
      ht: "Chif distri a pou distans ak kouvèti. Seksyon konte a di ki distans ki aplike, men chif yo nan règ distri a.",
    }),
    sourceTitle: sources.code.title,
    sourceUrl: code?.municodeUrl || sources.code.url,
    sourceKind: "record" as const,
  };
  if (blocked) {
    return item({
      ...base,
      status: "not_applicable",
      found: say(lang, { en: "County setback rules were not applied.", es: "No se aplicaron los retiros del condado.", ht: "Règ distans konte a pa aplike." }),
      whyOpen: say(lang, { en: "The city rules were not retrieved.", es: "No se obtuvieron las reglas de la ciudad.", ht: "Règ vil la pa jwenn." }),
      searched: say(lang, { en: "Municipality map.", es: "Mapa de municipios.", ht: "Kat minisipalite." }),
      nextAction: say(lang, { en: "Ask the city.", es: "Pregunte a la ciudad.", ht: "Mande vil la." }),
      who: "county",
      evidence: [],
      englishNote: "",
      retrievedAt: factsTime(code),
    });
  }
  if (!code) return searching(lang, base);
  const table = code.zoneTableFields.length
    ? say(lang, {
        en: `The public zone table fields are ${code.zoneTableFields.join(", ")}. ${code.zoneTableDescription ? `It describes the district as ${code.zoneTableDescription}.` : ""} It does not list setback feet.`,
        es: `Los campos de la tabla pública de zonas son ${code.zoneTableFields.join(", ")}. ${code.zoneTableDescription ? `Describe el distrito como ${code.zoneTableDescription}.` : ""} No lista los pies de retiro.`,
        ht: `Chan tablo zòn piblik la se ${code.zoneTableFields.join(", ")}. ${code.zoneTableDescription ? `Li dekri distri a kòm ${code.zoneTableDescription}.` : ""} Li pa bay pye distans yo.`,
      })
    : say(lang, { en: "The zone table did not return fields.", es: "La tabla de zonas no devolvió campos.", ht: "Tablo zòn nan pa voye chan." });
  const recovered = code.recoverySource === "county-adu-page";
  return item({
    ...base,
    status: "rule_not_confirmed",
    researchStatus: code.municodeStatus === 403 && !recovered ? "blocked" : "completed",
    sourceTitle: recovered ? sources.aduPage.title : base.sourceTitle,
    sourceUrl: recovered ? sources.aduPage.url : base.sourceUrl,
    found: say(lang, {
      en: recovered
        ? "The setback and coverage numbers were not established. The county accessory-unit page opened and says setbacks still apply, but it does not give the feet."
        : "The setback and coverage numbers were not established. The code page did not open, and no replacement number was found.",
      es: recovered
        ? "No se establecieron los números de retiro ni de cobertura. La página del condado abrió y dice que los retiros siguen aplicando, pero no da los pies."
        : "No se establecieron los números de retiro ni de cobertura. La página del código no abrió y no se encontró un número de reemplazo.",
      ht: recovered
        ? "Chif distans ak kouvèti yo pa etabli. Paj konte a ouvri epi li di distans yo toujou aplike, men li pa bay pye yo."
        : "Chif distans ak kouvèti yo pa etabli. Paj kòd la pa ouvri epi pa gen yon chif ranplasman.",
    }),
    whyOpen: say(lang, {
      en: "A failed code fetch is not a decision that the lot fails. The feet were still not on a page this screen could open.",
      es: "Una consulta fallida del código no es una decisión de que el lote no cumple. Los pies no estaban en una página que esta pantalla pudo abrir.",
      ht: "Yon rechèch kòd ki echwe se pa yon desizyon ki di teren an pa pase. Pye yo pa te nan yon paj ekran sa a te kapab ouvri.",
    }),
    searched: say(lang, {
      en: `Municode returned HTTP ${code.municodeStatus ?? "no response"}. ${recovered ? "The county accessory-unit page was opened instead of swapping in another code site." : "No alternative county page supplied the section."} ${table}`,
      es: `Municode devolvió HTTP ${code.municodeStatus ?? "sin respuesta"}. ${recovered ? "Se abrió la página del condado en lugar de usar otro sitio del código." : "Ninguna página alternativa del condado dio la sección."} ${table}`,
      ht: `Municode voye HTTP ${code.municodeStatus ?? "pa gen repons"}. ${recovered ? "Paj konte a te ouvri olye pou yo mete yon lòt sit kòd." : "Okenn paj altènatif konte a pa bay seksyon an."} ${table}`,
    }),
    nextAction: say(lang, {
      en: "Ask County zoning for the setback and coverage numbers, then have a designer measure them on a plan.",
      es: "Pida a zonificación del Condado los números de retiro y cobertura, y luego un diseñador debe medirlos en un plano.",
      ht: "Mande zonaj Konte a chif distans ak kouvèti yo, epi yon designer dwe mezire yo sou yon plan.",
    }),
    who: "county",
    evidence: [],
    englishNote: code.zoneTableDescription ?? "",
    retrievedAt: code.retrievedAt,
  });
}

function designItem(lang: Lang, placement: HomeownerAnswers["placement"], blocked: boolean, code: ResearchState["code"]): ChecklistItem {
  const recovered = code?.recoverySource === "county-adu-page" || (code?.aduPageStatus === 200 && (code.frontPlacementProhibited || code.heightMentioned));
  const base = {
    id: "design-placement",
    requirement: say(lang, { en: "Where the unit sits and how tall it is", es: "Dónde se ubica la unidad y qué tan alta es", ht: "Ki kote inite a chita ak ki wotè li" }),
    checking: say(lang, {
      en: "Whether a page opened in this search says where a detached unit may sit and how its height compares with the house.",
      es: "Si una página abierta en esta búsqueda dice dónde puede ubicarse una unidad separada y cómo se compara su altura con la casa.",
      ht: "Si yon paj ki ouvri nan rechèch sa a di ki kote yon inite separe ka chita ak kijan wotè li konpare ak kay la.",
    }),
    sourceTitle: recovered ? sources.aduPage.title : sources.code.title,
    sourceUrl: recovered ? sources.aduPage.url : code?.municodeUrl || sources.code.url,
    sourceKind: "record" as const,
    retrievedAt: code?.retrievedAt || "",
  };
  if (blocked) {
    return item({
      ...base,
      status: "not_applicable",
      found: say(lang, { en: "County placement rules were not applied.", es: "No se aplicaron las reglas de ubicación del condado.", ht: "Règ kote inite a dwe ye nan konte a pa aplike." }),
      whyOpen: say(lang, { en: "The city rules were not retrieved.", es: "No se obtuvieron las reglas de la ciudad.", ht: "Règ vil la pa jwenn." }),
      searched: say(lang, { en: "Municipality map.", es: "Mapa de municipios.", ht: "Kat minisipalite." }),
      nextAction: say(lang, { en: "Ask the city.", es: "Pregunte a la ciudad.", ht: "Mande vil la." }),
      who: "county",
      evidence: [],
      englishNote: "",
    });
  }
  if (!code || typeof code.frontPlacementProhibited !== "boolean") return searching(lang, base);
  const height = code.heightMentioned
    ? say(lang, {
        en: " The county page says a detached unit’s height cannot exceed the principal structure. No drawing was compared, so height was not scored.",
        es: " La página del condado dice que la altura de una unidad separada no puede superar la estructura principal. No se comparó un dibujo, así que la altura no se calificó.",
        ht: " Paj konte a di wotè yon inite separe pa ka depase estrikti prensipal la. Yo pa konpare yon desen, kidonk wotè a pa nòte.",
      })
    : say(lang, {
        en: " This search did not find a height sentence on a page that opened.",
        es: " Esta búsqueda no encontró una frase sobre la altura en una página que se abrió.",
        ht: " Rechèch sa a pa jwenn yon fraz sou wotè nan yon paj ki te ouvri.",
      });
  const searched = say(lang, {
    en: `Municode returned HTTP ${code.municodeStatus ?? "no response"}. ${code.frontPlacementProhibited || code.heightMentioned ? "The county accessory-unit page was the page that opened." : "No replacement page stated placement or height."}`,
    es: `Municode devolvió HTTP ${code.municodeStatus ?? "sin respuesta"}. ${code.frontPlacementProhibited || code.heightMentioned ? "La página del condado fue la que se abrió." : "Ninguna página de reemplazo indicó la ubicación o la altura."}`,
    ht: `Municode voye HTTP ${code.municodeStatus ?? "pa gen repons"}. ${code.frontPlacementProhibited || code.heightMentioned ? "Paj konte a se paj ki te ouvri a." : "Okenn paj ranplasman pa di kote a oswa wotè a."}`,
  });
  if (placement === "in-front" && code.frontPlacementProhibited) {
    return item({
      ...base,
      status: "potential_issue",
      found: say(lang, {
        en: `You said the unit would sit in front of the house. The county page opened in this search says detached units may not be in front of the principal structure. That conflicts with the stated plan. It is not a denial.${height}`,
        es: `Usted dijo que la unidad quedaría frente a la casa. La página del condado abierta en esta búsqueda dice que las unidades separadas no pueden estar frente a la estructura principal. Eso choca con el plan indicado. No es una denegación.${height}`,
        ht: `Ou di inite a ta chita devan kay la. Paj konte a ki ouvri nan rechèch sa a di inite separe pa ka devan estrikti prensipal la. Sa konfli ak plan ou di a. Se pa yon refi.${height}`,
      }),
      whyOpen: say(lang, { en: "The stated placement conflicts with the sentence on the page that opened.", es: "La ubicación indicada choca con la frase de la página que se abrió.", ht: "Kote ou di a konfli ak fraz paj ki te ouvri a." }),
      searched,
      nextAction: say(lang, { en: "Place it beside or behind the house, or ask the County before drawing plans.", es: "Ubíquela al lado o detrás de la casa, o pregunte al Condado antes de dibujar planos.", ht: "Mete l bò kote oswa dèyè kay la, oswa mande Konte a anvan ou fè plan." }),
      who: "homeowner",
      evidence: [],
      englishNote: "",
    });
  }
  if (placement === "in-front") {
    return item({
      ...base,
      status: "rule_not_confirmed",
      found: say(lang, {
        en: `You said the unit would sit in front of the house. This search did not find a sentence that prohibits that placement, so it was not scored as a conflict.${height}`,
        es: `Usted dijo que la unidad quedaría frente a la casa. Esta búsqueda no encontró una frase que prohíba esa ubicación, así que no se calificó como conflicto.${height}`,
        ht: `Ou di inite a ta chita devan kay la. Rechèch sa a pa jwenn yon fraz ki entèdi kote sa a, kidonk li pa nòte kòm yon konfli.${height}`,
      }),
      whyOpen: say(lang, { en: "The placement rule was not on a page this search opened.", es: "La regla de ubicación no estaba en una página que esta búsqueda abrió.", ht: "Règ kote a pa te nan yon paj rechèch sa a te ouvri." }),
      searched,
      nextAction: say(lang, { en: "Ask the County whether a unit may sit in front of this house.", es: "Pregunte al Condado si una unidad puede quedar frente a esta casa.", ht: "Mande Konte a si yon inite ka chita devan kay sa a." }),
      who: "county",
      evidence: [],
      englishNote: "",
    });
  }
  if (placement === "behind") {
    return item({
      ...base,
      status: "missing_information",
      found: say(lang, {
        en: `You said the unit would not sit in front of the house. There is no drawing.${height} The answer is your statement, not a reviewed plan.`,
        es: `Usted dijo que la unidad no quedaría frente a la casa. No hay un dibujo.${height} La respuesta es su declaración, no un plano revisado.`,
        ht: `Ou di inite a pa ta chita devan kay la. Pa gen desen.${height} Repons lan se sa ou di, pa yon plan yo revize.`,
      }),
      whyOpen: say(lang, { en: "A drawing that shows height and the front lot line is still missing.", es: "Todavía falta un dibujo que muestre la altura y la línea frontal.", ht: "Yon desen ki montre wotè a ak limit devan an toujou manke." }),
      searched,
      nextAction: say(lang, { en: "A designer needs a drawing that shows height and the front lot line.", es: "Un diseñador necesita un dibujo que muestre la altura y la línea frontal.", ht: "Yon designer bezwen yon desen ki montre wotè a ak limit devan an." }),
      who: "professional",
      evidence: [],
      englishNote: "",
    });
  }
  return item({
    ...base,
    status: "missing_information",
    found: say(lang, {
      en: code.frontPlacementProhibited
        ? `No placement is on file. The county page opened in this search says detached units may not be in front of the principal structure.${height}`
        : `No placement is on file.${height}`,
      es: code.frontPlacementProhibited
        ? `No hay una ubicación. La página del condado abierta en esta búsqueda dice que las unidades separadas no pueden estar frente a la estructura principal.${height}`
        : `No hay una ubicación.${height}`,
      ht: code.frontPlacementProhibited
        ? `Pa gen yon kote ki chwazi. Paj konte a ki ouvri nan rechèch sa a di inite separe pa ka devan estrikti prensipal la.${height}`
        : `Pa gen yon kote ki chwazi.${height}`,
    }),
    whyOpen: say(lang, { en: "Placement is a choice about the unit you have not drawn yet.", es: "La ubicación es una decisión sobre la unidad que todavía no está dibujada.", ht: "Kote a se yon chwa sou inite ou poko desine." }),
    searched,
    nextAction: say(lang, { en: "Say whether the unit would sit in front of the house.", es: "Diga si la unidad quedaría frente a la casa.", ht: "Di si inite a ta chita devan kay la." }),
    who: "homeowner",
    evidence: [],
    englishNote: "",
  });
}

function parkingItem(lang: Lang, parking: HomeownerAnswers["parking"], blocked: boolean, code: ResearchState["code"]): ChecklistItem {
  const published = code?.parkingRulePublished === true;
  const base = {
    id: "parking",
    requirement: say(lang, { en: "A parking space for the new unit", es: "Un espacio de estacionamiento para la unidad nueva", ht: "Yon plas pakin pou nouvo inite a" }),
    checking: say(lang, {
      en: "Whether a page opened in this search states how many spaces are required and where they may sit.",
      es: "Si una página abierta en esta búsqueda indica cuántos espacios se exigen y dónde pueden estar.",
      ht: "Si yon paj ki ouvri nan rechèch sa a di konbyen plas ki mande epi ki kote yo ka ye.",
    }),
    sourceTitle: published ? sources.aduPage.title : sources.code.title,
    sourceUrl: published ? sources.aduPage.url : code?.municodeUrl || sources.code.url,
    sourceKind: "record" as const,
    retrievedAt: code?.retrievedAt || "",
  };
  if (blocked) {
    return item({
      ...base,
      status: "not_applicable",
      found: say(lang, { en: "County parking rules were not applied.", es: "No se aplicaron las reglas de estacionamiento del condado.", ht: "Règ pakin konte a pa aplike." }),
      whyOpen: say(lang, { en: "The city rules were not retrieved.", es: "No se obtuvieron las reglas de la ciudad.", ht: "Règ vil la pa jwenn." }),
      searched: say(lang, { en: "Municipality map.", es: "Mapa de municipios.", ht: "Kat minisipalite." }),
      nextAction: say(lang, { en: "Ask the city.", es: "Pregunte a la ciudad.", ht: "Mande vil la." }),
      who: "county",
      evidence: [],
      englishNote: "",
    });
  }
  if (!code || typeof code.parkingRulePublished !== "boolean") return searching(lang, base);
  const rule = published
    ? say(lang, {
        en: "The county page opened in this search says a maximum of one additional parking space and not more than two vehicles, on the same property or in the adjacent swale.",
        es: "La página del condado abierta en esta búsqueda dice un máximo de un espacio adicional y no más de dos vehículos, en la misma propiedad o en la cuneta adyacente.",
        ht: "Paj konte a ki ouvri nan rechèch sa a di yon maksimòm yon plas siplemantè epi pa plis pase de machin, sou menm pwopriyete a oswa nan swal ki akote a.",
      })
    : say(lang, {
        en: "This search did not find a parking-space count on a page that opened. A mention of parking needs was not turned into a number.",
        es: "Esta búsqueda no encontró un número de espacios en una página que se abrió. Una mención de las necesidades de estacionamiento no se convirtió en un número.",
        ht: "Rechèch sa a pa jwenn yon kantite plas pakin nan yon paj ki te ouvri. Yon mansyon bezwen pakin pa tounen yon chif.",
      });
  if (parking === "on-site" && published) {
    return item({
      ...base,
      status: "pass",
      found: say(lang, {
        en: `You said the extra space will be on the property. ${rule} Your statement matches the on-property option. It is not an inspection, and the two-vehicle limit was not checked on site. This is not an approval.`,
        es: `Usted dijo que el espacio extra estará en la propiedad. ${rule} Su declaración coincide con la opción en la propiedad. No es una inspección, y el límite de dos vehículos no se revisó en el sitio. Esto no es una aprobación.`,
        ht: `Ou di plas siplemantè a ap sou pwopriyete a. ${rule} Sa ou di a dakò ak opsyon sou pwopriyete a. Se pa yon enspeksyon, epi limit de machin nan pa tcheke sou plas. Sa pa yon apwobasyon.`,
      }),
      whyOpen: "",
      searched: say(lang, { en: "County accessory-unit page, then your answer.", es: "Página del condado y luego su respuesta.", ht: "Paj konte a, epi repons ou." }),
      nextAction: say(lang, { en: "Show the space on a drawing before you apply.", es: "Muestre el espacio en un dibujo antes de solicitar.", ht: "Montre plas la sou yon desen anvan ou fè demann." }),
      who: "",
      evidence: [],
      englishNote: "",
    });
  }
  if (parking === "on-site") {
    return item({
      ...base,
      status: "rule_not_confirmed",
      found: say(lang, {
        en: `You said the extra space will be on the property. ${rule} That statement was not scored as a pass.`,
        es: `Usted dijo que el espacio extra estará en la propiedad. ${rule} Esa declaración no se calificó como cumplimiento.`,
        ht: `Ou di plas siplemantè a ap sou pwopriyete a. ${rule} Deklarasyon sa a pa nòte kòm yon pase.`,
      }),
      whyOpen: say(lang, { en: "A parking count was not on a page this search opened.", es: "Un número de espacios no estaba en una página que esta búsqueda abrió.", ht: "Yon kantite plas pa te nan yon paj rechèch sa a te ouvri." }),
      searched: say(lang, { en: "County accessory-unit page and the ordinance request.", es: "Página del condado y la solicitud de la ordenanza.", ht: "Paj konte a ak demann lòdonans lan." }),
      nextAction: say(lang, { en: "Ask the County how many spaces this lot needs.", es: "Pregunte al Condado cuántos espacios necesita este lote.", ht: "Mande Konte a konbyen plas lot sa a bezwen." }),
      who: "county",
      evidence: [],
      englishNote: "",
    });
  }
  if (parking === "street") {
    return item({
      ...base,
      status: "rule_not_confirmed",
      found: say(lang, {
        en: `You said the space would be on the street. ${rule} This screen did not confirm that the street in front is the adjacent swale, so street parking was not scored as a pass.`,
        es: `Usted dijo que el espacio estaría en la calle. ${rule} Esta pantalla no confirmó que la calle de enfrente sea la cuneta adyacente, así que el estacionamiento en la calle no se calificó como cumplimiento.`,
        ht: `Ou di plas la ta nan lari a. ${rule} Ekran sa a pa konfime lari devan an se swal ki akote a, kidonk pakin nan lari a pa nòte kòm yon pase.`,
      }),
      whyOpen: say(lang, { en: "The street in front was not matched to the swale the page names.", es: "La calle de enfrente no se correspondió con la cuneta que nombra la página.", ht: "Lari devan an pa matche ak swal paj la nonmen." }),
      searched: say(lang, { en: "County accessory-unit page. No street-parking map was queried.", es: "Página del condado. No se consultó un mapa de estacionamiento en la calle.", ht: "Paj konte a. Yo pa gade yon kat pakin nan lari." }),
      nextAction: say(lang, { en: "Ask the County if the street in front of this lot is an allowed swale space.", es: "Pregunte al Condado si la calle frente a este lote es un espacio de cuneta permitido.", ht: "Mande Konte a si lari devan lot sa a se yon plas swal ki pèmèt." }),
      who: "county",
      evidence: [],
      englishNote: "",
    });
  }
  return item({
    ...base,
    status: "missing_information",
    found: say(lang, {
      en: `No parking plan is on file. ${rule}`,
      es: `No hay un plan de estacionamiento. ${rule}`,
      ht: `Pa gen yon plan pakin. ${rule}`,
    }),
    whyOpen: say(lang, { en: "The space is part of the plan you have not drawn.", es: "El espacio es parte del plan que todavía no dibuja.", ht: "Plas la se yon pati nan plan ou poko desine." }),
    searched: say(lang, { en: "County accessory-unit page. No site plan was in the records.", es: "Página del condado. No había un plano en los registros.", ht: "Paj konte a. Pa te gen plan nan dosye yo." }),
    nextAction: say(lang, { en: "Say whether a space will be on the property. Not sure leaves this open.", es: "Diga si habrá un espacio en la propiedad. No estoy seguro deja esto abierto.", ht: "Di si y ap gen yon plas sou pwopriyete a. Ou pa sèten kite sa ouvè." }),
    who: "homeowner",
    evidence: [],
    englishNote: "",
  });
}

function permitItem(lang: Lang, permits: ResearchState["permits"], blocked: boolean, code: ResearchState["code"]): ChecklistItem {
  const base = {
    id: "permits",
    requirement: say(lang, { en: "Building permit and certificate of use", es: "Permiso de construcción y certificado de uso", ht: "Pèmi konstriksyon ak sètifika itilizasyon" }),
    checking: say(lang, {
      en: "The county building-permit map for this folio, this address, and this point.",
      es: "El mapa de permisos de construcción del condado para este folio, esta dirección y este punto.",
      ht: "Kat pèmi konstriksyon konte a pou folio sa a, adrès sa a, ak pwen sa a.",
    }),
    sourceTitle: "Miami-Dade County building permits map",
    sourceUrl: permits?.url || "https://gis.miamidade.gov/arcgis/rest/services/MD_LandInformation/MapServer/1",
    sourceKind: "record" as const,
  };
  if (blocked) {
    return item({
      ...base,
      status: "not_applicable",
      found: say(lang, { en: "The county permit rule was not applied.", es: "No se aplicó la regla de permisos del condado.", ht: "Règ pèmi konte a pa aplike." }),
      whyOpen: say(lang, { en: "The city issues its own permits.", es: "La ciudad emite sus propios permisos.", ht: "Vil la bay pwòp pèmi li." }),
      searched: say(lang, { en: "Municipality map.", es: "Mapa de municipios.", ht: "Kat minisipalite." }),
      nextAction: say(lang, { en: "Ask the city building department.", es: "Pregunte al departamento de construcción de la ciudad.", ht: "Mande depatman konstriksyon vil la." }),
      who: "county",
      evidence: [],
      englishNote: "",
      retrievedAt: permits?.retrievedAt || "",
    });
  }
  if (!permits) return searching(lang, base);
  if (!permits.ok) return failed(lang, base, permits.httpStatus, permits.retrievedAt);
  return item({
    ...base,
    status: "missing_information",
    found: say(lang, {
      en: `The permit map returned ${permits.folioMatches ?? 0} rows for the folio, ${permits.addressMatches ?? 0} for the site address, and ${permits.pointMatches ?? 0} at the map point. No rows is not proof that no permit exists.`,
      es: `El mapa de permisos devolvió ${permits.folioMatches ?? 0} filas para el folio, ${permits.addressMatches ?? 0} para la dirección y ${permits.pointMatches ?? 0} en el punto del mapa. Cero filas no prueba que no exista un permiso.`,
      ht: `Kat pèmi a voye ${permits.folioMatches ?? 0} ranje pou folio a, ${permits.addressMatches ?? 0} pou adrès la, ak ${permits.pointMatches ?? 0} nan pwen kat la. Zewo ranje pa pwouve pa gen pèmi.`,
    }),
    whyOpen: say(lang, {
      en: code?.permitRequiredPublished
        ? "The county page opened in this search says a building permit is required to construct or legalize a unit. This map count is not that record, and zero rows is not proof that no permit exists."
        : "This map count is not the record’s meaning, and zero rows is not proof that no permit exists. This search did not open a sentence that states the permit requirement.",
      es: code?.permitRequiredPublished
        ? "La página del condado abierta en esta búsqueda dice que se requiere un permiso de construcción para construir o legalizar una unidad. Este conteo del mapa no es ese registro, y cero filas no prueba que no exista un permiso."
        : "Este conteo del mapa no es el significado del registro, y cero filas no prueba que no exista un permiso. Esta búsqueda no abrió una frase que indique el requisito del permiso.",
      ht: code?.permitRequiredPublished
        ? "Paj konte a ki ouvri nan rechèch sa a di yon pèmi konstriksyon obligatwa pou bati oswa legalize yon inite. Konte kat sa a se pa dosye sa a, epi zewo ranje pa pwouve pa gen pèmi."
        : "Konte kat sa a se pa sans dosye a, epi zewo ranje pa pwouve pa gen pèmi. Rechèch sa a pa ouvri yon fraz ki di kondisyon pèmi a.",
    }),
    searched: say(lang, { en: "County building-permit layer by folio, site address, and map point.", es: "Capa de permisos del condado por folio, dirección y punto del mapa.", ht: "Kouch pèmi konte a pa folio, adrès, ak pwen kat." }),
    nextAction: say(lang, { en: "Ask the County building department for the permit and certificate history before you rely on this map.", es: "Pida al departamento de construcción del Condado el historial de permisos y certificados antes de confiar en este mapa.", ht: "Mande depatman konstriksyon Konte a istwa pèmi ak sètifika yo anvan ou konte sou kat sa a." }),
    who: "county",
    evidence: [],
    englishNote: "",
    retrievedAt: permits.retrievedAt,
  });
}

function occupancyItem(lang: Lang, blocked: boolean, answers: HomeownerAnswers | undefined, code: ResearchState["code"]): ChecklistItem {
  if (!blocked && (!code || typeof code.occupancyLimitPublished !== "boolean")) {
    return searching(lang, {
      id: "occupancy",
      requirement: say(lang, { en: "Who will stay overnight", es: "Quién pasará la noche", ht: "Kimoun ki pral pase nwit la" }),
      checking: say(lang, {
        en: "Whether a page opened in this search states an overnight limit.",
        es: "Si una página abierta en esta búsqueda indica un límite nocturno.",
        ht: "Si yon paj ki ouvri nan rechèch sa a di yon limit pou nwit la.",
      }),
      sourceTitle: sources.aduPage.title,
      sourceUrl: sources.aduPage.url,
      sourceKind: "record",
    });
  }
  const limit = code?.occupancyLimitPublished
    ? say(lang, {
        en: "The county page opened in this search states a maximum of two persons per bedroom, excluding children under 3.",
        es: "La página del condado abierta en esta búsqueda indica un máximo de dos personas por habitación, sin contar a los niños menores de 3 años.",
        ht: "Paj konte a ki ouvri nan rechèch sa a di yon maksimòm de moun pou chak chanm, san konte timoun ki gen mwens pase 3 an.",
      })
    : say(lang, {
        en: "This search did not find an overnight limit on a page that opened.",
        es: "Esta búsqueda no encontró un límite nocturno en una página que se abrió.",
        ht: "Rechèch sa a pa jwenn yon limit nwit nan yon paj ki te ouvri.",
      });
  return item({
    id: "occupancy",
    requirement: say(lang, { en: "Who will stay overnight", es: "Quién pasará la noche", ht: "Kimoun ki pral pase nwit la" }),
    checking: say(lang, {
      en: "The opened county limit on overnight occupancy. The records do not say who will live here.",
      es: "El límite del condado ya abierto sobre la ocupación nocturna. Los registros no dicen quién vivirá aquí.",
      ht: "Limit konte a ki deja ouvri sou konbyen moun ki ka pase nwit la. Dosye yo pa di kimoun ki pral rete la.",
    }),
    status: blocked ? "not_applicable" : "missing_information",
    found: say(lang, {
      en: blocked
        ? "County occupancy rules were not applied."
        : answers?.bedroomsUnsure
          ? `You marked the bedroom count as not sure. ${limit} The number of people was not stated, so this was not scored as a pass.`
          : answers?.bedrooms != null
            ? `You said ${answers.bedrooms} bedrooms. ${limit} The number of people was not stated, so the bedroom count is not a pass.`
            : `No bedroom plan is on file. ${limit} Public records do not say who will stay.`,
      es: blocked
        ? "No se aplicaron las reglas de ocupación del condado."
        : answers?.bedroomsUnsure
          ? `Marcó el número de habitaciones como no seguro. ${limit} No se dijo cuántas personas, así que esto no se calificó como cumplimiento.`
          : answers?.bedrooms != null
            ? `Usted indicó ${answers.bedrooms} habitaciones. ${limit} No se dijo cuántas personas, así que el número de habitaciones no es un cumplimiento.`
            : `No hay un plan de habitaciones. ${limit} Los registros públicos no dicen quién se quedará.`,
      ht: blocked
        ? "Règ okipasyon konte a pa aplike."
        : answers?.bedroomsUnsure
          ? `Ou make kantite chanm nan kòm ou pa sèten. ${limit} Yo pa di konbyen moun, kidonk sa pa nòte kòm yon pase.`
          : answers?.bedrooms != null
            ? `Ou di ${answers.bedrooms} chanm. ${limit} Yo pa di konbyen moun, kidonk kantite chanm nan pa yon pase.`
            : `Pa gen yon plan chanm. ${limit} Dosye piblik yo pa di kimoun ki pral rete.`,
    }),
    whyOpen: say(lang, { en: "Who lives there is not in the public property record.", es: "Quién vive allí no está en el registro público de la propiedad.", ht: "Kimoun ki rete la pa nan dosye piblik pwopriyete a." }),
    searched: say(lang, { en: "Property and map records. They do not list future occupants.", es: "Registros de la propiedad y mapas. No listan ocupantes futuros.", ht: "Dosye pwopriyete ak kat. Yo pa bay moun ki pral rete la pita." }),
    nextAction: say(lang, { en: "Decide who will live in each unit before you apply. The County reviews that at application.", es: "Decida quién vivirá en cada unidad antes de solicitar. El Condado lo revisa en la solicitud.", ht: "Deside kimoun ki pral rete nan chak inite anvan ou fè demann. Konte a gade sa lè w ap fè demann nan." }),
    who: "homeowner",
    evidence: [],
    englishNote: "",
    sourceTitle: sources.aduPage.title,
    sourceUrl: sources.aduPage.url,
    retrievedAt: code?.retrievedAt || "",
    sourceKind: "record",
  });
}

function saleItem(lang: Lang, code: ResearchState["code"], blocked: boolean): ChecklistItem {
  const base = {
    id: "sale-and-rental",
    requirement: say(lang, { en: "Selling or renting the unit separately", es: "Vender o alquilar la unidad por separado", ht: "Vann oswa lwe inite a apa" }),
    checking: say(lang, {
      en: "The opened county rule against a separate sale, and the rental limits. Section 33-28 was requested again.",
      es: "La regla del condado ya abierta contra una venta separada, y los límites de alquiler. Se volvió a pedir la sección 33-28.",
      ht: "Règ konte a ki deja ouvri kont yon vant separe, ak limit lwaye yo. Yo mande seksyon 33-28 ankò.",
    }),
    sourceTitle: code?.separateSalePublished ? sources.aduPage.title : sources.code.title,
    sourceUrl: code?.separateSalePublished ? sources.aduPage.url : code?.section28Url || sources.code.url,
    sourceKind: "record" as const,
  };
  if (blocked) {
    return item({
      ...base,
      status: "not_applicable",
      found: say(lang, { en: "County rental rules were not applied.", es: "No se aplicaron las reglas de alquiler del condado.", ht: "Règ lwaye konte a pa aplike." }),
      whyOpen: say(lang, { en: "The city rules were not retrieved.", es: "No se obtuvieron las reglas de la ciudad.", ht: "Règ vil la pa jwenn." }),
      searched: say(lang, { en: "Municipality map.", es: "Mapa de municipios.", ht: "Kat minisipalite." }),
      nextAction: say(lang, { en: "Ask the city.", es: "Pregunte a la ciudad.", ht: "Mande vil la." }),
      who: "county",
      evidence: [],
      englishNote: "",
      retrievedAt: code?.retrievedAt || "",
    });
  }
  if (!code) return searching(lang, base);
  return item({
    ...base,
    status: "missing_information",
    found: say(lang, {
      en: code.separateSalePublished
        ? `The county page opened in this search says an accessory unit cannot be sold independently of the principal building. A request for ordinance § 33-28 returned HTTP ${code.section28Status ?? "no response"}, so that section was not opened. Your sale or rental plan is not on file, so this was not scored as a pass.`
        : `A separate sale was not confirmed. The ordinance request returned HTTP ${code.municodeStatus ?? "no response"}, and § 33-28 returned HTTP ${code.section28Status ?? "no response"}. Your plan is not on file.`,
      es: code.separateSalePublished
        ? `La página del condado abierta en esta búsqueda dice que una unidad accesoria no puede venderse independientemente del edificio principal. Una solicitud de la ordenanza § 33-28 devolvió HTTP ${code.section28Status ?? "sin respuesta"}, así que esa sección no se abrió. Su plan de venta o alquiler no está en el expediente, así que esto no se calificó como cumplimiento.`
        : `No se confirmó una venta separada. La solicitud de la ordenanza devolvió HTTP ${code.municodeStatus ?? "sin respuesta"}, y la § 33-28 devolvió HTTP ${code.section28Status ?? "sin respuesta"}. Su plan no está en el expediente.`,
      ht: code.separateSalePublished
        ? `Paj konte a ki ouvri nan rechèch sa a di yon inite akseswa pa ka vann apa de bilding prensipal la. Yon demann pou lòdonans § 33-28 voye HTTP ${code.section28Status ?? "pa gen repons"}, kidonk seksyon sa a pa ouvri. Plan vant oswa lwaye ou a pa nan dosye a, kidonk sa pa nòte kòm yon pase.`
        : `Yon vant separe pa konfime. Demann lòdonans lan voye HTTP ${code.municodeStatus ?? "pa gen repons"}, epi § 33-28 voye HTTP ${code.section28Status ?? "pa gen repons"}. Plan ou a pa nan dosye a.`,
    }),
    whyOpen: say(lang, {
      en: code.separateSalePublished ? "The page states a limit on a separate sale. It does not say what you plan to do." : "A separate-sale sentence was not found on a page this search opened.",
      es: code.separateSalePublished ? "La página indica un límite para una venta separada. No dice qué planea hacer." : "No se encontró una frase sobre la venta separada en una página que esta búsqueda abrió.",
      ht: code.separateSalePublished ? "Paj la di yon limit sou yon vant separe. Li pa di sa ou planifye fè." : "Yo pa jwenn yon fraz sou vant separe nan yon paj rechèch sa a te ouvri.",
    }),
    searched: say(lang, {
      en: `County accessory-unit page and a request for § 33-28 (HTTP ${code.section28Status ?? "no response"}).`,
      es: `Página del condado y una solicitud de la § 33-28 (HTTP ${code.section28Status ?? "sin respuesta"}).`,
      ht: `Paj konte a ak yon demann pou § 33-28 (HTTP ${code.section28Status ?? "pa gen repons"}).`,
    }),
    nextAction: say(lang, { en: "Tell the County, when you apply, the rental term you intend. Do not plan a separate sale.", es: "Diga al Condado, cuando solicite, el plazo de alquiler que pretende. No planee una venta separada.", ht: "Di Konte a, lè w ap fè demann, konbyen tan ou vle lwe a. Pa planifye yon vant separe." }),
    who: "homeowner",
    evidence: [],
    englishNote: "",
    retrievedAt: code.retrievedAt,
  });
}

function hoaItem(lang: Lang, code: ResearchState["code"]): ChecklistItem {
  const base = {
    id: "private-restrictions",
    requirement: say(lang, { en: "Association rules and deed limits", es: "Reglas de la asociación y límites de la escritura", ht: "Règ asosyasyon an ak limit nan akt la" }),
    checking: say(lang, {
      en: "Whether a public record this screen can open states an association or a deed restriction for this folio.",
      es: "Si un registro público que esta pantalla puede abrir indica una asociación o una restricción de escritura para este folio.",
      ht: "Si yon dosye piblik ekran sa a ka ouvri di gen yon asosyasyon oswa yon restriksyon akt pou folio sa a.",
    }),
    sourceTitle: code?.hoaNoticePublished ? sources.aduPage.title : sources.code.title,
    sourceUrl: code?.hoaNoticePublished ? sources.aduPage.url : sources.code.url,
    sourceKind: "record" as const,
  };
  if (!code || typeof code.hoaNoticePublished !== "boolean") return searching(lang, base);
  return item({
    ...base,
    status: "missing_information",
    found: say(lang, {
      en: code.hoaNoticePublished
        ? "The county page opened in this search says homes that belong to a community association need proof of notification. No deed book was opened, and no association document for this folio was retrieved. The owner's deed and association documents are required."
        : "No association document or deed restriction was in the maps this screen queried. No deed book was opened. The owner's deed and association documents are required.",
      es: code.hoaNoticePublished
        ? "La página del condado abierta en esta búsqueda dice que las viviendas que pertenecen a una asociación necesitan prueba de notificación. No se abrió un libro de escrituras y no se obtuvo un documento de asociación para este folio. Se requieren la escritura y los documentos de la asociación del propietario."
        : "No había un documento de asociación ni una restricción de escritura en los mapas consultados. No se abrió un libro de escrituras. Se requieren la escritura y los documentos de la asociación del propietario.",
      ht: code.hoaNoticePublished
        ? "Paj konte a ki ouvri nan rechèch sa a di kay ki nan yon asosyasyon bezwen prèv yo te notifye. Yo pa ouvri yon liv akt, epi yo pa jwenn yon dokiman asosyasyon pou folio sa a. Akt pwopriyetè a ak dokiman asosyasyon an obligatwa."
        : "Pa te gen dokiman asosyasyon oswa restriksyon akt nan kat yo. Yo pa ouvri yon liv akt. Akt pwopriyetè a ak dokiman asosyasyon an obligatwa.",
    }),
    whyOpen: say(lang, { en: "A county page can state the notice rule. It cannot say whether this lot has an association.", es: "Una página del condado puede indicar la regla de aviso. No puede decir si este lote tiene una asociación.", ht: "Yon paj konte ka di règ notifikasyon an. Li pa ka di si lot sa a gen yon asosyasyon." }),
    searched: say(lang, { en: "Zoning, land-use, hearing, and plat layers, plus the county accessory-unit page. No deed book was queried.", es: "Capas de zonificación, uso del suelo, audiencias y planos, y la página del condado. No se consultó el libro de escrituras.", ht: "Kouch zonaj, itilizasyon tè, odyans, ak plan, ansanm ak paj konte a. Yo pa gade liv akt yo." }),
    nextAction: say(lang, { en: "Read your deed and any association rules. They can be stricter than the County.", es: "Lea su escritura y las reglas de la asociación. Pueden ser más estrictas que el Condado.", ht: "Li akt ou ak règ asosyasyon an. Yo ka pi sevè pase Konte a." }),
    who: "homeowner",
    evidence: [],
    englishNote: "",
    retrievedAt: code.retrievedAt,
  });
}

function statuteItem(lang: Lang, code: ResearchState["code"]): ChecklistItem {
  const base = {
    id: "state-statute",
    requirement: say(lang, { en: "The Florida accessory-unit statute", es: "La ley de Florida sobre unidades accesorias", ht: "Lwa Florid sou inite akseswa" }),
    checking: say(lang, {
      en: "The state statute page, including the affordable-rent affidavit it describes for a building-permit application.",
      es: "La página del estatuto estatal, incluida la declaración de renta asequible que describe para una solicitud de permiso.",
      ht: "Paj lwa eta a, ansanm ak deklarasyon lwaye abòdab li dekri pou yon demann pèmi.",
    }),
    sourceTitle: sources.statute.title,
    sourceUrl: sources.statute.url,
    sourceKind: "record" as const,
  };
  if (!code) return searching(lang, base);
  return item({
    ...base,
    status: "rule_not_confirmed",
    found: say(lang, {
      en: code.statuteAffidavit
        ? "Whether Miami-Dade requires the affordable-rent affidavit on this application was not confirmed. The statute page opened in this search and describes that affidavit for a building-permit application. The statute does not approve this lot."
        : "Whether Miami-Dade requires an affordable-rent affidavit on this application was not confirmed. The statute page did not yield that sentence in this search.",
      es: code.statuteAffidavit
        ? "No se confirmó si Miami-Dade exige la declaración de renta asequible en esta solicitud. La página del estatuto abrió en esta búsqueda y describe esa declaración para un permiso de construcción. El estatuto no aprueba este lote."
        : "No se confirmó si Miami-Dade exige una declaración de renta asequible en esta solicitud. La página del estatuto no dio esa frase en esta búsqueda.",
      ht: code.statuteAffidavit
        ? "Yo pa konfime si Miami-Dade mande deklarasyon lwaye abòdab la pou demann sa a. Paj lwa a ouvri nan rechèch sa a epi li dekri deklarasyon an pou yon pèmi konstriksyon. Lwa a pa apwouve teren sa a."
        : "Yo pa konfime si Miami-Dade mande yon deklarasyon lwaye abòdab pou demann sa a. Paj lwa a pa bay fraz sa a nan rechèch sa a.",
    }),
    whyOpen: say(lang, { en: "Local practice on the affidavit is not in the statute page.", es: "La práctica local sobre la declaración no está en la página del estatuto.", ht: "Fason lokal yo itilize deklarasyon an pa nan paj lwa a." }),
    searched: say(lang, { en: "Florida Senate statute page, requested again today.", es: "Página del estatuto del Senado de Florida, solicitada de nuevo hoy.", ht: "Paj lwa Sena Florid la, yo mande l ankò jodi a." }),
    nextAction: say(lang, { en: "Ask the County, when you apply, whether the affidavit is required.", es: "Pregunte al Condado, cuando solicite, si la declaración es obligatoria.", ht: "Mande Konte a, lè w ap fè demann, si deklarasyon an obligatwa." }),
    who: "county",
    evidence: [],
    englishNote: "",
    retrievedAt: code.retrievedAt,
  });
}

function searching(lang: Lang, base: Pick<ChecklistItem, "id" | "requirement" | "checking" | "sourceTitle" | "sourceUrl" | "sourceKind">): ChecklistItem {
  return item({
    ...base,
    status: "searching",
    found: say(lang, { en: "Searching public records now.", es: "Buscando registros públicos ahora.", ht: "Ap chèche dosye piblik kounye a." }),
    whyOpen: "",
    searched: "",
    nextAction: "",
    who: "app",
    evidence: [],
    englishNote: "",
    retrievedAt: "",
  });
}

function failed(
  lang: Lang,
  base: Pick<ChecklistItem, "id" | "requirement" | "checking" | "sourceTitle" | "sourceUrl" | "sourceKind">,
  httpStatus: number | null,
  retrievedAt: string,
): ChecklistItem {
  return item({
    ...base,
    status: "missing_information",
    researchStatus: "blocked",
    found: say(lang, {
      en: `Nothing from that source was used. The search failed${httpStatus ? ` (HTTP ${httpStatus})` : ""}.`,
      es: `No se usó nada de esa fuente. La búsqueda falló${httpStatus ? ` (HTTP ${httpStatus})` : ""}.`,
      ht: `Pa gen anyen nan sous sa a ki te itilize. Rechèch la echwe${httpStatus ? ` (HTTP ${httpStatus})` : ""}.`,
    }),
    whyOpen: say(lang, { en: "The source did not return a usable record.", es: "La fuente no devolvió un registro utilizable.", ht: "Sous la pa voye yon dosye ki itil." }),
    searched: base.sourceTitle,
    nextAction: say(lang, { en: "Try this search again later, or ask the County for the same record.", es: "Intente esta búsqueda más tarde, o pida al Condado el mismo registro.", ht: "Eseye rechèch sa a pita, oswa mande Konte a menm dosye a." }),
    who: "county",
    evidence: [],
    englishNote: "",
    retrievedAt,
  });
}

function factsTime(code: ResearchState["code"] | undefined): string {
  return code?.retrievedAt ?? "";
}

export function sectionItems(items: ChecklistItem[], section: "found" | "promising" | "problems" | "unknown" | "next") {
  if (section === "promising") return items.filter((entry) => entry.status === "pass");
  if (section === "problems") return items.filter((entry) => entry.status === "potential_issue");
  if (section === "unknown") return items.filter((entry) => entry.status === "missing_information" || entry.status === "rule_not_confirmed" || entry.status === "outside_review");
  if (section === "next") return items.filter((entry) => entry.nextAction);
  return items.filter((entry) => entry.status !== "searching");
}
