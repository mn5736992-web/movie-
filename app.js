/**
 * Reel Search — Movie search app (no API key in the app)
 * Run the included server with OMDB_KEY set: node server.js
 */

const API_BASE = ""; // Use same origin; server proxies to OMDb with key
const WATCHLIST_KEY = "reel-search-watchlist";

const elements = {
  movieQuery: document.getElementById("movieQuery"),
  searchBtn: document.getElementById("searchBtn"),
  searchType: document.getElementById("searchType"),
  searchSort: document.getElementById("searchSort"),
  loading: document.getElementById("loading"),
  error: document.getElementById("error"),
  resultsSection: document.getElementById("resultsSection"),
  resultsHeading: document.getElementById("resultsHeading"),
  resultsGrid: document.getElementById("resultsGrid"),
  pagination: document.getElementById("pagination"),
  detailSection: document.getElementById("detailSection"),
  backBtn: document.getElementById("backBtn"),
  detailContent: document.getElementById("detailContent"),
  watchlistSection: document.getElementById("watchlistSection"),
  watchlistGrid: document.getElementById("watchlistGrid"),
  watchlistEmpty: document.getElementById("watchlistEmpty"),
  watchlistCount: document.getElementById("watchlistCount"),
  watchlistCountLabel: document.getElementById("watchlistCountLabel"),
  searchSection: document.getElementById("searchSection"),
  emptyState: document.getElementById("emptyState"),
};

let currentPage = 1;
let totalPages = 1;
let lastQuery = "";
let detailOpenedFrom = "search"; // "search" | "watchlist"

// ——— Watchlist (localStorage) ———
function getWatchlist() {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setWatchlist(list) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  updateWatchlistCount();
}

function isInWatchlist(imdbId) {
  return getWatchlist().some((item) => item.imdbID === imdbId);
}

function addToWatchlist(item) {
  const list = getWatchlist();
  if (list.some((i) => i.imdbID === item.imdbID)) return;
  list.push({
    imdbID: item.imdbID,
    Title: item.Title,
    Year: item.Year,
    Type: item.Type,
    Poster: item.Poster,
  });
  setWatchlist(list);
}

function removeFromWatchlist(imdbId) {
  setWatchlist(getWatchlist().filter((i) => i.imdbID !== imdbId));
}

function updateWatchlistCount() {
  const n = getWatchlist().length;
  if (elements.watchlistCount) elements.watchlistCount.textContent = n;
  if (elements.watchlistCountLabel) elements.watchlistCountLabel.textContent = n ? `${n} title${n !== 1 ? "s" : ""}` : "";
}

function showLoading(show) {
  elements.loading?.classList.toggle("hidden", !show);
  if (elements.searchBtn) elements.searchBtn.disabled = show;
}

function showError(message) {
  if (elements.error) {
    elements.error.textContent = message;
    elements.error.classList.remove("hidden");
  }
}

function hideError() {
  elements.error?.classList.add("hidden");
}

function showEmptyState(show) {
  const el = elements.emptyState;
  if (el) el.style.display = show ? "block" : "none";
}

function showResults(show) {
  elements.resultsSection?.classList.toggle("hidden", !show);
}

function showDetail(show) {
  elements.detailSection?.classList.toggle("hidden", !show);
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Network error. Please try again.");
  return res.json();
}

function buildUrl(params) {
  const search = new URLSearchParams(params);
  return `${API_BASE}/api/omdb?${search}`;
}

function sortResults(list, sortKey) {
  const arr = [...list];
  switch (sortKey) {
    case "year-desc":
      arr.sort((a, b) => (parseYear(b.Year) - parseYear(a.Year)));
      break;
    case "year-asc":
      arr.sort((a, b) => (parseYear(a.Year) - parseYear(b.Year)));
      break;
    case "title-asc":
      arr.sort((a, b) => (a.Title || "").localeCompare(b.Title || ""));
      break;
    case "title-desc":
      arr.sort((a, b) => (b.Title || "").localeCompare(a.Title || ""));
      break;
  }
  return arr;
}

function parseYear(y) {
  if (!y) return 0;
  const n = parseInt(String(y).replace(/\D/g, "").slice(0, 4), 10);
  return Number.isNaN(n) ? 0 : n;
}

