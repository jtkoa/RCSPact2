import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ReportView } from "../components/ReportView";
import { ScreenTabs } from "../components/ScreenTabs";
import type { Screening } from "../engine/types";
import { useI18n } from "../i18n/LanguageProvider";
import { downloadFile, reportHtml, reportText } from "../services/reportFile";
import { loadScreening } from "../services/screening";
import { usePropertyResearch } from "../components/usePropertyResearch";

export function ReportPage() {
  const { id = "" } = useParams();
  const { lang, t } = useI18n();
  const [screening, setScreening] = useState<Screening | null>(() => loadScreening(id));
  usePropertyResearch(screening, setScreening);
  if (!screening || screening.status !== "ready") {
    return (
      <div className="notice notice-stop">
        <h1>{t("report.noneTitle")}</h1>
        <p>{t("report.noneBody")}</p>
        <Link className="btn" to="/">
          {t("prop.back")}
        </Link>
      </div>
    );
  }
  const slug = screening.facts.parcel?.folio ?? screening.id.slice(0, 8);
  return (
    <>
      <div className="no-print">
        <ScreenTabs id={screening.id} />
        <div className="action-row">
          <button className="btn" type="button" onClick={() => window.print()}>
            {t("report.print")}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => downloadFile(`rcsp-${slug}.html`, reportHtml(screening, lang), "text/html")}>
            {t("report.html")}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => downloadFile(`rcsp-${slug}.txt`, reportText(screening, lang), "text/plain")}>
            {t("report.text")}
          </button>
        </div>
      </div>
      <ReportView screening={screening} />
    </>
  );
}
