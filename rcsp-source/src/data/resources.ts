export interface ResourceLink {
  href: string;
  title: string;
  detail: string;
}

export const planningLinks: ResourceLink[] = [
  {
    href: "https://www.miamidade.gov/global/economy/building/accessory-dwelling-unit-adu.page",
    title: "County page: Accessory Dwelling Units or Guesthouses",
    detail:
      "Miami-Dade's public summary of accessory units and guesthouses, including the published 7,500 square foot lot figure and a pointer to County Code § 33-22. Retrieved October 25, 2026.",
  },
  {
    href: "https://library.municode.com/fl/miami_-_dade_county/codes/code_of_ordinances?nodeId=PTIIICOOR_CH33ZO_ARTIINGE_S33-22ACUN",
    title: "County Code § 33-22, Accessory units",
    detail:
      "Municode display of the accessory-unit section. The library itself warns that the posting may not be the latest ordinance. Retrieved October 25, 2026.",
  },
  {
    href: "https://www.flsenate.gov/Laws/Statutes/2026/163.31771",
    title: "Florida Statutes § 163.31771",
    detail:
      "2026 Florida Senate display of the state accessory dwelling unit statute. It does not replace local zoning.",
  },
  {
    href: "https://www.miamidade.gov/global/economy/building/accessory-dwelling-unit-blueprint-for-homeowners.page",
    title: "ADU Blueprint for Homeowners",
    detail:
      "County page for the pre-approved blueprint program mentioned on the accessory-unit page. This screen does not review blueprint eligibility.",
  },
  {
    href: "https://experience.arcgis.com/experience/93d3329d0c5d4337947622c55dc81a6f",
    title: "Miami-Dade Land Management application",
    detail:
      "The county Land Management redirect (gisweb.miamidade.gov/LandManagement/) sends visitors to this application. The county ADU page tells owners to use Land Management to look up a zoning district.",
  },
  {
    href: "https://www.miamidadepa.gov/pa/real-estate/property-search.page",
    title: "Property Appraiser property search",
    detail:
      "Office of the Property Appraiser search by address, owner, folio, or subdivision. Use it to compare the GIS area with the assessment record. This screen does not log into that search.",
  },
];

export const professionalLinks: ResourceLink[] = [
  {
    href: "https://www.myfloridalicense.com/wl11.asp",
    title: "Florida DBPR license search",
    detail:
      "Department of Business and Professional Regulation lookup for licensed individuals and businesses, including architects. Search by name, license number, city, or license type. No firm is recommended here.",
  },
  {
    href: "https://fbpe.org/",
    title: "Florida Board of Professional Engineers",
    detail:
      "Board site for professional engineers. License lookup is directed to MyFloridaLicense. No engineer is recommended here.",
  },
  {
    href: "https://www.miamidade.gov/global/economy/building/home.page",
    title: "Miami-Dade building department",
    detail:
      "County building homepage. Permitting questions, including expediting a county application, belong with Regulatory and Economic Resources rather than a private firm named by this screen.",
  },
  {
    href: "https://www.miamidade.gov/Apps/RER/EPSPortal/PlanReview/CUApplications/Menu",
    title: "Certificate of Use applications",
    detail:
      "County portal. The menu includes an Accessory Dwelling Unit Certificate of Use for establishing, converting, expanding, or altering an ADU or guesthouse. An account is required to file. This screen does not file one.",
  },
];

export const financingLinks: ResourceLink[] = [
  {
    href: "https://www.floridahousing.org/",
    title: "Florida Housing Finance Corporation",
    detail:
      "The state housing finance agency. Its site describes affordable-housing programs. This screen did not confirm an accessory-unit construction loan for a homeowner.",
  },
  {
    href: "https://www.floridahousing.org/programs/homebuyer-overview-page",
    title: "Florida Housing homebuyer overview",
    detail:
      "The agency's homebuyer page. It is not a determination that any buyer program covers an accessory unit.",
  },
  {
    href: "https://www.hud.gov/program_offices/housing/sfh/203k/203k--df",
    title: "HUD 203(k) rehabilitation mortgage insurance",
    detail:
      "HUD's page for 203(k) rehabilitation mortgage insurance. It is a federal mortgage-insurance program, not a Miami-Dade accessory-unit approval and not a promise that a lender will finance a particular cottage.",
  },
  {
    href: "https://www.miamidade.gov/global/housing/home.page",
    title: "Miami-Dade Housing and Community Development",
    detail:
      "County housing department homepage. Program names were not copied because this screen did not open a specific accessory-unit subsidy page.",
  },
];
