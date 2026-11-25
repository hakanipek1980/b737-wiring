(() => {
  "use strict";

  const DB_PATH = "./data/wiring-db.json";
  const MAX_SELECTOR_PILLS = 24;
  const STORAGE_KEYS = {
    theme: "b737-wiring-theme-v2",
    recent: "b737-wiring-recent-v2",
    favorites: "b737-wiring-favorites-v2",
  };

  const state = {
    db: null,
    activeTab: "connectors",
    aircraftFilter: "all",
    layerFilter: "all",
    query: "",
    ewisOnly: false,
    showTemplates: true,
    selectedIds: {
      connectors: null,
      splices: null,
      procedures: null,
      decoder: null,
    },
    activeImageIndex: 0,
    activeImageCat: "all",
    acHighlightIndex: -1,
    recentSearches: [],
    favorites: [],
  };

  const el = {
    disclaimerText: document.getElementById("disclaimer-text"),
    heroTelemetry: document.getElementById("hero-telemetry"),
    heroInput: document.getElementById("hero-search-input"),
    heroClearBtn: document.getElementById("hero-clear-btn"),
    autocompleteList: document.getElementById("autocomplete-list"),
    favoritesStrip: document.getElementById("favorites-strip"),
    favoritesChips: document.getElementById("favorites-chips"),
    recentStrip: document.getElementById("recent-strip"),
    recentChips: document.getElementById("recent-chips"),
    searchScopeHint: document.getElementById("search-scope-hint"),
    ewisToggle: document.getElementById("ewis-only-toggle"),
    templatesToggle: document.getElementById("show-templates-toggle"),
    themeToggle: document.getElementById("theme-toggle"),
    themeIcon: document.getElementById("theme-icon"),
    themeLabel: document.getElementById("theme-label"),
    dataNotice: document.getElementById("data-notice"),
    globalNotFound: document.getElementById("global-not-found"),
    splitWorkbench: document.getElementById("split-workbench"),

    countConnectors: document.getElementById("count-connectors"),
    countSplices: document.getElementById("count-splices"),
    countProcedures: document.getElementById("count-procedures"),
    countDecoder: document.getElementById("count-decoder"),
    countSources: document.getElementById("count-sources"),

    connectorsSelector: document.getElementById("connectors-selector"),
    connectorsDetail: document.getElementById("connectors-detail"),
    splicesSelector: document.getElementById("splices-selector"),
    splicesDetail: document.getElementById("splices-detail"),
    proceduresSelector: document.getElementById("procedures-selector"),
    proceduresDetail: document.getElementById("procedures-detail"),
    decoderDetail: document.getElementById("decoder-detail"),

    wireCodeInput: document.getElementById("wire-code-input"),
    wireDecodeBtn: document.getElementById("wire-decode-btn"),
    wireDecodeOutput: document.getElementById("wire-decode-output"),

    visualTitle: document.getElementById("visual-title"),
    visualZoomBtn: document.getElementById("visual-zoom-btn"),
    visualCatTabs: document.getElementById("visual-cat-tabs"),
    blueprintStage: document.getElementById("blueprint-stage"),
    visualThumbs: document.getElementById("visual-thumbs"),
    visualFooter: document.getElementById("visual-footer"),

    sourcesKpis: document.getElementById("sources-kpis"),
    sourcesList: document.getElementById("sources-list"),
    jsonFileInput: document.getElementById("json-file-input"),
    footerMeta: document.getElementById("footer-meta"),

    lightboxModal: document.getElementById("lightbox-modal"),
    lightboxCaption: document.getElementById("lightbox-caption"),
    lightboxZoomReadout: document.getElementById("lightbox-zoom-readout"),
    lightboxImg: document.getElementById("lightbox-img"),
    lightboxClose: document.getElementById("lightbox-close"),
    toast: document.getElementById("toast"),
  };

  let toastTimer = null;

  /* ========================================================================
     UTILITIES
     ======================================================================== */
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2000);
  }

  async function copyText(text, btn) {
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = "Copied";
        btn.classList.add("copied");
        setTimeout(() => {
          btn.textContent = orig;
          btn.classList.remove("copied");
        }, 1200);
      }
      showToast(`Copied: ${text}`);
    } catch {
      showToast("Clipboard copy failed");
    }
  }

  function copyableCell(value, allowCopy = true) {
    const clean = value || "—";
    const isPlaceholder =
      !value ||
      value === "—" ||
      value === "N/A" ||
      String(value).startsWith("[");
    if (!allowCopy || isPlaceholder) {
      return `<span class="mono-val">${escapeHtml(clean)}</span>`;
    }
    return `
      <span class="copy-cell">
        <span class="mono-val">${escapeHtml(clean)}</span>
        <button type="button" class="copy-btn" data-copy="${escapeHtml(clean)}">Copy</button>
      </span>
    `;
  }

  function buildDatasheetUrl(term) {
    return `https://www.google.com/search?q=${encodeURIComponent(`${term} aerospace datasheet connector pinout`)}`;
  }

  function buildImageSearchUrl(term) {
    return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${term} aerospace connector diagram`)}`;
  }

  function loadPersistedState() {
    try {
      state.recentSearches = JSON.parse(localStorage.getItem(STORAGE_KEYS.recent) || "[]");
      state.favorites = JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites) || "[]");
    } catch {
      state.recentSearches = [];
      state.favorites = [];
    }
  }

  function saveRecent(term) {
    const clean = term.trim();
    if (clean.length < 2) return;
    state.recentSearches = [clean, ...state.recentSearches.filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
    try {
      localStorage.setItem(STORAGE_KEYS.recent, JSON.stringify(state.recentSearches));
    } catch {
      /* ignore */
    }
    renderQuickChips();
  }

  function toggleFavorite(id, label, tab) {
    const exists = state.favorites.some((f) => f.id === id);
    if (exists) {
      state.favorites = state.favorites.filter((f) => f.id !== id);
      showToast("Removed from pinned favorites");
    } else {
      state.favorites = [{ id, label, tab }, ...state.favorites].slice(0, 8);
      showToast(`Pinned: ${label}`);
    }
    try {
      localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(state.favorites));
    } catch {
      /* ignore */
    }
    renderQuickChips();
    renderActiveWorkspace();
  }

  function isFavorite(id) {
    return state.favorites.some((f) => f.id === id);
  }

  /* ========================================================================
     THEME MANAGEMENT
     ======================================================================== */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    el.themeLabel.textContent = theme === "dark" ? "Daylight" : "Avionics Dark";
    if (el.themeIcon) {
      el.themeIcon.innerHTML =
        theme === "dark"
          ? `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`
          : `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.theme) || "dark";
    applyTheme(saved);
    el.themeToggle.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem(STORAGE_KEYS.theme, next);
      } catch {
        /* ignore */
      }
    });
  }

  /* ========================================================================
     SWPM SERIES EXPANSION & SEARCH INDEXING (FAST <5ms FOR 5000+ RECORDS)
     ======================================================================== */
  function getSeriesProfile(item) {
    if (!item?.swpmSeriesKey || !state.db?.swpmSeriesMap) return null;
    return state.db.swpmSeriesMap[item.swpmSeriesKey] || null;
  }

  function getResolvedContacts(item) {
    if (Array.isArray(item.contacts) && item.contacts.length > 0) return item.contacts;
    const profile = getSeriesProfile(item);
    return profile?.contacts || [];
  }

  function getResolvedSuperseding(item) {
    if (Array.isArray(item.supersedingPns) && item.supersedingPns.length > 0) return item.supersedingPns;
    const profile = getSeriesProfile(item);
    return profile?.supersedingPns || [];
  }

  function buildSearchIndex() {
    if (!state.db) return;
    const seriesSearchCache = {};
    const seriesMap = state.db.swpmSeriesMap || {};
    Object.keys(seriesMap).forEach((k) => {
      const p = seriesMap[k];
      const ct = (p.contacts || []).map((c) => Object.values(c).join(" ")).join(" ");
      const sp = (p.supersedingPns || []).map((s) => `${s.partNumber} ${s.notes || ""}`).join(" ");
      seriesSearchCache[k] = `${p.seriesName || ""} ${p.swpmRef || ""} ${ct} ${sp}`.toLowerCase();
    });

    (state.db.connectors || []).forEach((item) => {
      const accArr = Array.isArray(item.accessories) ? item.accessories : (item.accessories ? [item.accessories] : []);
      const pinArr = Array.isArray(item.hookupPins) ? item.hookupPins : (item.hookupPins && typeof item.hookupPins === "object" ? [item.hookupPins] : []);
      const acc = accArr.join(" ");
      const pins = pinArr.map((p) => `${p.bundle || ""} ${p.wire || ""} ${p.diagram || ""}`).join(" ");
      const sText = item.swpmSeriesKey ? seriesSearchCache[item.swpmSeriesKey] || "" : "";
      item._search = `${item.wdmRef || ""} ${item.connectorPn || ""} ${item.title || ""} ${item.connectorType || ""} ${item.location || ""} ${item.effectivity || ""} ${item.wdmDiagrams || ""} ${acc} ${pins} ${item.sourceRef?.chapterSection || ""} ${sText}`.toLowerCase();
      item._key = `${(item.wdmRef || "").toLowerCase()} ${(item.connectorPn || "").toLowerCase()}`;
    });

    (state.db.splicesAndTerminals || []).forEach((item) => {
      item._search = `${item.partNumber || ""} ${item.category || ""} ${item.title || ""} ${item.wireRangeAwg || ""} ${item.dieOrLocator || ""} ${item.torqueOrLimit || ""} ${item.notes || ""}`.toLowerCase();
      item._key = (item.partNumber || "").toLowerCase();
    });

    (state.db.swpmProcedures || []).forEach((item) => {
      item._search = `${item.swpmRef || ""} ${item.category || ""} ${item.title || ""} ${item.summary || ""} ${(item.toolsRequired || []).join(" ")} ${(item.steps || []).join(" ")} ${(item.warnings || []).join(" ")}`.toLowerCase();
      item._key = (item.swpmRef || "").toLowerCase();
    });

    (state.db.wireDecoders || []).forEach((item) => {
      item._search = `${item.title || ""} ${item.specType || ""} ${item.patternExample || ""} ${item.summary || ""} ${(item.segments || []).map((s) => `${s.token} ${s.meaning}`).join(" ")}`.toLowerCase();
      item._key = (item.specType || "").toLowerCase();
    });
  }

  function passesCommonFilters(item) {
    if (!state.showTemplates && item.isTemplate) return false;
    if (state.ewisOnly && !item.ewisCritical && item.ewisLevel !== "EWIS CRITICAL") return false;
    if (state.aircraftFilter !== "all") {
      if (!Array.isArray(item.aircraft) || !item.aircraft.includes(state.aircraftFilter)) {
        return false;
      }
    }
    if (state.layerFilter !== "all") {
      if ((item.layer || "primary-737") !== state.layerFilter) {
        return false;
      }
    }
    return true;
  }

  function getFilteredRecords(tab) {
    if (!state.db) return [];
    const map = {
      connectors: state.db.connectors || [],
      splices: state.db.splicesAndTerminals || [],
      procedures: state.db.swpmProcedures || [],
      decoder: state.db.wireDecoders || [],
    };
    const q = state.query.trim().toLowerCase();
    const list = map[tab] || [];
    const exact = [];
    const prefix = [];
    const rest = [];

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (!passesCommonFilters(item)) continue;
      if (!q) {
        rest.push(item);
        continue;
      }
      if (!item._search || !item._search.includes(q)) continue;
      const wdm = (item.wdmRef || item.partNumber || "").toLowerCase();
      const pn = (item.connectorPn || "").toLowerCase();
      if (wdm === q || pn === q) {
        exact.push(item);
      } else if (wdm.startsWith(q) || pn.startsWith(q)) {
        prefix.push(item);
      } else {
        rest.push(item);
      }
    }
    return exact.concat(prefix, rest);
  }

  function getRecordPrimaryLabel(tab, item) {
    if (tab === "connectors") {
      return item.wdmRef && !item.wdmRef.startsWith("[")
        ? `${item.wdmRef} · ${item.connectorPn}`
        : item.connectorPn;
    }
    if (tab === "splices") return item.partNumber;
    if (tab === "procedures") return item.swpmRef;
    return item.title;
  }

  function getRecordLookupTerm(tab, item) {
    if (!item) return "";
    if (tab === "connectors") return item.connectorPn;
    if (tab === "splices") return item.partNumber;
    if (tab === "procedures") return item.swpmRef;
    return item.specType || item.title;
  }

  function renderStatusBadges(item) {
    const verifiedBadge = item.verified
      ? `<span class="badge badge-verified">VERIFIED SOURCE</span>`
      : `<span class="badge badge-template">SCHEMA PREVIEW</span>`;
    const layerBadge =
      item.layer === "secondary-industry"
        ? `<span class="badge badge-secondary">SECONDARY &bull; INDUSTRY TOOLING</span>`
        : `<span class="badge badge-primary">PRIMARY &bull; 737 SWPM / WDM</span>`;
    const ewisBadge =
      item.ewisCritical || item.ewisLevel === "EWIS CRITICAL"
        ? `<span class="badge badge-ewis">EWIS CRITICAL</span>`
        : "";
    const aircraftBadges = (item.aircraft || [])
      .map((ac) => `<span class="badge badge-neutral">${escapeHtml(ac)}</span>`)
      .join("");
    return `${verifiedBadge}${layerBadge}${ewisBadge}${aircraftBadges}`;
  }

  /* ========================================================================
     RENDERING: QUICK CHIPS & AUTOCOMPLETE
     ======================================================================== */
  function renderQuickChips() {
    if (state.favorites.length > 0) {
      el.favoritesStrip.classList.remove("hidden");
      el.favoritesChips.innerHTML = state.favorites
        .map(
          (f) => `
            <button type="button" class="quick-chip fav-chip" data-jump-tab="${escapeHtml(f.tab)}" data-jump-id="${escapeHtml(f.id)}">
              &#9733; ${escapeHtml(f.label)}
            </button>
          `
        )
        .join("");
    } else {
      el.favoritesStrip.classList.add("hidden");
    }

    if (state.recentSearches.length > 0) {
      el.recentStrip.classList.remove("hidden");
      el.recentChips.innerHTML = state.recentSearches
        .map(
          (term) => `
            <button type="button" class="quick-chip" data-recent-term="${escapeHtml(term)}">
              ${escapeHtml(term)}
            </button>
          `
        )
        .join("");
    } else {
      el.recentStrip.classList.add("hidden");
    }

    if (el.searchScopeHint) {
      const hasQuickChips = state.favorites.length > 0 || state.recentSearches.length > 0;
      el.searchScopeHint.classList.toggle("hidden", hasQuickChips);
    }
  }

  function renderAutocomplete() {
    const q = state.query.trim();
    if (!q) {
      el.autocompleteList.classList.add("hidden");
      state.acHighlightIndex = -1;
      return;
    }

    const tabs = [
      { key: "connectors", label: "Connectors" },
      { key: "splices", label: "Splices / Gnd" },
      { key: "procedures", label: "SWPM Ch. 20" },
      { key: "decoder", label: "Decoder" },
    ];

    const suggestions = [];
    for (const t of tabs) {
      const hits = getFilteredRecords(t.key);
      for (let i = 0; i < Math.min(hits.length, 6); i++) {
        const item = hits[i];
        suggestions.push({
          tab: t.key,
          tabLabel: t.label,
          id: item.id,
          code: getRecordPrimaryLabel(t.key, item),
          title: item.title,
          verified: Boolean(item.verified),
        });
        if (suggestions.length >= 10) break;
      }
      if (suggestions.length >= 10) break;
    }

    if (suggestions.length === 0) {
      el.autocompleteList.innerHTML = `
        <div class="ac-item" style="cursor:default;">
          <div class="ac-main">
            <span class="ac-code" style="color:var(--amber);">Not found in registered SWPM sources</span>
            <span class="ac-title">No verified record matches "${escapeHtml(q)}" — zero fabricated data generated.</span>
          </div>
        </div>
      `;
      el.autocompleteList.classList.remove("hidden");
      state.acHighlightIndex = -1;
      return;
    }

    el.autocompleteList.innerHTML = suggestions
      .map(
        (s, idx) => `
          <button type="button" class="ac-item ${idx === state.acHighlightIndex ? "active" : ""}" role="option" data-ac-tab="${escapeHtml(s.tab)}" data-ac-id="${escapeHtml(s.id)}">
            <div class="ac-main">
              <span class="ac-code">${escapeHtml(s.code)}</span>
              <span class="ac-title">${escapeHtml(s.title)}</span>
            </div>
            <div class="ac-meta">
              <span class="badge badge-neutral">${escapeHtml(s.tabLabel)}</span>
              <span class="badge ${s.verified ? "badge-verified" : "badge-template"}">${s.verified ? "VERIFIED" : "SCHEMA"}</span>
            </div>
          </button>
        `
      )
      .join("");

    el.autocompleteList.classList.remove("hidden");
  }

  /* ========================================================================
     RENDERING: LEFT COLUMN MODULES
     ======================================================================== */
  function renderTemplateRibbon(item) {
    if (!item?.isTemplate) return "";
    return `
      <div class="template-ribbon">
        <span>SCHEMA PREVIEW &bull; ZERO FABRICATED PART NUMBERS</span>
        <span>Awaiting verified 737NG / 737MAX source in context/kaynaklar/</span>
      </div>
    `;
  }

  function renderMatchSelector(container, tab, records, activeId) {
    // Connectors & Splices are navigated via Hero Search + live Autocomplete;
    // keep the compact selector pills only on small reference tabs (Procedures / Decoder).
    if (tab === "connectors" || tab === "splices" || records.length <= 1) {
      container.classList.add("hidden");
      container.innerHTML = "";
      return;
    }
    container.classList.remove("hidden");
    const visible = records.slice(0, MAX_SELECTOR_PILLS);
    const remaining = records.length - visible.length;

    container.innerHTML =
      visible
        .map((item) => {
          const label = getRecordPrimaryLabel(tab, item);
          return `
            <button type="button" class="match-pill ${item.id === activeId ? "active" : ""}" data-select-tab="${escapeHtml(tab)}" data-select-id="${escapeHtml(item.id)}">
              ${escapeHtml(label)}
            </button>
          `;
        })
        .join("") +
      (remaining > 0
        ? `<span class="badge badge-neutral" style="align-self:center;">+${remaining.toLocaleString()} more &bull; refine search</span>`
        : "");
  }

  function renderConnectorDetail(item) {
    if (!item) {
      el.connectorsDetail.innerHTML = renderModuleEmpty("Connectors & Tooling");
      return;
    }

    const contacts = getResolvedContacts(item);
    const superseding = getResolvedSuperseding(item);
    const profile = getSeriesProfile(item);

    const contactsRows =
      contacts.length > 0
        ? contacts
            .map(
              (c) => `
                <tr>
                  <td>
                    <div class="cell-stack">
                      <div>${copyableCell(c.contactPn)}</div>
                      <div class="cell-sub">
                        <span class="role-tag">${escapeHtml(c.role || "Contact")}</span>
                        <span>AWG: <span class="mono-val">${escapeHtml(c.wireGaugeAwg || "—")}</span></span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="cell-stack">
                      <div>${copyableCell(c.crimpToolPn)}</div>
                      <div class="cell-sub">
                        <span>Turret/Pos: ${copyableCell(c.turretPositionerPn)}</span>
                        ${c.selectorSetting ? `<span>&bull; <span class="mono-val">${escapeHtml(c.selectorSetting)}</span></span>` : ""}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="cell-stack">
                      <div>${copyableCell(c.insRemToolPn)}</div>
                      ${c.insRemToolType ? `<div class="cell-sub">${escapeHtml(c.insRemToolType)}</div>` : ""}
                    </div>
                  </td>
                  <td><span class="mono-val">${escapeHtml(c.stripLength || "—")}</span></td>
                </tr>
              `
            )
            .join("")
        : `<tr><td colspan="4" class="muted">SWPM Chapter 20 contact/tooling table is not auto-mapped for series <code>${escapeHtml(item.connectorPn)}</code> yet — verify directly in SWPM Chapter 20.</td></tr>`;

    const supRows =
      superseding.length > 0
        ? superseding
            .map(
              (s) => `
                <tr>
                  <td>${escapeHtml(s.relation || "Alternate")}</td>
                  <td>${copyableCell(s.partNumber)}</td>
                  <td>${escapeHtml(s.notes || "—")}</td>
                </tr>
              `
            )
            .join("")
        : `<tr><td colspan="3" class="muted">No alternate or superseding part numbers listed in mapped source.</td></tr>`;

    const accessoriesHtml =
      Array.isArray(item.accessories) && item.accessories.length > 0
        ? `<div class="tools-chips">${item.accessories.map((a) => `<span class="tool-chip">${escapeHtml(a)}</span>`).join("")}</div>`
        : "";

    const hookupHtml =
      Array.isArray(item.hookupPins) && item.hookupPins.length > 0
        ? `
          <h4 class="section-label">WDM 91-21-51 Hookup / Pin-Out Sample (${item.hookupPins.length} shown)</h4>
          <div class="tech-table-wrap">
            <table class="tech-table compact-table">
              <thead>
                <tr>
                  <th>Pin / Term</th>
                  <th>Bundle</th>
                  <th>Wire #</th>
                  <th>AWG</th>
                  <th>WDM Diagram</th>
                  <th>Effectivity</th>
                </tr>
              </thead>
              <tbody>
                ${item.hookupPins
                  .map(
                    (p) => `
                      <tr>
                        <td><span class="mono-val">${escapeHtml(p.pin)}</span></td>
                        <td><span class="mono-val">${escapeHtml(p.bundle)}</span></td>
                        <td>${copyableCell(p.wire)}</td>
                        <td><span class="mono-val">${escapeHtml(p.awg)}</span></td>
                        <td><span class="mono-val">${escapeHtml(p.diagram)}</span></td>
                        <td><span class="mono-val" style="font-size:0.75rem;">${escapeHtml(p.eff)}</span></td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        `
        : "";

    const starred = isFavorite(item.id);
    const favLabel = getRecordPrimaryLabel("connectors", item);

    el.connectorsDetail.innerHTML = `
      <article class="spec-sheet ${item.isTemplate ? "is-template" : ""}">
        ${renderTemplateRibbon(item)}
        <div class="sheet-header">
          <div>
            <div class="sheet-id-row">
              <span class="wdm-ref-pill">${escapeHtml(item.wdmRef || "WDM REF —")}</span>
              <span class="hero-pn">${escapeHtml(item.connectorPn)}</span>
            </div>
            <p class="sheet-subtitle">${escapeHtml(item.title)}</p>
          </div>

          <div class="sheet-actions">
            ${
              !item.connectorPn.startsWith("[")
                ? `<button type="button" class="secondary-btn compact-btn" data-copy="${escapeHtml(item.connectorPn)}">Copy P/N</button>`
                : ""
            }
            <button type="button" class="star-btn ${starred ? "starred" : ""}" data-fav-id="${escapeHtml(item.id)}" data-fav-label="${escapeHtml(favLabel)}" data-fav-tab="connectors" title="Pin to Favorites">
              ${starred ? "&#9733;" : "&#9734;"}
            </button>
          </div>
        </div>

        <div class="badge-row">${renderStatusBadges(item)}</div>

        <h4 class="section-label">Connector Configuration &amp; WDM Identity</h4>
        <div class="tech-table-wrap">
          <table class="tech-table kv-table">
            <tbody>
              <tr><th>Connector P/N</th><td>${copyableCell(item.connectorPn)}</td></tr>
              <tr><th>Equipment No (WDM Ref)</th><td>${copyableCell(item.wdmRef)}</td></tr>
              <tr><th>Connector Type / Series</th><td>${escapeHtml(item.connectorType || "—")} ${profile ? `<span class="badge badge-primary" style="margin-left:0.35rem;">${escapeHtml(profile.swpmRef)}</span>` : ""}</td></tr>
              <tr><th>Insert / Hookup Summary</th><td><span class="mono-val">${escapeHtml(item.insertArrangement || "—")}</span></td></tr>
              ${item.location ? `<tr><th>Location (STA / WL / BL)</th><td><span class="mono-val">${escapeHtml(item.location)}</span> ${item.cageCode ? `&bull; CAGE <span class="mono-val">${escapeHtml(item.cageCode)}</span>` : ""}</td></tr>` : ""}
              ${item.effectivity ? `<tr><th>Fleet Effectivity</th><td><span class="mono-val" style="font-size:0.8rem;">${escapeHtml(item.effectivity)}</span></td></tr>` : ""}
              <tr><th>SWPM / WDM Reference</th><td><span class="mono-val">${escapeHtml(item.sourceRef?.chapterSection || "—")}</span> &bull; ${escapeHtml(item.sourceRef?.page || "—")}</td></tr>
            </tbody>
          </table>
        </div>

        ${accessoriesHtml ? `<h4 class="section-label">Backshell / Clamp Accessories (WDM Equipment List)</h4>${accessoriesHtml}` : ""}

        <h4 class="section-label">Compatible Contacts, Wire Gauge &amp; Tooling Matrix</h4>
        <div class="tech-table-wrap">
          <table class="tech-table compact-table">
            <thead>
              <tr>
                <th>Contact P/N &amp; AWG</th>
                <th>Crimp Tool &amp; Turret / Selector</th>
                <th>Insertion / Removal Tool</th>
                <th>Strip Length</th>
              </tr>
            </thead>
            <tbody>${contactsRows}</tbody>
          </table>
        </div>

        ${hookupHtml}

        <h4 class="section-label">Alternate / Superseding Part Numbers</h4>
        <div class="tech-table-wrap">
          <table class="tech-table compact-table">
            <thead>
              <tr>
                <th>Relation</th>
                <th>Part Number</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>${supRows}</tbody>
          </table>
        </div>

        ${item.notes ? `<div class="note-box"><strong>Technical Notes:</strong> ${escapeHtml(item.notes)}</div>` : ""}

        <div class="source-trace">
          <span><strong>Manual:</strong> ${escapeHtml(item.sourceRef?.manual || "—")}</span>
          <span><strong>Section:</strong> ${escapeHtml(item.sourceRef?.chapterSection || "—")}</span>
          <span><strong>Rev:</strong> ${escapeHtml(item.sourceRef?.revision || "—")}</span>
        </div>
      </article>
    `;
  }

  function renderSpliceDetail(item) {
    if (!item) {
      el.splicesDetail.innerHTML = renderModuleEmpty("Splices, Terminals & Grounding");
      return;
    }

    const starred = isFavorite(item.id);
    const favLabel = getRecordPrimaryLabel("splices", item);

    el.splicesDetail.innerHTML = `
      <article class="spec-sheet ${item.isTemplate ? "is-template" : ""}">
        ${renderTemplateRibbon(item)}
        <div class="sheet-header">
          <div>
            <div class="sheet-id-row">
              <span class="wdm-ref-pill">${escapeHtml(item.category || "Splice / Terminal")}</span>
              <span class="hero-pn">${escapeHtml(item.partNumber)}</span>
            </div>
            <p class="sheet-subtitle">${escapeHtml(item.title)}</p>
          </div>

          <div class="sheet-actions">
            <button type="button" class="star-btn ${starred ? "starred" : ""}" data-fav-id="${escapeHtml(item.id)}" data-fav-label="${escapeHtml(favLabel)}" data-fav-tab="splices" title="Pin to Favorites">
              ${starred ? "&#9733;" : "&#9734;"}
            </button>
          </div>
        </div>

        <div class="badge-row">${renderStatusBadges(item)}</div>

        <h4 class="section-label">WDM Location, Gauge &amp; Termination Reference</h4>
        <div class="tech-table-wrap">
          <table class="tech-table kv-table">
            <tbody>
              <tr><th>Equipment / Part No</th><td>${copyableCell(item.partNumber)}</td></tr>
              <tr><th>Wire Range (AWG)</th><td><span class="mono-val">${escapeHtml(item.wireRangeAwg || "—")}</span></td></tr>
              <tr><th>WDM System Diagrams</th><td><span class="mono-val">${escapeHtml(item.dieOrLocator || "—")}</span></td></tr>
              <tr><th>Location &amp; Effectivity</th><td><span class="mono-val">${escapeHtml(item.torqueOrLimit || "—")}</span></td></tr>
              <tr><th>Crimp / SWPM Procedure</th><td><span class="mono-val">${escapeHtml(item.crimpToolPn || "—")}</span> &bull; ${escapeHtml(item.stripLength || "—")}</td></tr>
            </tbody>
          </table>
        </div>

        ${item.notes ? `<div class="note-box"><strong>Connected Wires / Notes:</strong> ${escapeHtml(item.notes)}</div>` : ""}

        <div class="source-trace">
          <span><strong>Manual:</strong> ${escapeHtml(item.sourceRef?.manual || "—")}</span>
          <span><strong>Section:</strong> ${escapeHtml(item.sourceRef?.chapterSection || "—")}</span>
          <span><strong>File:</strong> ${escapeHtml(item.sourceRef?.page || "—")}</span>
          <span><strong>Rev:</strong> ${escapeHtml(item.sourceRef?.revision || "—")}</span>
        </div>
      </article>
    `;
  }

  function renderProcedureDetail(item) {
    if (!item) {
      el.proceduresDetail.innerHTML = renderModuleEmpty("SWPM Ch. 20 Procedures");
      return;
    }

    const starred = isFavorite(item.id);
    const toolsHtml = (item.toolsRequired || [])
      .map((t) => `<span class="tool-chip">${escapeHtml(t)}</span>`)
      .join("");
    const stepsHtml = (item.steps || [])
      .map(
        (step, i) => `
          <li>
            <label>
              <input type="checkbox" data-step-key="${escapeHtml(item.id)}-${i}" />
              <span><strong>${i + 1}.</strong> ${escapeHtml(step)}</span>
            </label>
          </li>
        `
      )
      .join("");
    const warningsHtml = (item.warnings || [])
      .map((w) => `<div class="ewis-warning-box"><strong>WARNING / EWIS:</strong> ${escapeHtml(w)}</div>`)
      .join("");

    el.proceduresDetail.innerHTML = `
      <article class="spec-sheet ${item.isTemplate ? "is-template" : ""}">
        ${renderTemplateRibbon(item)}
        <div class="sheet-header">
          <div>
            <div class="sheet-id-row">
              <span class="wdm-ref-pill">${escapeHtml(item.swpmRef)}</span>
            </div>
            <p class="sheet-subtitle" style="font-size:1.05rem;font-weight:700;color:var(--text);">${escapeHtml(item.title)}</p>
          </div>
          <div class="sheet-actions">
            <button type="button" class="star-btn ${starred ? "starred" : ""}" data-fav-id="${escapeHtml(item.id)}" data-fav-label="${escapeHtml(item.swpmRef)}" data-fav-tab="procedures" title="Pin to Favorites">
              ${starred ? "&#9733;" : "&#9734;"}
            </button>
          </div>
        </div>

        <div class="badge-row">${renderStatusBadges(item)}</div>

        <p class="note-box">${escapeHtml(item.summary || "")}</p>

        ${toolsHtml ? `<h4 class="section-label">Required Tooling &amp; Consumables</h4><div class="tools-chips">${toolsHtml}</div>` : ""}

        <h4 class="section-label">Procedure Verification Checklist</h4>
        <ul class="checklist">${stepsHtml}</ul>

        ${warningsHtml}

        <div class="source-trace">
          <span><strong>Manual:</strong> ${escapeHtml(item.sourceRef?.manual || "—")}</span>
          <span><strong>Section:</strong> ${escapeHtml(item.sourceRef?.chapterSection || "—")}</span>
          <span><strong>Ref:</strong> ${escapeHtml(item.sourceRef?.page || "—")}</span>
        </div>
      </article>
    `;
  }

  function renderDecoderDetail(item) {
    if (!item) {
      el.decoderDetail.innerHTML = renderModuleEmpty("Wire & Code Decoder");
      return;
    }

    const segmentRows = (item.segments || [])
      .map(
        (seg) => `
          <tr>
            <td><span class="mono-val">${escapeHtml(seg.token)}</span></td>
            <td>${escapeHtml(seg.meaning)}</td>
          </tr>
        `
      )
      .join("");

    const fleetSample = (state.db.fleetEffectivity || []).slice(0, 12);
    const fleetRows = fleetSample
      .map(
        (f) => `
          <tr>
            <td>${copyableCell(f.tailReg)}</td>
            <td>${copyableCell(f.varNo)}</td>
            <td><span class="mono-val">${escapeHtml(f.model)}</span> (${escapeHtml(f.aircraft)})</td>
            <td><span class="mono-val">${escapeHtml(f.serial)} / LN ${escapeHtml(f.lineNo)}</span></td>
            <td><span class="mono-val">${escapeHtml(f.doc)}</span></td>
          </tr>
        `
      )
      .join("");

    el.decoderDetail.innerHTML = `
      <article class="spec-sheet ${item.isTemplate ? "is-template" : ""}">
        ${renderTemplateRibbon(item)}
        <div class="sheet-header">
          <div>
            <div class="sheet-id-row">
              <span class="wdm-ref-pill">${escapeHtml(item.specType || "Wire / Effectivity Spec")}</span>
            </div>
            <p class="sheet-subtitle" style="font-size:1.02rem;font-weight:700;color:var(--text);">${escapeHtml(item.title)}</p>
          </div>
        </div>

        <div class="badge-row">${renderStatusBadges(item)}</div>

        <div class="note-box">
          <strong>Format Pattern:</strong> <span class="mono-val">${escapeHtml(item.patternExample || "—")}</span>
          <p style="margin:0.45rem 0 0;">${escapeHtml(item.summary || "")}</p>
        </div>

        <h4 class="section-label">WDM &amp; Fleet Coding Structure</h4>
        <div class="tech-table-wrap">
          <table class="tech-table compact-table">
            <thead>
              <tr>
                <th>Segment / Token</th>
                <th>Meaning &amp; Verification Rule</th>
              </tr>
            </thead>
            <tbody>${segmentRows}</tbody>
          </table>
        </div>

        ${
          fleetSample.length > 0
            ? `
          <h4 class="section-label">SunExpress 737 Fleet Effectivity Sample (Use Inspector Box Above for All ${(state.db.fleetEffectivity || []).length} Tails)</h4>
          <div class="tech-table-wrap">
            <table class="tech-table compact-table">
              <thead>
                <tr>
                  <th>Tail Reg</th>
                  <th>Effectivity / Var No</th>
                  <th>Model</th>
                  <th>MSN / Line No</th>
                  <th>WDM Doc</th>
                </tr>
              </thead>
              <tbody>${fleetRows}</tbody>
            </table>
          </div>
        `
            : ""
        }

        <div class="source-trace">
          <span><strong>Manual:</strong> ${escapeHtml(item.sourceRef?.manual || "—")}</span>
          <span><strong>Section:</strong> ${escapeHtml(item.sourceRef?.chapterSection || "—")}</span>
          <span><strong>Rev:</strong> ${escapeHtml(item.sourceRef?.revision || "—")}</span>
        </div>
      </article>
    `;
  }

  function renderModuleEmpty(moduleName) {
    return `
      <div class="spec-sheet" style="text-align:center;padding:2.2rem 1.25rem;">
        <span class="badge badge-template">NO MATCH IN MODULE</span>
        <h3 style="margin:0.65rem 0 0.3rem;">No records in ${escapeHtml(moduleName)}</h3>
        <p class="muted">Adjust active filters or refine your search query.</p>
      </div>
    `;
  }

  /* ========================================================================
     RENDERING: RIGHT COLUMN VISUAL & DIAGRAM INSPECTOR
     ======================================================================== */
  function renderBlueprintSvg(label, swpmRef) {
    return `
      <svg class="schematic-svg" viewBox="0 0 260 175" fill="none" aria-hidden="true">
        <path d="M10 22V10H22M238 10H250V22M10 153V165H22M238 165H250V153" stroke="currentColor" stroke-width="1.3" opacity="0.55"/>
        <line x1="82" y1="22" x2="82" y2="148" stroke="currentColor" stroke-width="0.8" stroke-dasharray="3 3" opacity="0.35"/>
        <line x1="20" y1="86" x2="144" y2="86" stroke="currentColor" stroke-width="0.8" stroke-dasharray="3 3" opacity="0.35"/>
        <circle cx="82" cy="86" r="48" stroke="currentColor" stroke-width="1.7"/>
        <circle cx="82" cy="86" r="38" stroke="currentColor" stroke-width="1.1" opacity="0.72"/>
        <rect x="77" y="36" width="10" height="7" fill="currentColor" opacity="0.85"/>
        <circle cx="82" cy="61" r="6" stroke="currentColor" stroke-width="1.3"/>
        <text x="82" y="63.5" text-anchor="middle" fill="currentColor" font-size="7" font-family="monospace">A</text>
        <circle cx="62" cy="75" r="6" stroke="currentColor" stroke-width="1.3"/>
        <text x="62" y="77.5" text-anchor="middle" fill="currentColor" font-size="7" font-family="monospace">F</text>
        <circle cx="102" cy="75" r="6" stroke="currentColor" stroke-width="1.3"/>
        <text x="102" y="77.5" text-anchor="middle" fill="currentColor" font-size="7" font-family="monospace">B</text>
        <circle cx="62" cy="98" r="6" stroke="currentColor" stroke-width="1.3"/>
        <text x="62" y="100.5" text-anchor="middle" fill="currentColor" font-size="7" font-family="monospace">E</text>
        <circle cx="102" cy="98" r="6" stroke="currentColor" stroke-width="1.3"/>
        <text x="102" y="100.5" text-anchor="middle" fill="currentColor" font-size="7" font-family="monospace">C</text>
        <circle cx="82" cy="86" r="6" stroke="#F59E0B" stroke-width="1.6"/>
        <text x="82" y="88.5" text-anchor="middle" fill="#F59E0B" font-size="7" font-family="monospace">G</text>
        <circle cx="82" cy="111" r="6" stroke="currentColor" stroke-width="1.3"/>
        <text x="82" y="113.5" text-anchor="middle" fill="currentColor" font-size="7" font-family="monospace">D</text>
        <text x="154" y="46" fill="currentColor" font-size="7.5" font-family="monospace" opacity="0.75">SECTION A-A</text>
        <rect x="154" y="68" width="44" height="22" rx="2.5" stroke="currentColor" stroke-width="1.4"/>
        <circle cx="187" cy="79" r="3" stroke="#F59E0B" stroke-width="1.3"/>
        <line x1="198" y1="75" x2="238" y2="75" stroke="#F59E0B" stroke-width="1.8"/>
        <line x1="198" y1="83" x2="238" y2="83" stroke="#F59E0B" stroke-width="1.8"/>
        <rect x="218" y="71" width="24" height="16" rx="2" stroke="currentColor" stroke-width="1.2" opacity="0.8"/>
        <line x1="198" y1="100" x2="218" y2="100" stroke="#F59E0B" stroke-width="1"/>
        <line x1="198" y1="96" x2="198" y2="104" stroke="#F59E0B" stroke-width="1"/>
        <line x1="218" y1="96" x2="218" y2="104" stroke="#F59E0B" stroke-width="1"/>
        <text x="154" y="116" fill="#F59E0B" font-size="7" font-family="monospace">INSPECT / STRIP</text>
        <text x="154" y="132" fill="currentColor" font-size="7.5" font-family="monospace" opacity="0.85">${escapeHtml(swpmRef || "SWPM ATA 20")}</text>
      </svg>
    `;
  }

  function resolveImageSrc(fileName) {
    if (!fileName) return "";
    if (/^https?:\/\//i.test(fileName) || fileName.startsWith("./") || fileName.startsWith("../")) {
      return fileName;
    }
    return `./assets/gorseller/${fileName}`;
  }

  function getResolvedImages(tab, item) {
    if (!item) return [];
    const direct = Array.isArray(item.images) ? item.images : [];
    const profile = tab === "connectors" ? getSeriesProfile(item) : null;
    const inherited = Array.isArray(profile?.images) ? profile.images : [];

    // Reorder / prioritize exact body-style photo first for BACC63BP / BACC63BV / BACC63CB / CN0966 / CN0967 / MS3126
    const combined = [...direct];
    const seen = new Set(direct.map((i) => i.file));

    if (tab === "connectors" && item.connectorPn) {
      const pn = item.connectorPn.toUpperCase();
      let heroImg = null;
      if (/^(BACC63BP|CN0966)/.test(pn)) {
        heroImg = { file: "bacc63bp-cn0966-plug.png", caption: "BACC63BP / CN0966 Self-Locking Plug (Threaded Coupling)" };
      } else if (/^(BACC63BV|CN0967)/.test(pn)) {
        heroImg = { file: "bacc63bv-cn0967-receptacle.png", caption: "BACC63BV / CN0967 Vibration-Resistant Receptacle" };
      } else if (/^(BACC63CB|CN1020)/.test(pn)) {
        heroImg = { file: "bacc63cb-cn1020-plug.png", caption: "BACC63CB / CN1020 Bayonet Vibration-Proof Plug" };
      } else if (/^MS3126/.test(pn)) {
        heroImg = { file: "ms3126-pt06se-plug.png", caption: "MS3126 / PT06SE Straight Plug Engineering Drawing" };
      }
      if (heroImg && !seen.has(heroImg.file)) {
        combined.unshift(heroImg);
        seen.add(heroImg.file);
      }
    }

    inherited.forEach((img) => {
      if (img?.file && !seen.has(img.file)) {
        combined.push(img);
        seen.add(img.file);
      }
    });
    return combined;
  }

  function classifyImageCategory(img) {
    const f = String(img?.file || "").toLowerCase();
    if (/(m22520|k817|wa22|wa27|crimp|turret|positioner|amp-|burndy|ad1377|hx4|615708|615717)/.test(f)) {
      return "crimp";
    }
    if (/(m81969|st2220|1738894|m39029|strip|removal|extraction|megohmmeter|tracer|d436|bms13)/.test(f)) {
      return "removal";
    }
    return "connector";
  }

  function renderVisualPanel(tab, item) {
    if (!item) {
      el.visualTitle.textContent = "No Record Selected";
      el.visualZoomBtn.classList.add("hidden");
      el.visualCatTabs?.classList.add("hidden");
      el.visualThumbs.classList.add("hidden");
      el.blueprintStage.innerHTML = `
        <div class="blueprint-placeholder">
          ${renderBlueprintSvg("STANDBY", "ATA 20")}
          <p class="placeholder-desc">Select a connector, splice, or SWPM procedure on the left to inspect attached diagrams.</p>
        </div>
      `;
      el.visualFooter.innerHTML = `<p class="visual-path-hint">Local diagram folder: <code>app/assets/gorseller/</code> &amp; <code>context/kaynaklar/gorseller/</code></p>`;
      return;
    }

    const lookupTerm = getRecordLookupTerm(tab, item);
    const displayLabel = getRecordPrimaryLabel(tab, item);
    const allImages = getResolvedImages(tab, item);
    const swpmTag = item.sourceRef?.chapterSection || item.swpmRef || "ATA 20";

    el.visualTitle.textContent = displayLabel;

    // Build clean category tabs (All | Connector | Crimp | Removal / BIN) when multiple categories exist
    const catCounts = { connector: 0, crimp: 0, removal: 0 };
    allImages.forEach((im) => {
      catCounts[classifyImageCategory(im)] += 1;
    });
    const activeCatCount = Object.values(catCounts).filter((n) => n > 0).length;

    if (el.visualCatTabs) {
      if (activeCatCount >= 2) {
        if (state.activeImageCat !== "all" && catCounts[state.activeImageCat] === 0) {
          state.activeImageCat = "all";
        }
        const defs = [
          { key: "all", label: `All (${allImages.length})`, count: allImages.length },
          { key: "connector", label: `Connector (${catCounts.connector})`, count: catCounts.connector },
          { key: "crimp", label: `Crimp (${catCounts.crimp})`, count: catCounts.crimp },
          { key: "removal", label: `Removal / BIN (${catCounts.removal})`, count: catCounts.removal },
        ].filter((d) => d.count > 0);
        el.visualCatTabs.classList.remove("hidden");
        el.visualCatTabs.innerHTML = defs
          .map(
            (d) =>
              `<button type="button" class="visual-cat-tab ${state.activeImageCat === d.key ? "active" : ""}" data-visual-cat="${d.key}">${d.label}</button>`
          )
          .join("");
      } else {
        state.activeImageCat = "all";
        el.visualCatTabs.classList.add("hidden");
        el.visualCatTabs.innerHTML = "";
      }
    }

    const images =
      state.activeImageCat === "all"
        ? allImages
        : allImages.filter((im) => classifyImageCategory(im) === state.activeImageCat);

    if (images.length > 0) {
      const idx = Math.min(state.activeImageIndex, images.length - 1);
      const activeImg = images[idx];
      const primarySrc = resolveImageSrc(activeImg.file);
      const fallbackSrc = `../context/kaynaklar/gorseller/${activeImg.file}`;

      el.visualZoomBtn.classList.remove("hidden");
      el.visualZoomBtn.dataset.zoomSrc = primarySrc;
      el.visualZoomBtn.dataset.zoomCaption = activeImg.caption || displayLabel;

      el.blueprintStage.innerHTML = `
        <img
          id="active-diagram-img"
          class="diagram-img"
          src="${escapeHtml(primarySrc)}"
          data-fallback="${escapeHtml(fallbackSrc)}"
          alt="${escapeHtml(activeImg.caption || displayLabel)}"
          title="Click to enlarge"
        />
        <div class="diagram-caption-bar">${escapeHtml(activeImg.caption || displayLabel)} (${idx + 1}/${images.length})</div>
      `;

      const imgNode = document.getElementById("active-diagram-img");
      imgNode.addEventListener("error", () => {
        if (imgNode.dataset.triedFallback !== "1") {
          imgNode.dataset.triedFallback = "1";
          imgNode.src = fallbackSrc;
          el.visualZoomBtn.dataset.zoomSrc = fallbackSrc;
        } else {
          renderNoLocalImageState(lookupTerm, swpmTag, `Local file "${activeImg.file}" not found in assets/gorseller/.`);
        }
      });
      imgNode.addEventListener("click", () => {
        openLightbox(imgNode.src, activeImg.caption || displayLabel);
      });

      if (images.length > 1) {
        el.visualThumbs.classList.remove("hidden");
        el.visualThumbs.innerHTML = images
          .map(
            (img, i) => `
              <button type="button" class="thumb-btn ${i === idx ? "active" : ""}" data-thumb-idx="${i}" title="${escapeHtml(img.caption || `Diagram ${i + 1}`)}">
                <img src="${escapeHtml(resolveImageSrc(img.file))}" alt="" />
              </button>
            `
          )
          .join("");
      } else {
        el.visualThumbs.classList.add("hidden");
      }
    } else {
      el.visualZoomBtn.classList.add("hidden");
      el.visualThumbs.classList.add("hidden");
      renderNoLocalImageState(lookupTerm, swpmTag, "No local pin-out, SWPM cross-section, or tool diagram attached yet.");
    }

    const webQuery = lookupTerm && !lookupTerm.startsWith("[") ? lookupTerm : "Boeing 737 SWPM connector";
    el.visualFooter.innerHTML = `
      <div class="visual-actions">
        <a class="secondary-btn compact-btn" href="${buildDatasheetUrl(webQuery)}" target="_blank" rel="noopener noreferrer">
          Datasheet Search (Web) &#8599;
        </a>
        <a class="secondary-btn compact-btn" href="${buildImageSearchUrl(webQuery)}" target="_blank" rel="noopener noreferrer">
          Pin-Out / Photo (Web) &#8599;
        </a>
      </div>
      <p class="visual-path-hint">Drop local diagrams into <code>context/kaynaklar/gorseller/</code> (synced to <code>app/assets/gorseller/</code>).</p>
    `;
  }

  function renderNoLocalImageState(lookupTerm, swpmTag, message) {
    el.visualZoomBtn.classList.add("hidden");
    el.blueprintStage.innerHTML = `
      <div class="blueprint-placeholder">
        ${renderBlueprintSvg(lookupTerm, swpmTag)}
        <span class="placeholder-code">${escapeHtml(lookupTerm || "AWAITING SOURCE")}</span>
        <p class="placeholder-desc">${escapeHtml(message)}</p>
        <div class="blueprint-titleblock">
          <span>STATUS: <strong>AWAITING ASSET</strong></span>
          <span>SCALE: <strong>NTS</strong></span>
          <span>REF: <strong>${escapeHtml(swpmTag || "ATA 20")}</strong></span>
        </div>
      </div>
    `;
  }

  /* ========================================================================
     LIGHTBOX ZOOM MODAL
     ======================================================================== */
  function setLightboxZoom(scale) {
    el.lightboxImg.style.transform = `scale(${scale})`;
    if (el.lightboxZoomReadout) {
      el.lightboxZoomReadout.textContent = `${Math.round(Number(scale) * 100)}%`;
    }
    document.querySelectorAll("[data-zoom]").forEach((btn) => {
      btn.classList.toggle("active-zoom", Number(btn.dataset.zoom) === Number(scale));
    });
  }

  function openLightbox(src, caption) {
    el.lightboxImg.src = src;
    setLightboxZoom(1);
    el.lightboxCaption.textContent = caption || "Diagram Preview";
    el.lightboxModal.classList.remove("hidden");
  }

  function closeLightbox() {
    el.lightboxModal.classList.add("hidden");
  }

  /* ========================================================================
     RENDERING: SOURCES & DATABASE AUDIT
     ======================================================================== */
  function renderSourcesDashboard() {
    const connCount = (state.db.connectors || []).filter((r) => r.verified).length;
    const spliceCount = (state.db.splicesAndTerminals || []).filter((r) => r.verified).length;
    const procCount = (state.db.swpmProcedures || []).filter((r) => r.verified).length;
    const decCount = (state.db.wireDecoders || []).filter((r) => r.verified).length;
    const verifiedTotal = connCount + spliceCount + procCount + decCount;
    const sources = state.db.meta?.sourcesIndex || [];
    const mapped = state.db.meta?.stats?.swpmMappedConnectors || 0;

    el.countSources.textContent = String(sources.length);
    el.heroTelemetry.textContent = `${verifiedTotal.toLocaleString()} Verified 737 Records • ${mapped.toLocaleString()} SWPM-Linked Connectors • Zero Hallucination Mode`;

    el.sourcesKpis.innerHTML = `
      <div class="kpi-card">
        <div class="kpi-value">${connCount.toLocaleString()}</div>
        <div class="kpi-label">Verified WDM Connector Records</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${mapped.toLocaleString()}</div>
        <div class="kpi-label">Auto-Linked to SWPM Ch. 20 Tooling</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${spliceCount.toLocaleString()}</div>
        <div class="kpi-label">Verified Splices, Grounds &amp; Terminal Strips</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${(state.db.fleetEffectivity || []).length}</div>
        <div class="kpi-label">SunExpress 737NG / MAX Fleet Tails Indexed</div>
      </div>
    `;

    if (sources.length === 0) {
      el.sourcesList.innerHTML = `<p class="muted">${escapeHtml(state.db.meta?.dataPolicy || "")}</p>`;
    } else {
      el.sourcesList.innerHTML = `
        <p class="muted">${escapeHtml(state.db.meta?.dataPolicy || "")}</p>
        ${sources
          .map(
            (src) => `
              <div class="source-doc-item">
                <h4>${escapeHtml(src.docNumber ? `${src.docNumber} — ` : "")}${escapeHtml(src.fileName || src.title)}</h4>
                <p class="muted">
                  <strong>Layer:</strong> ${escapeHtml(src.layer || "primary-737")} &bull;
                  <strong>Rev:</strong> ${escapeHtml(src.revision || "—")} &bull;
                  <strong>Added:</strong> ${escapeHtml(src.addedDate || "—")}
                </p>
                ${src.scope ? `<p class="muted" style="margin-top:0.2rem;">${escapeHtml(src.scope)}</p>` : ""}
              </div>
            `
          )
          .join("")}
      `;
    }
  }

  /* ========================================================================
     MASTER RENDER ORCHESTRATION
     ======================================================================== */
  function renderActiveWorkspace() {
    if (!state.db) return;

    const connRecords = getFilteredRecords("connectors");
    const spliceRecords = getFilteredRecords("splices");
    const procRecords = getFilteredRecords("procedures");
    const decRecords = getFilteredRecords("decoder");

    el.countConnectors.textContent = connRecords.length.toLocaleString();
    el.countSplices.textContent = spliceRecords.length.toLocaleString();
    el.countProcedures.textContent = procRecords.length.toLocaleString();
    el.countDecoder.textContent = decRecords.length.toLocaleString();

    const totalMatches = connRecords.length + spliceRecords.length + procRecords.length + decRecords.length;
    const hasQuery = state.query.trim().length > 0;

    if (hasQuery && totalMatches === 0 && state.activeTab !== "sources") {
      const q = state.query.trim();
      el.globalNotFound.innerHTML = `
        <span class="badge badge-template">ZERO HALLUCINATION GUARD</span>
        <h2>Not found in registered SWPM sources</h2>
        <p>
          No verified Boeing 737NG/737MAX SWPM, WDM, or tooling record matched <code>${escapeHtml(q)}</code>.
          Part numbers, contacts, and tooling specifications are never fabricated. Check external manufacturer datasheets below or verify the source manual.
        </p>
        <div class="not-found-actions">
          <a class="primary-btn" href="${buildDatasheetUrl(q)}" target="_blank" rel="noopener noreferrer">
            Search Datasheet on Web &#8599;
          </a>
          <a class="secondary-btn" href="${buildImageSearchUrl(q)}" target="_blank" rel="noopener noreferrer">
            Search Pin-Out / Images &#8599;
          </a>
          <button type="button" class="secondary-btn" id="not-found-reset-btn">Clear Search</button>
        </div>
      `;
      el.globalNotFound.classList.remove("hidden");
      el.splitWorkbench.classList.add("hidden");
      return;
    }

    el.globalNotFound.classList.add("hidden");
    el.splitWorkbench.classList.toggle("hidden", state.activeTab === "sources");

    const sets = {
      connectors: connRecords,
      splices: spliceRecords,
      procedures: procRecords,
      decoder: decRecords,
    };

    Object.entries(sets).forEach(([tabKey, list]) => {
      const current = state.selectedIds[tabKey];
      if (!list.some((r) => r.id === current)) {
        state.selectedIds[tabKey] = list[0]?.id || null;
      }
    });

    const activeConn = connRecords.find((r) => r.id === state.selectedIds.connectors) || null;
    const activeSplice = spliceRecords.find((r) => r.id === state.selectedIds.splices) || null;
    const activeProc = procRecords.find((r) => r.id === state.selectedIds.procedures) || null;
    const activeDec = decRecords.find((r) => r.id === state.selectedIds.decoder) || null;

    renderMatchSelector(el.connectorsSelector, "connectors", connRecords, activeConn?.id);
    renderConnectorDetail(activeConn);

    renderMatchSelector(el.splicesSelector, "splices", spliceRecords, activeSplice?.id);
    renderSpliceDetail(activeSplice);

    renderMatchSelector(el.proceduresSelector, "procedures", procRecords, activeProc?.id);
    renderProcedureDetail(activeProc);

    renderDecoderDetail(activeDec);

    const activeByTab = {
      connectors: activeConn,
      splices: activeSplice,
      procedures: activeProc,
      decoder: activeDec,
    };

    if (state.activeTab !== "sources") {
      renderVisualPanel(state.activeTab, activeByTab[state.activeTab]);
    }
  }

  function switchTab(tab) {
    state.activeTab = tab;
    state.activeImageIndex = 0;
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === `panel-${tab}`);
    });
    renderActiveWorkspace();
  }

  function renderAll() {
    if (!state.db) return;
    buildSearchIndex();
    if (state.db.meta?.disclaimer) {
      el.disclaimerText.textContent = state.db.meta.disclaimer;
    }
    el.footerMeta.textContent = `Schema v${state.db.meta?.schemaVersion || "1.1.0"} • Updated ${state.db.meta?.lastUpdated || "—"} • Static Offline & GitHub Pages Ready`;

    // Update Wire Decoder header badge if verified rules are loaded
    const decoderBadge = document.querySelector("#panel-decoder .decoder-input-header .badge");
    if (decoderBadge && (state.db.fleetEffectivity || []).length > 0) {
      decoderBadge.className = "badge badge-verified";
      decoderBadge.textContent = `VERIFIED (${state.db.fleetEffectivity.length} TAILS)`;
      el.wireCodeInput.placeholder = "Enter Tail Reg (e.g. TC-SMK, TC-SNV) or Effectivity Var No (e.g. 1K311, YC055)...";
    }

    renderQuickChips();
    renderSourcesDashboard();
    renderActiveWorkspace();
  }

  /* ========================================================================
     EVENT BINDINGS
     ======================================================================== */
  function bindEvents() {
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    document.querySelectorAll("[data-aircraft]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.aircraftFilter = btn.dataset.aircraft;
        document.querySelectorAll("[data-aircraft]").forEach((b) => b.classList.toggle("active", b === btn));
        renderActiveWorkspace();
        renderAutocomplete();
      });
    });

    document.querySelectorAll("[data-layer]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.layerFilter = btn.dataset.layer;
        document.querySelectorAll("[data-layer]").forEach((b) => b.classList.toggle("active", b === btn));
        renderActiveWorkspace();
        renderAutocomplete();
      });
    });

    el.heroInput.addEventListener("input", (e) => {
      state.query = e.target.value;
      el.heroClearBtn.classList.toggle("hidden", state.query.length === 0);
      state.acHighlightIndex = -1;
      renderAutocomplete();
      renderActiveWorkspace();
    });

    el.heroInput.addEventListener("keydown", (e) => {
      const items = Array.from(el.autocompleteList.querySelectorAll("[data-ac-id]"));
      if (e.key === "ArrowDown" && items.length > 0) {
        e.preventDefault();
        state.acHighlightIndex = (state.acHighlightIndex + 1) % items.length;
        renderAutocomplete();
      } else if (e.key === "ArrowUp" && items.length > 0) {
        e.preventDefault();
        state.acHighlightIndex = (state.acHighlightIndex - 1 + items.length) % items.length;
        renderAutocomplete();
      } else if (e.key === "Enter") {
        if (state.acHighlightIndex >= 0 && items[state.acHighlightIndex]) {
          e.preventDefault();
          items[state.acHighlightIndex].click();
        } else if (state.query.trim()) {
          saveRecent(state.query);
          el.autocompleteList.classList.add("hidden");
        }
      } else if (e.key === "Escape") {
        el.autocompleteList.classList.add("hidden");
      }
    });

    el.heroClearBtn.addEventListener("click", () => {
      state.query = "";
      el.heroInput.value = "";
      el.heroClearBtn.classList.add("hidden");
      el.autocompleteList.classList.add("hidden");
      renderActiveWorkspace();
      el.heroInput.focus();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== el.heroInput && document.activeElement !== el.wireCodeInput) {
        e.preventDefault();
        el.heroInput.focus();
        el.heroInput.select();
      } else if (e.key === "Escape") {
        closeLightbox();
        el.autocompleteList.classList.add("hidden");
      }
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".hero-search-wrap")) {
        el.autocompleteList.classList.add("hidden");
      }
    });

    el.ewisToggle.addEventListener("change", (e) => {
      state.ewisOnly = e.target.checked;
      renderActiveWorkspace();
    });

    el.templatesToggle.addEventListener("change", (e) => {
      state.showTemplates = e.target.checked;
      renderActiveWorkspace();
    });

    // Live Fleet Effectivity & Wire Code Inspector
    el.wireCodeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        el.wireDecodeBtn.click();
      }
    });

    el.wireDecodeBtn.addEventListener("click", () => {
      const code = el.wireCodeInput.value.trim();
      if (!code) {
        el.wireDecodeOutput.classList.add("hidden");
        return;
      }
      const q = code.toLowerCase();
      const fleetHits = (state.db.fleetEffectivity || []).filter(
        (f) =>
          f.tailReg.toLowerCase().includes(q) ||
          f.varNo.toLowerCase().includes(q) ||
          f.serial.toLowerCase().includes(q) ||
          f.lineNo.toLowerCase().includes(q)
      );

      if (fleetHits.length > 0) {
        el.wireDecodeOutput.style.background = "var(--emerald-soft)";
        el.wireDecodeOutput.style.borderColor = "var(--emerald-border)";
        el.wireDecodeOutput.innerHTML = `
          <strong>Verified SunExpress Fleet Match (${fleetHits.length}):</strong>
          <div style="margin-top:0.45rem;display:flex;flex-direction:column;gap:0.3rem;">
            ${fleetHits
              .slice(0, 8)
              .map(
                (f) => `
                  <div>
                    <span class="mono-val">${escapeHtml(f.tailReg)}</span> &harr;
                    Effectivity <span class="mono-val">${escapeHtml(f.varNo)}</span> &bull;
                    ${escapeHtml(f.model)} (${escapeHtml(f.aircraft)}) &bull;
                    MSN ${escapeHtml(f.serial)} / Line ${escapeHtml(f.lineNo)} &bull;
                    WDM <code>${escapeHtml(f.doc)}</code>
                  </div>
                `
              )
              .join("")}
          </div>
        `;
      } else {
        el.wireDecodeOutput.style.background = "var(--amber-soft)";
        el.wireDecodeOutput.style.borderColor = "var(--amber-border)";
        el.wireDecodeOutput.innerHTML = `
          <strong>Not found in registered SWPM/WDM Front Matter sources:</strong>
          No SunExpress tail registration, effectivity variable number, or verified wire rule matched <code>${escapeHtml(code)}</code>.
        `;
      }
      el.wireDecodeOutput.classList.remove("hidden");
    });

    el.visualZoomBtn.addEventListener("click", () => {
      if (el.visualZoomBtn.dataset.zoomSrc) {
        openLightbox(el.visualZoomBtn.dataset.zoomSrc, el.visualZoomBtn.dataset.zoomCaption);
      }
    });

    el.lightboxClose.addEventListener("click", closeLightbox);
    el.lightboxModal.addEventListener("click", (e) => {
      if (e.target === el.lightboxModal || e.target.id === "lightbox-canvas") {
        closeLightbox();
      }
    });

    document.querySelectorAll("[data-zoom]").forEach((btn) => {
      btn.addEventListener("click", () => setLightboxZoom(btn.dataset.zoom));
    });

    document.addEventListener("click", (e) => {
      const copyBtn = e.target.closest("[data-copy]");
      if (copyBtn) {
        copyText(copyBtn.dataset.copy, copyBtn);
        return;
      }

      const acItem = e.target.closest("[data-ac-id]");
      if (acItem) {
        const tab = acItem.dataset.acTab;
        const id = acItem.dataset.acId;
        if (state.query.trim()) saveRecent(state.query);
        state.selectedIds[tab] = id;
        state.activeImageIndex = 0;
        state.activeImageCat = "all";
        el.autocompleteList.classList.add("hidden");
        switchTab(tab);
        return;
      }

      const selBtn = e.target.closest("[data-select-id]");
      if (selBtn) {
        state.selectedIds[selBtn.dataset.selectTab] = selBtn.dataset.selectId;
        state.activeImageIndex = 0;
        state.activeImageCat = "all";
        renderActiveWorkspace();
        return;
      }

      const visualCatBtn = e.target.closest("[data-visual-cat]");
      if (visualCatBtn) {
        state.activeImageCat = visualCatBtn.dataset.visualCat || "all";
        state.activeImageIndex = 0;
        renderActiveWorkspace();
        return;
      }

      const favBtn = e.target.closest("[data-fav-id]");
      if (favBtn) {
        toggleFavorite(favBtn.dataset.favId, favBtn.dataset.favLabel, favBtn.dataset.favTab);
        return;
      }

      const jumpBtn = e.target.closest("[data-jump-id]");
      if (jumpBtn) {
        state.query = "";
        el.heroInput.value = "";
        el.heroClearBtn.classList.add("hidden");
        state.selectedIds[jumpBtn.dataset.jumpTab] = jumpBtn.dataset.jumpId;
        switchTab(jumpBtn.dataset.jumpTab);
        return;
      }

      const recentBtn = e.target.closest("[data-recent-term]");
      if (recentBtn) {
        state.query = recentBtn.dataset.recentTerm;
        el.heroInput.value = state.query;
        el.heroClearBtn.classList.remove("hidden");
        renderActiveWorkspace();
        return;
      }

      const thumbBtn = e.target.closest("[data-thumb-idx]");
      if (thumbBtn) {
        state.activeImageIndex = Number(thumbBtn.dataset.thumbIdx) || 0;
        renderActiveWorkspace();
        return;
      }

      if (e.target.closest("#not-found-reset-btn")) {
        state.query = "";
        el.heroInput.value = "";
        el.heroClearBtn.classList.add("hidden");
        renderActiveWorkspace();
        el.heroInput.focus();
      }
    });

    el.jsonFileInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          state.db = JSON.parse(String(reader.result));
          el.dataNotice.classList.add("hidden");
          renderAll();
          showToast(`Loaded database: ${file.name}`);
        } catch {
          showToast("Invalid JSON file");
        }
      };
      reader.readAsText(file);
    });
  }

  /* ========================================================================
     DATABASE INITIALIZATION
     ======================================================================== */
  async function loadDatabase() {
    try {
      const res = await fetch(DB_PATH, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.db = await res.json();
      el.dataNotice.classList.add("hidden");
    } catch {
      if (window.__WIRING_DB_OFFLINE__) {
        state.db = window.__WIRING_DB_OFFLINE__;
        el.dataNotice.classList.add("hidden");
      } else {
        el.dataNotice.textContent =
          "Could not load app/data/wiring-db.json automatically. Use Sources & Database -> Load Local JSON or open via a local/static HTTP server.";
        el.dataNotice.classList.remove("hidden");
        return;
      }
    }
    renderAll();
  }

  function registerOfflinePwa() {
    if (!("serviceWorker" in navigator)) return;
    const isSecureOrigin =
      location.protocol === "https:" ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1";
    if (!isSecureOrigin) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        /* ignore registration failure on restricted local setups */
      });
    });
  }

  loadPersistedState();
  initTheme();
  bindEvents();
  registerOfflinePwa();
  loadDatabase();
})();
