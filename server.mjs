import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handler } from "./netlify/functions/api.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const mime = {".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml"};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost:8888");
    if (url.pathname.startsWith("/api/")) {
      const route = url.pathname.slice(5);
      const body = await new Promise((resolve, reject) => {
        let raw = "";
        req.on("data", c => raw += c);
        req.on("end", () => resolve(raw));
        req.on("error", reject);
      });
      const event = {
        httpMethod: req.method,
        path: url.pathname,
        rawUrl: url.toString(),
        headers: Object.fromEntries(Object.entries(req.headers).map(([k,v]) => [k, Array.isArray(v) ? v.join(",") : v])),
        body: body || null,
        queryStringParameters: Object.fromEntries(url.searchParams.entries()),
        isBase64Encoded: false
      };
      const result = await handler(event, {});
      res.writeHead(result.statusCode || 200, result.headers || {});
      res.end(result.body || "");
      return;
    }
    let target = path.join(publicDir, decodeURIComponent(url.pathname));
    if (url.pathname === "/") target = path.join(publicDir, "index.html");
    if (!target.startsWith(publicDir)) { res.writeHead(403); res.end("Forbidden"); return; }
    try {
      const content = await fs.readFile(target);
      res.writeHead(200, {"Content-Type": mime[path.extname(target)] || "application/octet-stream"});
      res.end(content);
    } catch {
      const content = await fs.readFile(path.join(publicDir, "index.html"));
      res.writeHead(200, {"Content-Type":mime[".html"]});
      res.end(content);
    }
  } catch (err) {
    console.error(err);
    res.writeHead(500, {"Content-Type":"application/json"});
    res.end(JSON.stringify({error:"Local server error"}));
  }
});
const port = Number(process.env.PORT || 8888);
server.listen(port, "0.0.0.0", () => console.log(`Aerovhyn Inventory running at http://localhost:${port}`));
