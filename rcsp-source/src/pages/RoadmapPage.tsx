import { useI18n } from "../i18n/LanguageProvider";

const items: Array<{ state: "Operational" | "Planned"; title: string; detail: string }> = [
  {
    state: "Operational",
    title: "Address search",
    detail: "Miami-Dade GeoProperty validates one address or returns none. The parcel layer lists multiple site addresses when GeoProperty does not standardize the text. Nominatim is used only after a miss, to tell an out-of-county place from a failed search.",
  },
  {
    state: "Operational",
    title: "Two checked example addresses",
    detail: "4300 SW 94 AVE and 5401 SW 102 AVE were confirmed with GeoProperty before they were listed. Opening one runs the lookup again. An October 25, 2026 snapshot appears only if the live service fails, and it is labeled separately and not scored.",
  },
  {
    state: "Operational",
    title: "Property overview and map",
    detail: "County parcel polygon when GIS returns one, OpenStreetMap tiles when they load, and a non-cadastral schematic when tiles fail.",
  },
  {
    state: "Operational",
    title: "Preliminary feasibility assessment",
    detail: "Jurisdiction, urban development boundary, zoning, lot area, floor area, dimensions, setbacks, parking, occupancy, permits, sale and rental, the principal dwelling, private restrictions, design, and the state statute.",
  },
  {
    state: "Operational",
    title: "Report",
    detail: "Passed checks, flags, unverified items, sources, and next steps. Print styles, plus an HTML file and a text file generated in the browser.",
  },
  {
    state: "Operational",
    title: "Resources",
    detail: "County, state, and federal pages that were opened for this build. No invented firm names.",
  },
  {
    state: "Planned",
    title: "Builder marketplace",
    detail: "A future list of builders a homeowner could contact after a screen. Not built. No builders are listed.",
  },
  {
    state: "Planned",
    title: "Landlord-guarantee pilot",
    detail: "A future pilot idea for a guarantee tied to an accessory-unit rental. Not operating. This app does not enroll landlords or hold funds.",
  },
  {
    state: "Planned",
    title: "Municipal code coverage",
    detail: "City zoning for Miami, Miami Beach, and the other municipalities. Today a city address is flagged as outside the unincorporated ordinance and is not scored under a city code.",
  },
  {
    state: "Planned",
    title: "Permit history and survey upload",
    detail: "Reading certificate-of-use records, and letting an owner attach a survey so setbacks could be checked. Not connected.",
  },
];

export function RoadmapPage() {
  const { t } = useI18n();
  return (
    <>
      <p className="fine">{t("roadmap.english")}</p>
      <p className="eyebrow">Roadmap</p>
      <h1>What is running, and what is only planned</h1>
      <p className="lede">
        Operational means you can do it in this app today. Planned means it is not built. The landlord-guarantee
        pilot and the builder marketplace are planned only.
      </p>
      <ul className="roadmap">
        {items.map((item) => (
          <li key={item.title}>
            <span className={item.state === "Operational" ? "state state-live" : "state state-planned"}>{item.state}</span>
            <h2>{item.title}</h2>
            <p>{item.detail}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
