// @ts-check
/**
 * Zero-dependency static dev server. `npm run dev`, then open the printed URL.
 * Milestone 2 adds the real server (POST /embed, POST /chat) as a separate
 * file; this one only hands out files.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url)); // ends with the path separator

/** @type {Record<string, string>} */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

const port = Number(process.argv[2]) || 5173;

createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    let rel = normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, "");
    if (rel === "" || rel.endsWith("/")) rel += "index.html";
    const file = join(root, rel);
    if (!file.startsWith(root)) throw new Error("outside root");
    const body = await readFile(file);
    // no-cache: modules must never mix versions across edits — one stale
    // import error takes down the whole app
    res.writeHead(200, {
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-cache",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`sidelong → http://localhost:${port}`);
});