async function searchMovies(query, page = 1) {
  if (!query.trim()) {
    showError("Type a movie or series name to search.");
    return;
  }

  hideError();
  showLoading(true);
  showResults(false);
  showDetail(false);
  lastQuery = query;
  currentPage = page;

  try {
    const type = (elements.searchType && elements.searchType.value) || "";
    const url = buildUrl({ s: query.trim(), page, ...(type && { type }) });
    const data = await fetchJson(url);

    if (data.Response === "False") {
      showLoading(false);
      showError("Nothing found. Try another name.");
      showEmptyState(true);
      return;
    }

    const total = parseInt(data.totalResults, 10) || 0;
    totalPages = Math.ceil(total / 10);
    let list = data.Search || [];

    const sort = (elements.searchSort && elements.searchSort.value) || "year-desc";
    list = sortResults(list, sort);

    if (elements.resultsHeading) elements.resultsHeading.textContent = total === 1
      ? `1 result for "${query}"`
      : `${total} results for "${query}"`;
    renderResults(list);
    renderPagination();
    showResults(true);
    showEmptyState(false);
    elements.resultsSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    showError("Something went wrong. Check your connection and try again.");
    showEmptyState(true);
  } finally {
    showLoading(false);
  }
}

function renderResults(list) {
  if (!elements.resultsGrid) return;
  elements.resultsGrid.innerHTML = list
    .map((item) => {
      const inList = isInWatchlist(item.imdbID);
      const posterBlock =
        item.Poster && item.Poster !== "N/A"
          ? `<img class="card-poster" src="${item.Poster}" alt="" loading="lazy">`
          : `<div class="card-placeholder">🎬</div>`;
      return `
    <article class="card" data-imdb-id="${item.imdbID}" role="button" tabindex="0">
      <div class="card-poster-wrap">
        ${posterBlock}
        <div class="card-actions">
          <button type="button" class="btn-watchlist ${inList ? "in-watchlist" : ""}" data-imdb-id="${item.imdbID}" data-action="watchlist" aria-label="${inList ? "Remove from watchlist" : "Add to watchlist"}">${inList ? "♥" : "♡"}</button>
        </div>
      </div>
      <div class="card-info">
        <h3 class="card-title">${escapeHtml(item.Title)}</h3>
        <p class="card-year">${escapeHtml(item.Year)}</p>
        <p class="card-type">${escapeHtml(item.Type || "")}</p>
      </div>
    </article>
  `;
    })
    .join("");

  elements.resultsGrid.querySelectorAll(".card").forEach((card) => {
    const id = card.dataset.imdbId;
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-action=watchlist]")) {
        e.preventDefault();
        e.stopPropagation();
        toggleWatchlistOnCard(id, card);
        return;
      }
      openDetail(id);
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetail(id);
      }
    });
  });

  elements.resultsGrid.querySelectorAll(".btn-watchlist").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleWatchlistOnCard(btn.dataset.imdbId, btn.closest(".card"));
    });
  });
}

function toggleWatchlistOnCard(imdbId, cardOrBtn) {
  const card = cardOrBtn.classList.contains("card") ? cardOrBtn : cardOrBtn.closest(".card");
  const item = { imdbID: imdbId, Title: card.querySelector(".card-title")?.textContent, Year: card.querySelector(".card-year")?.textContent, Type: card.querySelector(".card-type")?.textContent, Poster: card.querySelector(".card-poster")?.src };
  const btn = card.querySelector(".btn-watchlist");
  if (isInWatchlist(imdbId)) {
    removeFromWatchlist(imdbId);
    if (btn) {
      btn.classList.remove("in-watchlist");
      btn.textContent = "♡";
      btn.setAttribute("aria-label", "Add to watchlist");
    }
  } else {
    addToWatchlist(item);
    if (btn) {
      btn.classList.add("in-watchlist");
      btn.textContent = "♥";
      btn.setAttribute("aria-label", "Remove from watchlist");
    }
  }
}

function renderPagination() {
  if (!elements.pagination) return;
  if (totalPages <= 1) {
    elements.pagination.classList.add("hidden");
    elements.pagination.innerHTML = "";
    return;
  }

  elements.pagination.classList.remove("hidden");
  const parts = [];

  if (currentPage > 1) {
    parts.push(`<button type="button" data-page="${currentPage - 1}">Previous</button>`);
  }

  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let i = start; i <= end; i++) {
    parts.push(
      `<button type="button" class="${i === currentPage ? "active" : ""}" data-page="${i}">${i}</button>`
    );
  }

  if (currentPage < totalPages) {
    parts.push(`<button type="button" data-page="${currentPage + 1}">Next</button>`);
  }

  elements.pagination.innerHTML = parts.join("");

  elements.pagination.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => searchMovies(lastQuery, parseInt(btn.dataset.page, 10)));
  });
}

