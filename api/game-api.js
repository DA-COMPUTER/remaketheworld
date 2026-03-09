/**
 * game-api.js — Versioned Web Game API
 * Attach via: <script src="https://cdn.jsdelivr.net/gh/USER/REPO/api/game-api.js"></script>
 *
 * Exposes a single global: window.rtw
 *
 * Usage:
 *   await rtw.load();
 *   rtw.launch(rtw.latest());
 *   rtw.embed("v0.3.0", "myContainer");
 */

(() => {
  "use strict";

  // ─── Configuration ────────────────────────────────────────────────────────────
  // Replace USER/REPO with your actual GitHub username and repository name.
  const USER = "USER";
  const REPO = "REPO";

  // jsDelivr base URL for raw file delivery
  const CDN    = `https://cdn.jsdelivr.net/gh/${USER}/${REPO}`;
  // GitHub Trees API — always real-time, no CDN caching, free for public repos.
  // Returns the full repo tree in a single request via ?recursive=1.
  // Unlike jsDelivr's data API, this reflects pushes immediately.
  const GITHUB = `https://api.github.com/repos/${USER}/${REPO}/git/trees/HEAD?recursive=1`;

  // ─── Internal Cache ───────────────────────────────────────────────────────────
  // Populated once on the first load() call; all subsequent calls reuse this.
  let _cache = null; // { standard: string[], chromebook: string[], badges: Object }

  // ─── Private Helpers ──────────────────────────────────────────────────────────

  /**
   * Parse a GitHub Trees API response into categorised version lists.
   *
   * The GitHub Trees API (with ?recursive=1) returns a flat array of every
   * file and folder in the repo, each as { path, type, sha, ... }.
   * We filter that flat list by path pattern rather than walking a tree:
   *
   *   Standard builds  → v0.X.X/v0.N.X/vMAJOR.MINOR.PATCH.html
   *   Chromebook builds → chromebook/VERSION-cb.html
   *
   * This is simpler, faster, and always up-to-date because the GitHub API
   * is not cached by a CDN.
   *
   * @param {Object} data - Parsed JSON from the GitHub Trees API
   * @returns {{ standard: string[], chromebook: string[] }}
   */
  function parseTree(data) {
    const standard   = [];
    const chromebook = [];

    // data.tree is a flat array of every path in the repo
    const items = data.tree || [];

    items.forEach(item => {
      if (item.type !== "blob") return; // skip directories

      const path = item.path || "";

      // Standard build: v0.X.X/v0.N.X/vMAJOR.MINOR.PATCH.html
      const stdMatch = path.match(/^v0\.X\.X\/v\d+\.\d+\.X\/(v\d+\.\d+\.\d+)\.html$/);
      if (stdMatch) {
        standard.push(stdMatch[1]);
        return;
      }

      // Chromebook build: chromebook/VERSION-cb.html
      const cbMatch = path.match(/^chromebook\/([^/]+-cb)\.html$/);
      if (cbMatch) {
        chromebook.push(cbMatch[1]);
      }
    });

    return { standard, chromebook };
  }

  /**
   * Simple semver comparator for "vMAJOR.MINOR.PATCH" strings.
   * Returns positive if a > b, negative if a < b, zero if equal.
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  function semverCmp(a, b) {
    const parse = v => v.replace(/^v/, "").split(".").map(Number);
    const [aMaj, aMin, aPat] = parse(a);
    const [bMaj, bMin, bPat] = parse(b);
    return aMaj - bMaj || aMin - bMin || aPat - bPat;
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  const rtw = {

    /**
     * load()
     * Scans the repository file tree via the GitHub Trees API (always real-time)
     * and fetches badge metadata from /api/badges.json via jsDelivr CDN.
     * Results are cached after the first call.
     *
     * Must be awaited before using any other method.
     *
     * @returns {Promise<void>}
     *
     * Example:
     *   await rtw.load();
     */
    async load() {
      if (_cache) return; // Already loaded — use the cache

      // Fetch the GitHub file tree and badges concurrently.
      // The GitHub Trees API is always real-time — no CDN cache to wait on.
      // badges.json is still served via jsDelivr CDN (small file, rarely changes).
      const [treeRes, badgesRes] = await Promise.all([
        fetch(GITHUB, { headers: { Accept: "application/vnd.github+json" } }).catch(() => null),
        fetch(`${CDN}/api/badges.json`).catch(() => null)
      ]);

      // Parse file tree — fall back to empty lists on failure
      let standard = [], chromebook = [];
      if (treeRes && treeRes.ok) {
        const data = await treeRes.json().catch(() => ({}));
        ({ standard, chromebook } = parseTree(data));
      }

      // Parse badges — fall back to empty object on failure
      let badges = {};
      if (badgesRes && badgesRes.ok) {
        badges = await badgesRes.json().catch(() => ({}));
      }

      // Sort standard versions ascending by semver
      standard.sort(semverCmp);

      _cache = { standard, chromebook, badges };
    },

    /**
     * list()
     * Returns all detected standard version strings, sorted ascending.
     * Excludes known-broken versions (badge "broken").
     *
     * @returns {string[]}  e.g. ["v0.1.2", "v0.2.0", "v0.3.0"]
     *
     * Example:
     *   rtw.list(); // ["v0.1.2", ..., "v0.3.0"]
     */
    list() {
      if (!_cache) throw new Error("Call rtw.load() first.");
      return _cache.standard.filter(v => {
        const b = _cache.badges[v] || [];
        return !b.includes("broken");
      });
    },

    /**
     * chromebook()
     * Returns all detected Chromebook build version strings.
     *
     * @returns {string[]}  e.g. ["v0.2.9-cb", "v0.2.12-cb"]
     *
     * Example:
     *   rtw.chromebook(); // ["v0.2.9-cb", "v0.2.12-cb"]
     */
    chromebook() {
      if (!_cache) throw new Error("Call rtw.load() first.");
      return [..._cache.chromebook];
    },

    /**
     * latest()
     * Returns the highest semver standard version that is neither broken
     * nor marked as "canary". Canary builds are bleeding-edge and excluded
     * from stable resolution — use list() to include them.
     *
     * @returns {string}  e.g. "v0.2.12"
     *
     * Example:
     *   rtw.launch(rtw.latest()); // → "v0.2.12", not "v0.3.0" if v0.3.0 is canary
     */
    latest() {
      const versions = this.list().filter(v => {
        const badges = _cache.badges[v] || [];
        return !badges.includes("canary");
      });
      if (!versions.length) throw new Error("No non-canary versions available.");
      return versions[versions.length - 1];
    },

    /**
     * random()
     * Returns a random standard version (non-broken).
     *
     * @returns {string}
     *
     * Example:
     *   rtw.launch(rtw.random());
     */
    random() {
      const versions = this.list();
      if (!versions.length) throw new Error("No versions available.");
      return versions[Math.floor(Math.random() * versions.length)];
    },

    /**
     * url(version)
     * Resolves the full jsDelivr CDN URL for a given version string.
     *   - Chromebook builds  → /chromebook/VERSION.html
     *   - Standard builds    → /v0.X.X/vMAJOR.MINOR.X/VERSION.html
     *
     * @param {string} version  Version string, e.g. "v0.3.0" or "v0.2.12-cb"
     * @returns {string}        Full CDN URL
     *
     * Example:
     *   rtw.url("v0.3.0");       // "https://cdn.jsdelivr.net/gh/USER/REPO/v0.X.X/v0.3.X/v0.3.0.html"
     *   rtw.url("v0.2.12-cb");   // "https://cdn.jsdelivr.net/gh/USER/REPO/chromebook/v0.2.12-cb.html"
     */
    url(version) {
      if (!version) throw new Error("version is required.");

      // Chromebook build — strip "-cb" suffix for parsing, place in /chromebook/
      if (version.endsWith("-cb")) {
        return `${CDN}/chromebook/${version}.html`;
      }

      // Standard build — derive the minor-series folder (e.g. "v0.3.X")
      const match = version.match(/^v(\d+)\.(\d+)\.\d+$/);
      if (!match) throw new Error(`Unrecognised version format: ${version}`);

      const [, major, minor] = match;
      return `${CDN}/v0.X.X/v${major}.${minor}.X/${version}.html`;
    },

    /**
     * getVersionInfo(version)
     * Returns a structured info object for a version: its string, CDN URL, and badges.
     *
     * @param {string} version
     * @returns {{ version: string, url: string, badges: string[] }}
     *
     * Example:
     *   rtw.getVersionInfo("v0.3.0");
     *   // { version: "v0.3.0", url: "https://...", badges: ["latest"] }
     */
    getVersionInfo(version) {
      if (!_cache) throw new Error("Call rtw.load() first.");

      const badges = [...(_cache.badges[version] || [])];

      // Dynamically append "latest" if this version is the current highest
      // non-broken semver — no need to manually maintain it in badges.json
      if (version === this.latest()) badges.push("latest");

      return { version, url: this.url(version), badges };
    },

    /**
     * launch(version, iframeId)
     * Sets the src of an existing <iframe> element to the version's CDN URL.
     * Defaults to the element with id="gameFrame".
     *
     * @param {string} version
     * @param {string} [iframeId="gameFrame"]
     *
     * Example:
     *   // <iframe id="gameFrame"></iframe>
     *   rtw.launch("v0.3.0");
     *   rtw.launch("v0.2.12-cb", "myFrame");
     */
    launch(version, iframeId = "gameFrame") {
      const frame = document.getElementById(iframeId);
      if (!frame) throw new Error(`No element found with id="${iframeId}".`);
      frame.src = this.url(version);
    },

    /**
     * embed(version, elementId)
     * Creates and injects a full-size <iframe> into a container element.
     * Replaces any existing content in the container.
     *
     * @param {string} version
     * @param {string} elementId  ID of the container element
     *
     * Example:
     *   // <div id="gameContainer"></div>
     *   rtw.embed("v0.3.0", "gameContainer");
     */
    embed(version, elementId) {
      const container = document.getElementById(elementId);
      if (!container) throw new Error(`No element found with id="${elementId}".`);

      const iframe = document.createElement("iframe");
      iframe.src             = this.url(version);
      iframe.width           = "100%";
      iframe.height          = "100%";
      iframe.style.border    = "none";
      iframe.allowFullscreen = true;
      // Sandbox: allow scripts and same-origin access inside the game iframe
      iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-pointer-lock");

      container.innerHTML = ""; // Clear previous content
      container.appendChild(iframe);
    },

    /**
     * isChromebook()
     * Returns true when the browser is confidently identified as running on
     * Chrome OS / ChromeOS. Uses two independent signals so either one is
     * sufficient — a device only needs to match one to qualify:
     *
     *   1. User-agent contains "CrOS" — the definitive Chrome OS token that
     *      Google injects into every Chromebook UA string regardless of channel.
     *      e.g. "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/..."
     *
     *   2. navigator.platform is exactly "Linux x86_64" AND the browser is
     *      Chromium-based (checks for window.chrome). This catches Chromebooks
     *      in some legacy or developer-mode UA overrides where "CrOS" may be
     *      absent, but plain Linux desktops running Chrome will also match —
     *      which is intentional: they benefit from the lightweight build too.
     *
     * @returns {boolean}
     *
     * Example:
     *   if (rtw.isChromebook()) { rtw.launch(rtw.chromebook()[0]); }
     */
    isChromebook() {
      const ua       = navigator.userAgent || "";
      const platform = navigator.platform  || "";

      // Signal 1: Chrome OS user-agent token — most reliable signal
      if (ua.includes("CrOS")) return true;

      // Signal 2: Linux x86_64 + Chromium-based browser (covers dev-mode CBs
      // and Linux machines running Chrome, both of which suit the CB build)
      if (platform === "Linux x86_64" && typeof window.chrome !== "undefined") return true;

      return false;
    },

    /**
     * isLowPower()
     * Returns true when the device reports 4 or fewer logical CPU cores.
     * Chromebooks and entry-level devices typically fall into this range.
     * Used as a secondary performance signal alongside isChromebook().
     *
     * @returns {boolean}
     *
     * Example:
     *   if (rtw.isLowPower()) { ... }
     */
    isLowPower() {
      return (navigator.hardwareConcurrency || 4) <= 4;
    },

    /**
     * auto(version)
     * Smart version resolver. Automatically substitutes the nearest available
     * Chromebook build when the device is identified as a Chromebook OR is
     * a low-power device — whichever signal fires first.
     * Falls back to the supplied version if no Chromebook build is found.
     *
     * @param {string} version  Preferred version (e.g. from latest())
     * @returns {string}        Resolved version string
     *
     * Example:
     *   rtw.launch(rtw.auto(rtw.latest()));
     */
    auto(version) {
      if (!_cache) throw new Error("Call rtw.load() first.");

      if ((this.isChromebook() || this.isLowPower()) && _cache.chromebook.length) {
        // Prefer a Chromebook build that shares the same minor version
        const match = version.match(/^v\d+\.(\d+)\./);
        const minor = match ? match[1] : null;

        const sameSeries = minor
          ? _cache.chromebook.find(cb => cb.includes(`.${minor}.`))
          : null;

        // Return the matched series build, or fall back to the latest cb build
        return sameSeries || _cache.chromebook[_cache.chromebook.length - 1];
      }

      return version;
    }

  };

  // ─── Attach to global namespace ───────────────────────────────────────────────
  // Exposed as window.rtw — short for "Remake The World"
  window.rtw = rtw;

})();
