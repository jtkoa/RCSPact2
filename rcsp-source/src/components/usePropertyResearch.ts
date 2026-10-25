import { useEffect, useRef, useState } from "react";
import { researchSteps } from "../engine/researchTypes";
import type { Screening } from "../engine/types";
import { fetchResearchStep } from "../services/researchClient";
import { updateScreening } from "../services/screening";

export function usePropertyResearch(screening: Screening | null, onChange: (next: Screening) => void) {
  const latest = useRef(screening);
  latest.current = screening;
  const [searchError, setSearchError] = useState(false);
  const [retry, setRetry] = useState(0);
  const folio = (screening?.facts.parcel?.folio || screening?.facts.addressRecord?.folio || "").replace(/\D/g, "");
  const status = screening?.status;
  const id = screening?.id;

  useEffect(() => {
    if (folio.length !== 13 || status !== "ready") return;
    let cancel = false;
    const missing = researchSteps.filter((step) => {
      const key = step === "lot-fields" ? "lotFields" : step;
      const saved = latest.current?.research?.[key];
      if (!saved) return true;
      if (step === "code" && typeof (saved as { lotMinPublished?: unknown }).lotMinPublished !== "boolean") return true;
      return false;
    });
    if (!missing.length) return;
    void (async () => {
      for (const step of missing) {
        try {
          const part = await fetchResearchStep(folio, step);
          if (cancel || !Object.keys(part).length) continue;
          const current = latest.current;
          if (!current) continue;
          onChange(updateScreening(current, { research: { ...current.research, ...part } }));
        } catch (cause) {
          console.error("rcsp-research", cause instanceof Error ? cause.message : "search_failed");
          if (!cancel) setSearchError(true);
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [folio, id, onChange, retry, status]);

  return {
    searchError,
    retrySearch() {
      setSearchError(false);
      setRetry((value) => value + 1);
    },
  };
}
