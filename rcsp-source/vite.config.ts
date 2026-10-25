import { defineConfig, loadEnv, type Plugin, type ProxyOptions, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";

const proxy: Record<string, ProxyOptions> = {
  "/geo": {
    target: "https://nominatim.openstreetmap.org",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/geo/, ""),
    headers: {
      "User-Agent": "RCSP-Preliminary-Screening/0.1 (local Miami-Dade ADU demo)",
      Accept: "application/json",
    },
  },
  "/gis/land": {
    target: "https://gis.miamidade.gov",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/gis\/land/, "/arcgis/rest/services/LandManagement"),
  },
  "/gis/pa": {
    target: "https://gisfs.miamidade.gov",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/gis\/pa/, "/mdarcgis/rest/services"),
  },
  "/gis/address": {
    target: "https://gisws.miamidade.gov",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/gis\/address/, "/gisaddress"),
  },
};

function readJson(req: import("node:http").IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 120_000) {
        reject(new Error("too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? (JSON.parse(text) as unknown) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function agentApi(): Plugin {
  return {
    name: "rcsp-agent-api",
    configureServer(server: ViteDevServer) {
      const env = loadEnv(server.config.mode, server.config.root, "");
      const apiKey = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY || "";
      const model = process.env.OPENAI_MODEL || env.OPENAI_MODEL || "gpt-6-luna";
      const port = server.config.server.port ?? 5173;
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split("?")[0];
        if (path === "/api/research") {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "bad_request" }));
            return;
          }
          try {
            const body = (await readJson(req)) as { folio?: unknown; step?: unknown };
            const loaded = (await server.ssrLoadModule("/src/server/research.ts")) as {
              folioDigits: (value: string) => string | null;
              researchKey: (step: string) => string;
              runResearchStep: (step: string, folio: string) => Promise<unknown>;
            };
            const folio = typeof body.folio === "string" ? loaded.folioDigits(body.folio) : null;
            const step = body.step;
            const allowed = ["sketch", "permits", "overlays", "cases", "code", "lot-fields"];
            if (!folio || typeof step !== "string" || !allowed.includes(step)) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "bad_request" }));
              return;
            }
            const evidence = await loaded.runResearchStep(step as "sketch", folio);
            console.info(`rcsp-research step=${step} ok=true`);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ step, evidence }));
          } catch (error) {
            const httpStatus = typeof error === "object" && error && "httpStatus" in error ? Number(error.httpStatus) : null;
            console.info(`rcsp-research step=error http=${httpStatus ?? "none"}`);
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "search_failed", status: httpStatus }));
          }
          return;
        }
        if (path !== "/api/agent") {
          next();
          return;
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "bad_response" }));
          return;
        }
        try {
          const body = await readJson(req);
          const loaded = (await server.ssrLoadModule("/src/server/agent.ts")) as {
            handleAgentRequest: (
              payload: unknown,
              options: { apiKey: string; model: string; origin: string },
            ) => Promise<{ status: number; body: unknown }>;
          };
          const result = await loaded.handleAgentRequest(body, {
            apiKey,
            model,
            origin: `http://127.0.0.1:${port}`,
          });
          res.statusCode = result.status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result.body));
        } catch (error) {
          console.info(`rcsp-agent model_status=error http=none name=${error instanceof Error ? error.name : "request"}`);
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "model_failed", status: null }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), agentApi()],
  server: { host: "0.0.0.0", port: 5173, proxy },
  preview: { host: "0.0.0.0", port: 4173, proxy },
});
