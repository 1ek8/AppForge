import { existsSync, statSync } from "node:fs";
import { join, normalize, extname } from "node:path";

const port = Number(process.env.PORT) || 8080;
const distDir = join(import.meta.dir, "dist");
const indexHtml = join(distDir, "index.html");

const sharedHeaders: Record<string, string> = {
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
};

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".json": "application/json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function resolvePath(pathname: string): string {
  const decoded = decodeURIComponent(pathname);
  const candidate = normalize(join(distDir, decoded));
  if (candidate.startsWith(distDir) && isFile(candidate)) {
    return candidate;
  }
  return indexHtml;
}

const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const filePath = resolvePath(url.pathname);

    if (!existsSync(filePath)) {
      return new Response("Not Found", { status: 404, headers: sharedHeaders });
    }

    const headers: Record<string, string> = { ...sharedHeaders };
    if (url.pathname.startsWith("/assets/")) {
      headers["Cache-Control"] = "public, max-age=31536000, immutable";
    } else {
      headers["Cache-Control"] = "no-cache";
    }

    const mime = MIME[extname(filePath)];
    if (mime) {
      headers["Content-Type"] = mime;
    }

    return new Response(Bun.file(filePath), { headers });
  },
});

console.log(`Serving ${distDir} on port ${server.port}`);