const ORIGIN_KEY = "__RCSP_ORIGIN";

export function serviceUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = (globalThis as Record<string, unknown>)[ORIGIN_KEY];
  if (typeof base !== "string" || !base) return path;
  return new URL(path, base).href;
}

export function setServiceOrigin(origin: string) {
  (globalThis as Record<string, unknown>)[ORIGIN_KEY] = origin;
}
