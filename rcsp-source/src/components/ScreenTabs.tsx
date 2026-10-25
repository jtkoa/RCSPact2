import { Link, useLocation } from "react-router-dom";
import { useI18n } from "../i18n/LanguageProvider";

export function ScreenTabs({ id }: { id: string }) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const report = pathname.endsWith("/report");
  return (
    <nav className="screen-tabs" aria-label={t("tab.label")}>
      <Link to={`/property/${id}`} aria-current={report ? undefined : "page"}>
        {t("tab.assessment")}
      </Link>
      <Link to={`/property/${id}/report`} aria-current={report ? "page" : undefined}>
        {t("tab.report")}
      </Link>
    </nav>
  );
}
