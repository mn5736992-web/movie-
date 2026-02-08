/**
 * Reel Search — local server with TMDB proxy (no API key in the app)
 * Run: TMDB_KEY=your_key node server.js
 * Get a free key: https://www.themoviedb.org/settings/api
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const TMDB_KEY = process.env.TMDB_KEY || process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w500";

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

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (proxyRes) => {
      let body = "";
      proxyRes.on("data", (chunk) => (body += chunk));
      proxyRes.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
    }).on("error", reject);
  });
}

function handleSearch(params, res) {
  if (!TMDB_KEY) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ Response: "False", Error: "Server: Set TMDB_KEY when starting the server." }));
    return;
  }
  const q = (params.q || params.query || "").trim();
  const page = Math.max(1, parseInt(params.page, 10) || 1);
  const type = (params.type || "").toLowerCase();

  if (!q) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ Response: "False", Error: "Query required." }));
    return;
  }

  const pathname = type === "movie" ? "/search/movie" : type === "tv" || type === "series" ? "/search/tv" : "/search/multi";
  const url = `${TMDB_BASE}${pathname}?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&page=${page}`;

  get(url)
    .then((data) => {
      if (!data || data.errors) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ Response: "False", Error: "Nothing found." }));
        return;
      }
      const results = data.results || [];
      const total = data.total_results != null ? data.total_results : results.length;
      const Search = results
        .filter((r) => (pathname === "/search/multi" ? (r.media_type === "movie" || r.media_type === "tv") : true))
        .slice(0, 20)
        .map((r) => {
          const mediaType = r.media_type || (pathname === "/search/tv" ? "tv" : "movie");
          const id = `${mediaType}-${r.id}`;
          const title = r.title || r.name || "";
          const date = r.release_date || r.first_air_date || "";
          const year = date ? date.slice(0, 4) : "";
          const poster = r.poster_path ? `${IMG_BASE}${r.poster_path}` : null;
          return {
            imdbID: id,
            Title: title,
            Year: year,
            Type: mediaType === "tv" ? "series" : "movie",
            Poster: poster || "N/A",
          };
        });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          Response: "True",
          Search,
          totalResults: String(total),
        })
      );
    })
    .catch(() => {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ Response: "False", Error: "Could not reach TMDB." }));
    });
}

function handleDetail(params, res) {
  if (!TMDB_KEY) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ Response: "False", Error: "Server: Set TMDB_KEY when starting the server." }));
    return;
  }
  const idParam = (params.id || "").trim();
  const type = (params.type || "").toLowerCase();
  let mediaType = type;
  let id = idParam;
  if (!type && idParam.includes("-")) {
    const parts = idParam.split("-");
    mediaType = parts[0];
    id = parts.slice(1).join("-");
  }
  if (!id || !mediaType || (mediaType !== "movie" && mediaType !== "tv")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ Response: "False", Error: "Invalid id or type." }));
    return;
  }

  const pathname = mediaType === "movie" ? "/movie" : "/tv";
  const url = `${TMDB_BASE}${pathname}/${id}?api_key=${TMDB_KEY}&append_to_response=credits`;

  get(url)
    .then((data) => {
      if (!data || data.id == null) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ Response: "False", Error: "Not found." }));
        return;
      }
      const title = data.title || data.name || "";
      const date = data.release_date || data.first_air_date || "";
      const year = date ? date.slice(0, 4) : "";
      const poster = data.poster_path ? `${IMG_BASE}${data.poster_path}` : null;
      const runtime = data.runtime ? `${data.runtime} min` : "N/A";
      const genreStr = (data.genres || []).map((g) => g.name).join(", ") || "N/A";
      const credits = data.credits || {};
      const director = (credits.crew || []).find((c) => c.job === "Director");
      const directorName = director ? director.name : "N/A";
      const actors = (credits.cast || [])
        .slice(0, 5)
        .map((c) => c.name)
        .join(", ") || "N/A";
      const vote = data.vote_average != null ? Number(data.vote_average).toFixed(1) : null;
      const ratings = [];
      if (vote) ratings.push({ Source: "Internet Movie Database", Value: `${vote}/10` });

      const out = {
        Response: "True",
        imdbID: `${mediaType}-${data.id}`,
        imdbRating: vote ? `${vote}/10` : "N/A",
        Title: title,
        Year: year,
        Type: mediaType === "tv" ? "series" : "movie",
        Poster: poster || "N/A",
        Plot: data.overview || "N/A",
        Genre: genreStr,
        Director: directorName,
        Actors: actors,
        Runtime: runtime,
        Rated: "N/A",
        Ratings: ratings,
        BoxOffice: "N/A",
        Awards: "N/A",
      };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(out));
    })
    .catch(() => {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ Response: "False", Error: "Could not reach TMDB." }));
    });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url || "/", `http://localhost:${PORT}`);
  const pathname = u.pathname === "/" ? "/index.html" : u.pathname;

  if (pathname === "/api/search" || pathname === "/api/search/") {
    const params = Object.fromEntries(u.searchParams);
    handleSearch(params, res);
    return;
  }
  if (pathname === "/api/detail" || pathname === "/api/detail/") {
    const params = Object.fromEntries(u.searchParams);
    handleDetail(params, res);
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
  if (!TMDB_KEY) console.log("Set TMDB_KEY to enable search (e.g. TMDB_KEY=yourkey node server.js)");
});
