import { Link, Navigate, useParams } from "react-router-dom";
import { useI18n } from "../i18n/LanguageProvider";
import { loadScreening } from "../services/screening";

export function AssessmentPage() {
  const { id = "" } = useParams();
  const { t } = useI18n();
  const screening = loadScreening(id);
  if (!screening) {
    return (
      <div className="notice notice-stop">
        <h1>{t("assess.missingTitle")}</h1>
        <p>{t("assess.missingBody")}</p>
        <Link className="btn" to="/">
          {t("prop.back")}
        </Link>
      </div>
    );
  }
  return <Navigate to={`/property/${screening.id}`} replace />;
}
