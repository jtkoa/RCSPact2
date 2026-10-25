import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { propertySearchUrl, samples } from "../data/samples";
import { formatFolio } from "../engine/text";
import { useI18n } from "../i18n/LanguageProvider";
import { beginScreening } from "../services/screening";

export function HomePage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(address: string, origin: "search" | "sample", sampleId?: string) {
    setBusy(true);
    setError(null);
    try {
      const screening = await beginScreening({ query: address, origin, sampleId });
      navigate(`/property/${screening.id}`);
    } catch (cause) {
      console.error("rcsp-lookup", cause instanceof Error ? cause.message : "unavailable");
      setError(t("error.unavailable.body"));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setError(t("home.empty"));
      return;
    }
    void run(trimmed, "search");
  }

  return (
    <>
      <section className="intro">
        <h1>{t("home.title")}</h1>
        <p>{t("home.lede")}</p>
        <p className="note">{t("home.disclaimer")}</p>
      </section>

      <section className="panel search-card" aria-labelledby="search-heading">
        <h2 id="search-heading">{t("home.searchTitle")}</h2>
        <form onSubmit={onSubmit}>
          <label htmlFor="address">{t("home.addressLabel")}</label>
          <div className="search-row">
            <input
              id="address"
              name="address"
              type="text"
              value={query}
              autoComplete="street-address"
              placeholder={t("home.placeholder")}
              onChange={(event) => setQuery(event.target.value)}
              disabled={busy}
            />
            <button className="btn" type="submit" disabled={busy}>
              {busy ? t("home.busy") : t("home.submit")}
            </button>
          </div>
        </form>
        {busy && (
          <p className="searching-line" role="status">
            {t("home.busy")}
          </p>
        )}
        {error && (
          <div className="notice notice-stop" role="status">
            <p>{error}</p>
          </div>
        )}
        <p className="fine">
          <button className="text-button" type="button" disabled={busy} onClick={() => void run("1 E Broward Blvd, Fort Lauderdale, FL", "search")}>
            {t("home.outsideButton")}
          </button>
        </p>
      </section>

      <section id="samples" aria-labelledby="sample-heading">
        <h2 id="sample-heading">{t("home.examplesTitle")}</h2>
        <p className="fine">{t("home.examplesNote")}</p>
        <div className="cards">
          {samples.map((sample) => (
            <article key={sample.id} className="card">
              <h3>{sample.address}</h3>
              <p>
                {t("home.folio")}: {formatFolio(sample.folio)}
              </p>
              <p>
                <a href={propertySearchUrl}>{t("home.recordLink")}</a>
              </p>
              <details>
                <summary>{t("dash.details")}</summary>
                <p>{t(sample.summaryKey)}</p>
                <p className="fine">{t("home.recordNote")}</p>
              </details>
              <button className="btn" type="button" disabled={busy} onClick={() => void run(sample.address, "sample", sample.id)}>
                {busy ? t("home.busy") : t("home.openExample")}
              </button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
