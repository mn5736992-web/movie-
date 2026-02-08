/**
 * Reel Search — local server with OMDb proxy (no API key in the app)
 * Run: OMDB_KEY=your_key node server.js
 * Then open http://localhost:3000 — the app never asks for a key.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const OMDB_KEY = process.env.OMDB_KEY || process.env.OMDB_API_KEY;
const OMDB = "https://www.omdbapi.com/";

const MIMES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".ico": "image/x-icon",
};

function serveFile(filePath, res) {
  const ext = path.extname(filePath);
  const mime = MIMES[ext] || "application/octet-stream";
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
}

function proxyOmdb(params, res) {
  if (!OMDB_KEY) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ Response: "False", Error: "Server: Set OMDB_KEY when starting the server." }));
    return;
  }
  const query = new URLSearchParams({ ...params, apikey: OMDB_KEY }).toString();
  const url = `${OMDB}?${query}`;
  http.get(url, (proxyRes) => {
    let body = "";
    proxyRes.on("data", (chunk) => (body += chunk));
    proxyRes.on("end", () => {
      res.writeHead(proxyRes.statusCode || 200, { "Content-Type": "application/json" });
      res.end(body);
    });
  }).on("error", () => {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ Response: "False", Error: "Could not reach OMDb." }));
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url || "/", `http://localhost:${PORT}`);
  const pathname = u.pathname === "/" ? "/index.html" : u.pathname;

  if (pathname === "/api/omdb" || pathname === "/api/omdb/") {
    const params = Object.fromEntries(u.searchParams);
    proxyOmdb(params, res);
    return;
  }

  const filePath = path.join(__dirname, pathname);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end();
    return;
  }
  serveFile(filePath, res);
});

server.listen(PORT, () => {
  console.log(`Reel Search running at http://localhost:${PORT}`);
  if (!OMDB_KEY) console.log("Set OMDB_KEY to enable search (e.g. OMDB_KEY=yourkey node server.js)");
});
