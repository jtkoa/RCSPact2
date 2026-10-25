import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useI18n } from "../i18n/LanguageProvider";
import type { Lang } from "../i18n/messages";

const languageNames: Record<Lang, string> = { en: "English", es: "Español", ht: "Kreyòl Ayisyen" };

export function Layout({ children }: { children: ReactNode }) {
  const { lang, setLang, t } = useI18n();
  const { pathname } = useLocation();
  const assessment = pathname === "/" || pathname.startsWith("/property");
  return (
    <>
      <a className="skip" href="#content">
        {t("skip")}
      </a>
      <header className="site-header">
        <div className="header-bar">
        <Link className="brand" to="/">
          <p className="wordmark">RCSP</p>
          <p className="tagline">{t("nav.subtitle")}</p>
        </Link>
        <div className="header-tools">
          <div className="lang" role="group" aria-label={t("lang.label")}>
            {(Object.keys(languageNames) as Lang[]).map((code) => (
              <button key={code} type="button" aria-pressed={lang === code} onClick={() => setLang(code)}>
                {languageNames[code]}
              </button>
            ))}
          </div>
          <nav className="nav" aria-label="Primary">
            <Link to="/" aria-current={assessment ? "page" : undefined}>
              {t("nav.screen")}
            </Link>
            <Link to="/resources" aria-current={pathname.startsWith("/resources") ? "page" : undefined}>
              {t("nav.resources")}
            </Link>
            <Link to="/roadmap" aria-current={pathname.startsWith("/roadmap") ? "page" : undefined}>
              {t("nav.roadmap")}
            </Link>
          </nav>
        </div>
        </div>
      </header>
      <main id="content" className="wrap">
        {children}
      </main>
      <footer className="site-footer">
        <p>{t("footer")}</p>
      </footer>
    </>
  );
}
