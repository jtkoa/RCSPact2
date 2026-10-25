import { researchKey, researchSteps, type ResearchState, type ResearchStep } from "../engine/researchTypes";

const inflight = new Map<string, Promise<ResearchState>>();

export function fetchResearchStep(folio: string, step: ResearchStep): Promise<ResearchState> {
  const lock = `${folio}:${step}`;
  const existing = inflight.get(lock);
  if (existing) return existing;
  const pending = request(folio, step).finally(() => {
    inflight.delete(lock);
  });
  inflight.set(lock, pending);
  return pending;
}

async function request(folio: string, step: ResearchStep): Promise<ResearchState> {
  const response = await fetch("/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folio, step }),
  });
  const payload = (await response.json()) as { step?: ResearchStep; evidence?: ResearchState[keyof ResearchState]; error?: string };
  if (!response.ok || !payload.evidence || !payload.step) {
    throw new Error(payload.error || "search_failed");
  }
  const next = {} as ResearchState;
  const key = researchKey(payload.step);
  if (key === "sketch") next.sketch = payload.evidence as ResearchState["sketch"];
  else if (key === "permits") next.permits = payload.evidence as ResearchState["permits"];
  else if (key === "overlays") next.overlays = payload.evidence as ResearchState["overlays"];
  else if (key === "cases") next.cases = payload.evidence as ResearchState["cases"];
  else if (key === "code") next.code = payload.evidence as ResearchState["code"];
  else next.lotFields = payload.evidence as ResearchState["lotFields"];
  return next;
}

export function pendingSteps(folio: string, research: ResearchState | undefined): ResearchStep[] {
  if (!folio) return [];
  return researchSteps.filter((step) => !research?.[researchKey(step)]);
}
