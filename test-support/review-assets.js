import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const publicRoot = path.dirname(fileURLToPath(new URL("../public/index.html", import.meta.url)));

export function reviewAssetsBinding() {
  return {
    async fetch(request) {
      const parts = new URL(request.url).pathname.split("/").filter(Boolean);
      const file = path.join(publicRoot, ...parts);
      try {
        const body = await readFile(file, "utf8");
        return new Response(body, {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" }
        });
      } catch {
        return new Response("Not Found", { status: 404 });
      }
    }
  };
}

export function reviewAssetsEnv() {
  return { ASSETS: reviewAssetsBinding() };
}
