import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readLang, translate, type Lang, type MessageKey } from "./messages";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => readLang());
  useEffect(() => {
    try {
      sessionStorage.setItem("rcsp.lang", lang);
    } catch {
      /* Keep the choice for this view even if storage is blocked. */
    }
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo<LanguageContextValue>(
    () => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }),
    [lang],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("LanguageProvider is missing");
  return value;
}
