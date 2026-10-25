import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Dashboard } from "../components/Dashboard";
import { MapPanel } from "../components/MapPanel";
import { samples } from "../data/samples";
import type { LookupErrorCode, Screening } from "../engine/types";
import { formatFolio } from "../engine/text";
import { useI18n } from "../i18n/LanguageProvider";
import type { MessageKey } from "../i18n/messages";
import { beginScreening, loadScreening, selectParcel } from "../services/screening";

const errorKeys: Record<LookupErrorCode, { title: MessageKey; body: MessageKey }> = {
  unavailable: { title: "error.unavailable.title", body: "error.unavailable.body" },
  "not-found": { title: "error.not-found.title", body: "error.not-found.body" },
  broad: { title: "error.broad.title", body: "error.broad.body" },
  "county-unknown": { title: "error.county-unknown.title", body: "error.county-unknown.body" },
  unconfirmed: { title: "error.unconfirmed.title", body: "error.unconfirmed.body" },
};

export function PropertyPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [screening, setScreening] = useState<Screening | null>(() => loadScreening(id));
  const [picking, setPicking] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const lookupError = screening?.errorDetail ?? "";
  const gisWarning = screening?.facts.gisErrors.join("; ") ?? "";
  useEffect(() => {
    if (lookupError) console.error("rcsp-lookup", screening?.errorCode ?? "error", lookupError);
    if (gisWarning) console.warn("rcsp-gis", gisWarning);
  }, [gisWarning, lookupError, screening?.errorCode]);

  if (!screening) {
    return (
      <div className="notice notice-stop">
        <h1>{t("prop.missingTitle")}</h1>
        <p>{t("prop.missingBody")}</p>
        <Link className="btn" to="/">
          {t("prop.back")}
        </Link>
      </div>
    );
  }

  const { facts } = screening;

  async function choose(folio: string) {
    const choice = screening?.choices?.find((item) => item.parcel.folio === folio);
    if (!choice || !screening) return;
    setPicking(folio);
    try {
      const next = await selectParcel(screening, choice.parcel);
      setScreening(next);
    } finally {
      setPicking(null);
    }
  }

  async function retry() {
    if (!screening) return;
    setRetrying(true);
    try {
      const next = await beginScreening({
        query: screening.facts.query,
        origin: screening.facts.origin,
        sampleId: screening.facts.sampleId,
      });
      navigate(`/property/${next.id}`);
    } catch (cause) {
      console.error("rcsp-lookup", cause instanceof Error ? cause.message : "unavailable");
    } finally {
      setRetrying(false);
    }
  }

  if (screening.status === "ready") {
    return (
      <>
        {facts.gisErrors.length > 0 && facts.dataOrigin === "live" && (
          <div className="notice notice-warn" role="status">
            <h2>{t("prop.partialTitle")}</h2>
            <p>{t("prop.partialBody")}</p>
            <button className="btn btn-ghost" type="button" disabled={retrying} onClick={() => void retry()}>
              {retrying ? t("home.busy") : t("prop.retry")}
            </button>
          </div>
        )}
        {screening.fallbackFacts && (
          <div className="notice notice-warn" role="status">
            <h2>{t("prop.snapshotTitle")}</h2>
            <p>{t("prop.snapshotBody")}</p>
          </div>
        )}
        <Dashboard screening={screening} onChange={setScreening} />
      </>
    );
  }

  return (
    <>
      <section className="intro">
        <h1>{facts.query}</h1>
      </section>
      {screening.status === "error" && (
        <ErrorNotice screening={screening} retrying={retrying} onRetry={() => void retry()} />
      )}
      {screening.status === "outside" && (
        <div className="notice notice-stop" role="status">
          <h2>{t("prop.outsideTitle")}</h2>
          <p>{t("prop.outsideBody")}</p>
          {facts.geocode && (
            <ul>
              <li>{facts.geocode.displayName}</li>
              <li>
                {t("prop.county")}: {facts.geocode.county ?? t("prop.notNamed")}
                {facts.geocode.state ? `, ${facts.geocode.state}` : ""}
              </li>
            </ul>
          )}
          <SampleLinks />
        </div>
      )}
      {screening.choices && screening.choices.length > 0 && (
        <div className="notice" role="status">
          <h2>{t("prop.chooseTitle")}</h2>
          <p>{facts.parcelNote ?? t("prop.chooseBody")}</p>
          <ul className="choice-list">
            {screening.choices.map((choice) => (
              <li key={`${choice.parcel.folio}-${choice.parcel.siteAddress}`}>
                <button className="btn btn-ghost" type="button" disabled={picking != null} onClick={() => void choose(choice.parcel.folio)}>
                  {picking === choice.parcel.folio ? t("prop.loading") : choice.parcel.siteAddress}
                </button>
                <span className="fine">
                  {t("fact.folio")} {formatFolio(choice.parcel.folio)}
                  {choice.parcel.siteCity ? ` · ${choice.parcel.siteCity}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {screening.status === "outside" && facts.geocode && <MapPanel facts={facts} />}
      <p>
        <Link className="btn btn-ghost" to="/">
          {t("prop.back")}
        </Link>
      </p>
    </>
  );
}

function ErrorNotice({ screening, retrying, onRetry }: { screening: Screening; retrying: boolean; onRetry: () => void }) {
  const { t } = useI18n();
  const keys = screening.errorCode ? errorKeys[screening.errorCode] : null;
  return (
    <div className="notice notice-stop" role="status">
      <h2>{keys ? t(keys.title) : t("error.unavailable.title")}</h2>
      <p>{keys ? t(keys.body) : t("error.unavailable.body")}</p>
      <button className="btn" type="button" disabled={retrying} onClick={onRetry}>
        {retrying ? t("home.busy") : t("prop.retry")}
      </button>
      <SampleLinks />
    </div>
  );
}

function SampleLinks() {
  const { t } = useI18n();
  return (
    <div className="sample-links">
      <p>{t("prop.examples")}:</p>
      <ul>
        {samples.map((sample) => (
          <li key={sample.id}>
            <Link to="/#samples">{sample.address}</Link>
            <span>
              {" "}
              — {t("home.folio")} {formatFolio(sample.folio)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