async function openDetail(imdbId) {
  detailOpenedFrom = elements.watchlistSection && !elements.watchlistSection.classList.contains("hidden") ? "watchlist" : "search";
  hideError();
  showLoading(true);
  showDetail(true);
  if (elements.resultsSection) elements.resultsSection.classList.add("hidden");
  if (elements.watchlistSection) elements.watchlistSection.classList.add("hidden");
  if (elements.detailContent) elements.detailContent.innerHTML = "";

  try {
    const url = buildUrl({ i: imdbId });
    const data = await fetchJson(url);

    if (data.Response === "False") {
      showError("Couldn’t load details. Try again.");
      showLoading(false);
      return;
    }

    renderDetail(data);
  } catch (err) {
    showError("Couldn’t load details. Try again.");
  } finally {
    showLoading(false);
  }
}

function renderDetail(data) {
  const hasPoster = data.Poster && data.Poster !== "N/A";
  const meta = [data.Year, data.Rated !== "N/A" ? data.Rated : null, data.Runtime]
    .filter(Boolean)
    .join(" · ");
  const ratings = buildRatingsHtml(data);
  const inList = isInWatchlist(data.imdbID);
  const watchlistBtn = `<button type="button" class="btn-watchlist ${inList ? "in-watchlist" : ""}" data-detail-watchlist data-imdb-id="${data.imdbID}" aria-label="${inList ? "Remove from watchlist" : "Add to watchlist"}">${inList ? "♥" : "♡"} ${inList ? "In Watchlist" : "Add to Watchlist"}</button>`;
  const trailerUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(data.Title + " trailer")}`;
  const trailerBtn = `<a href="${trailerUrl}" target="_blank" rel="noopener" class="btn-trailer">▶ Watch trailer</a>`;

  const rows = [
    ["Genre", data.Genre],
    ["Director", data.Director],
    ["Actors", data.Actors],
    ["Box Office", data.BoxOffice],
    ["Awards", data.Awards],
  ]
    .filter(([, v]) => v && v !== "N/A")
    .map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`)
    .join("");

  const heroContent = `
    <div class="detail-hero-content">
      <h2 class="detail-title">${escapeHtml(data.Title)}</h2>
      <p class="detail-meta">${escapeHtml(meta)}</p>
      <div class="detail-hero-ratings">${ratings}</div>
    </div>
  `;

  const heroBlock = hasPoster
    ? `<div class="detail-hero" style="--poster-url: url(${data.Poster})">
        <div class="detail-hero-image"></div>
        <div class="detail-hero-overlay">${heroContent}</div>
       </div>`
    : `<div class="detail-hero detail-hero-no-poster">
        <div class="detail-poster-placeholder">🎬</div>
        <div class="detail-hero-overlay">${heroContent}</div>
       </div>`;

  if (!elements.detailContent) return;
  elements.detailContent.innerHTML = `
    <div class="detail-image-mode">
      ${heroBlock}
      <div class="detail-info">
        <div class="detail-actions">${watchlistBtn} ${trailerBtn}</div>
        ${data.Plot && data.Plot !== "N/A" ? `<p class="detail-plot">${escapeHtml(data.Plot)}</p>` : ""}
        <dl class="detail-grid">${rows}</dl>
        <div id="moreFromDirector" class="more-from-director"></div>
      </div>
    </div>
  `;

  const wlBtn = elements.detailContent.querySelector("[data-detail-watchlist]");
  if (wlBtn) {
    wlBtn.addEventListener("click", () => {
      if (isInWatchlist(data.imdbID)) {
        removeFromWatchlist(data.imdbID);
        wlBtn.classList.remove("in-watchlist");
        wlBtn.textContent = "♡ Add to Watchlist";
        wlBtn.setAttribute("aria-label", "Add to watchlist");
      } else {
        addToWatchlist({ imdbID: data.imdbID, Title: data.Title, Year: data.Year, Type: data.Type, Poster: data.Poster });
        wlBtn.classList.add("in-watchlist");
        wlBtn.textContent = "♥ In Watchlist";
        wlBtn.setAttribute("aria-label", "Remove from watchlist");
      }
    });
  }

  if (data.Director && data.Director !== "N/A") {
    loadMoreFromDirector(data.Director, data.imdbID);
  }
}

function buildRatingsHtml(data) {
  const ratings = data.Ratings || [];
  const imdb = data.imdbRating && data.imdbRating !== "N/A" ? data.imdbRating : (ratings.find((r) => r.Source === "Internet Movie Database") || {}).Value;
  const rt = (ratings.find((r) => r.Source === "Rotten Tomatoes") || {}).Value;
  const mc = (ratings.find((r) => r.Source === "Metacritic") || {}).Value;
  const pills = [];
  if (imdb) pills.push(`<span class="rating-pill imdb">⭐ ${imdb}</span>`);
  if (rt) pills.push(`<span class="rating-pill rotten">🍅 ${rt}</span>`);
  if (mc) pills.push(`<span class="rating-pill metacritic">📊 ${mc}</span>`);
  if (pills.length === 0) return "";
  return `<div class="ratings-row">${pills.join("")}</div>`;
}

