# Remake The World

A versioned browser game with a lightweight JavaScript API for embedding, launching, and managing game builds — including dedicated Chromebook builds for low-power devices.

> **Play the latest version →** [remaketheworld.gamer.gd](https://remaketheworld.gamer.gd)

---

## Playing the Game

Open `index.html` or visit the official link above. The game runs entirely in your browser — no installation, no accounts, no downloads.

If you are on a **Chromebook or low-power device**, a lighter build will be loaded automatically.

---

## Versions

All builds are self-contained HTML files. See [VERSIONS.md](https://github.com/DA-COMPUTER/remaketheworld/blob/main/VERSIONS.md) for the full changelog.

| Series | Builds | Notes |
|--------|--------|-------|
| v0.3.X | v0.3.0 | Current release |
| v0.2.X | v0.2.0 – v0.2.12 | v0.2.6 is broken |
| v0.1.X | v0.1.2 – v0.1.9 | Early builds |
| Chromebook | v0.2.9-cb, v0.2.12-cb | Optimised for low-power devices |

---

## Repository Structure

```
remake-the-world/
├── api/
│   ├── game-api.js       ← JavaScript API (window.rtw)
│   └── badges.json       ← Version metadata (latest, broken, chromebook)
├── chromebook/           ← Chromebook-optimised builds
├── v0.X.X/               ← Standard builds organised by minor series
│   ├── v0.1.X/
│   ├── v0.2.X/
│   └── v0.3.X/
├── index.html            ← Landing page
└── VERSIONS.md           ← Full version history
```

---

## JavaScript API (`window.rtw`)

The API is served via jsDelivr and can be included on any webpage.

```html
<script src="https://cdn.jsdelivr.net/gh/DA-COMPUTER/remake-the-world/api/game-api.js"></script>
```

Call `rtw.load()` once before using any other method — it scans the repository and fetches badge data, then caches the results.

### Methods

#### Loading & Discovery

```javascript
await rtw.load()
// Scans the repo file tree and fetches badges.json.
// Must be called before anything else. Safe to call multiple times (cached).

rtw.list()
// Returns all standard versions, sorted oldest → newest.
// Excludes broken versions automatically.
// → ["v0.1.2", "v0.1.3", ..., "v0.3.0"]

rtw.chromebook()
// Returns all Chromebook build version strings.
// → ["v0.2.9-cb", "v0.2.12-cb"]

rtw.latest()
// Returns the highest non-broken version.
// → "v0.3.0"

rtw.random()
// Returns a random non-broken version.
// → "v0.2.11"
```

#### Version Info & URLs

```javascript
rtw.url("v0.3.0")
// Returns the full jsDelivr CDN URL for a version.
// → "https://cdn.jsdelivr.net/gh/.../v0.X.X/v0.3.X/v0.3.0.html"

rtw.url("v0.2.12-cb")
// Chromebook builds resolve to the /chromebook/ path automatically.
// → "https://cdn.jsdelivr.net/gh/.../chromebook/v0.2.12-cb.html"

rtw.getVersionInfo("v0.3.0")
// Returns a full info object for a version.
// → { version: "v0.3.0", url: "https://...", badges: ["latest"] }
```

#### Launching & Embedding

```javascript
rtw.launch("v0.3.0")
// Sets the src of an existing <iframe id="gameFrame"> to the version URL.

rtw.launch("v0.3.0", "myFrame")
// Targets a specific iframe by id.

rtw.embed("v0.3.0", "gameContainer")
// Creates and injects an <iframe> into a container element, replacing any existing content.
```

#### Device Helpers

```javascript
rtw.isChromebook()
// Returns true if the browser reports a Chrome OS user-agent ("CrOS"),
// or if the platform is "Linux x86_64" with a Chromium-based browser.

rtw.isLowPower()
// Returns true if navigator.hardwareConcurrency is 4 or fewer cores.

rtw.auto("v0.3.0")
// Smart resolver: returns a Chromebook build automatically if isChromebook()
// or isLowPower() is true and a CB build is available. Otherwise returns the
// version unchanged. Prefers a build from the same minor series.
```

---

## Usage Examples

### Minimal setup — load and play latest

```html
<iframe id="gameFrame" width="100%" height="600" style="border:none;"></iframe>

<script src="https://cdn.jsdelivr.net/gh/DA-COMPUTER/remake-the-world/api/game-api.js"></script>
<script>
  async function start() {
    await rtw.load();
    rtw.launch(rtw.latest());
  }
  start();
</script>
```

### Auto-detect Chromebook and embed

```html
<div id="gameContainer" style="width:100%;height:100vh;"></div>

<script src="https://cdn.jsdelivr.net/gh/DA-COMPUTER/remake-the-world/api/game-api.js"></script>
<script>
  async function start() {
    await rtw.load();
    // Loads a Chromebook build automatically on low-power or Chrome OS devices
    rtw.embed(rtw.auto(rtw.latest()), "gameContainer");
  }
  start();
</script>
```

### Version picker

```html
<select id="versionPicker"></select>
<iframe id="gameFrame" width="100%" height="600" style="border:none;"></iframe>

<script src="https://cdn.jsdelivr.net/gh/DA-COMPUTER/remake-the-world/api/game-api.js"></script>
<script>
  async function start() {
    await rtw.load();

    const picker = document.getElementById("versionPicker");

    // Populate dropdown with all non-broken versions, newest first
    rtw.list().reverse().forEach(v => {
      const opt = document.createElement("option");
      const info = rtw.getVersionInfo(v);
      opt.value = v;
      opt.textContent = info.badges.length ? `${v} [${info.badges.join(", ")}]` : v;
      picker.appendChild(opt);
    });

    // Launch selected version on change
    picker.addEventListener("change", () => rtw.launch(picker.value));

    // Launch latest on page load
    rtw.launch(rtw.latest());
  }
  start();
</script>
```

### Play a random version

```javascript
await rtw.load();
rtw.launch(rtw.random());
```

---

## Badges

Version metadata is stored in [`api/badges.json`](https://github.com/DA-COMPUTER/remaketheworld/blob/main/api/badges.json).

| Badge | Meaning |
|-------|---------|
| `"latest"` | Marks the current recommended release (informational) |
| `"chromebook"` | Marks a Chromebook-optimised build (informational) |
| `"broken"` | Hides the version from `list()`, `latest()`, and `random()` |

---

## CDN URLs

All files are served via [jsDelivr](https://www.jsdelivr.com/) from this public GitHub repository. No sign-up or configuration is required.

| File | URL |
|------|-----|
| API script | `https://cdn.jsdelivr.net/gh/DA-COMPUTER/remake-the-world/api/game-api.js` |
| Badges | `https://cdn.jsdelivr.net/gh/DA-COMPUTER/remake-the-world/api/badges.json` |
| Latest build | `https://cdn.jsdelivr.net/gh/DA-COMPUTER/remake-the-world/v0.X.X/v0.3.X/v0.3.0.html` |
| File tree | `https://data.jsdelivr.com/v1/package/gh/DA-COMPUTER/remake-the-world` |

> jsDelivr caches files for up to 24 hours after a push. During development, append `@COMMIT_HASH` to any URL to bypass the cache.

---

## License

This project is licensed under the **GNU General Public License v3.0**.
See [LICENSE](https://github.com/DA-COMPUTER/remaketheworld/blob/main/LICENSE) for the full terms.

In short: you are free to play, share, and modify this game, but any distributed modifications must also be released under GPL v3.