async function loadMoreFromDirector(director, excludeImdbId) {
  const container = document.getElementById("moreFromDirector");
  if (!container) return;
  const names = director.split(",").map((s) => s.trim()).filter(Boolean);
  const first = names[0];
  if (!first) return;

  try {
    const url = buildUrl({ s: first, type: "movie" });
    const data = await fetchJson(url);
    if (data.Response !== "True" || !data.Search) {
      container.remove();
      return;
    }
    const others = data.Search.filter((item) => item.imdbID !== excludeImdbId).slice(0, 6);
    if (others.length === 0) {
      container.remove();
      return;
    }
    container.innerHTML = `
      <h3>More from ${escapeHtml(first)}</h3>
      <div class="results-grid">${others
        .map(
          (item) => `
        <article class="card" data-imdb-id="${item.imdbID}" role="button" tabindex="0">
          ${item.Poster && item.Poster !== "N/A" ? `<img class="card-poster" src="${item.Poster}" alt="" loading="lazy">` : `<div class="card-placeholder">🎬</div>`}
          <div class="card-info">
            <h3 class="card-title">${escapeHtml(item.Title)}</h3>
            <p class="card-year">${escapeHtml(item.Year)}</p>
          </div>
        </article>`
        )
        .join("")}</div>
    `;
    container.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("click", () => openDetail(card.dataset.imdbId));
    });
  } catch {
    container.remove();
  }
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function goBack() {
  showDetail(false);
  hideError();
  if (detailOpenedFrom === "watchlist") {
    showView("watchlist");
  } else {
    showResults(true);
  }
}

function showView(view) {
  const isSearch = view === "search";
  const isWatchlist = view === "watchlist";
  document.querySelectorAll(".nav-link").forEach((a) => a.classList.toggle("active", a.dataset.view === view));
  if (elements.searchSection) elements.searchSection.style.display = isSearch ? "block" : "none";
  if (elements.resultsSection) elements.resultsSection.classList.toggle("hidden", !isSearch || !lastQuery);
  if (elements.detailSection) elements.detailSection.classList.add("hidden");
  if (elements.watchlistSection) elements.watchlistSection.classList.toggle("hidden", !isWatchlist);
  if (isWatchlist) renderWatchlistView();
}

function renderWatchlistView() {
  const list = getWatchlist();
  if (elements.watchlistCountLabel) elements.watchlistCountLabel.textContent = list.length ? `${list.length} title${list.length !== 1 ? "s" : ""}` : "";
  if (elements.watchlistEmpty) elements.watchlistEmpty.classList.toggle("hidden", list.length > 0);
  if (elements.watchlistGrid) {
    elements.watchlistGrid.innerHTML = list.length === 0 ? "" : list.map((item) => {
      const posterBlock = item.Poster ? `<img class="card-poster" src="${item.Poster}" alt="" loading="lazy">` : `<div class="card-placeholder">🎬</div>`;
      return `
        <article class="card" data-imdb-id="${item.imdbID}">
          <div class="card-poster-wrap">
            ${posterBlock}
            <div class="card-actions">
              <button type="button" class="btn-watchlist in-watchlist" data-imdb-id="${item.imdbID}" data-action="watchlist" aria-label="Remove from watchlist">♥</button>
            </div>
          </div>
          <div class="card-info">
            <h3 class="card-title">${escapeHtml(item.Title)}</h3>
            <p class="card-year">${escapeHtml(item.Year)}</p>
            <p class="card-type">${escapeHtml(item.Type || "")}</p>
          </div>
        </article>
      `;
    }).join("");
    elements.watchlistGrid.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-action=watchlist]")) {
          e.stopPropagation();
          removeFromWatchlist(card.dataset.imdbId);
          renderWatchlistView();
          return;
        }
        openDetail(card.dataset.imdbId);
      });
    });
    elements.watchlistGrid.querySelectorAll(".btn-watchlist").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeFromWatchlist(btn.dataset.imdbId);
        renderWatchlistView();
      });
    });
  }
}

// Event listeners
elements.searchBtn?.addEventListener("click", () => searchMovies(elements.movieQuery?.value?.trim() ?? ""));

elements.movieQuery?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchMovies(elements.movieQuery?.value?.trim() ?? "");
});

elements.backBtn?.addEventListener("click", goBack);

document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    showView(link.dataset.view);
  });
});

document.querySelector(".logo")?.addEventListener("click", (e) => {
  e.preventDefault();
  showView("search");
});

updateWatchlistCount();
elements.movieQuery?.focus();
