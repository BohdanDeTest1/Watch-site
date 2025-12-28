(() => {
  'use strict';

  function el(q, root = document) { return root.querySelector(q); }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function fmtUtc(ms) {
    if (!Number.isFinite(ms)) return '—';
    const d = new Date(ms);
    const yyyy = d.getUTCFullYear();
    const MM = String(d.getUTCMonth() + 1).padStart(2, '0');
    const DD = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}-${MM}-${DD} ${hh}:${mm}:${ss} UTC`;
  }

  function toMsAny(v) {
    if (v == null) return NaN;

    // --- numbers / numeric strings ---
    const asNum = (typeof v === 'number')
      ? v
      : (typeof v === 'string' && v.trim() !== '' && /^-?\d+(\.\d+)?$/.test(v.trim()))
        ? Number(v.trim())
        : NaN;

    if (Number.isFinite(asNum)) {
      let n = asNum;

      // Нормализация масштаба:
      // seconds  ~ 1e9
      // millis   ~ 1e12
      // micros   ~ 1e15
      // nanos    ~ 1e18
      if (Math.abs(n) >= 1e18) return Math.round(n / 1e6);  // ns -> ms
      if (Math.abs(n) >= 1e15) return Math.round(n / 1e3);  // µs -> ms
      if (Math.abs(n) >= 1e12) return Math.round(n);        // ms
      if (Math.abs(n) >= 1e9) return Math.round(n * 1000); // s -> ms

      // слишком маленькое число — не дата
      return NaN;
    }

    // --- strings: ISO / "YYYY-MM-DD HH:mm:ss UTC" / similar ---
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s) return NaN;

      // 1) ISO / parseable
      const isoMs = Date.parse(s);
      if (Number.isFinite(isoMs)) return isoMs;

      // 2) "YYYY-MM-DD HH:mm:ss UTC" (твой кейс)
      const m = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s*UTC$/i);
      if (m) {
        const ms = Date.parse(`${m[1]}T${m[2]}Z`);
        if (Number.isFinite(ms)) return ms;
      }

      // 3) "YYYY-MM-DD HH:mm:ss" (без UTC) — считаем как UTC
      const m2 = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
      if (m2) {
        const ms = Date.parse(`${m2[1]}T${m2[2]}Z`);
        if (Number.isFinite(ms)) return ms;
      }
    }

    return NaN;
  }


  // ---------- extract ----------
  function extractPromotions(json) {
    // Максимально “пластичный” экстрактор: под разные формы моков
    const arr =
      json?.data?.promotions ??
      json?.data?.items ??
      json?.data ??
      json?.promotions ??
      json?.items ??
      [];

    const list = Array.isArray(arr) ? arr : [];

    return list.map((it, idx) => {
      const id = it.id ?? it._id ?? it.key ?? `promo_${idx}`;

      const name =
        it.name ??
        it.title ??
        it.promoName ??
        it.promotionName ??
        String(id);

      const type =
        it.type ??
        it.category ??
        it.promoType ??
        it.promotionType ??
        '—';

      const start =
        it.startDate ?? it.start ?? it.start_time ?? it.start_at ?? it.begin_at ??
        it.startUtc ?? it.startUTC;

      const end =
        it.endDate ?? it.end ?? it.end_time ?? it.end_at ?? it.finish_at ??
        it.endUtc ?? it.endUTC;

      const startTS = toMsAny(start);
      const endTS = toMsAny(end);

      const state =
        it.state ??
        it.promoState ??
        it.status ??
        it.displayState ??
        it.enabledState ??
        'on';

      return {
        id: String(id),
        name: String(name),
        type: String(type),
        state: String(state),
        startTS,
        endTS,
        startPretty: fmtUtc(startTS),
        endPretty: fmtUtc(endTS),
        raw: it
      };

    }).filter(x => Number.isFinite(x.startTS) && Number.isFinite(x.endTS) && x.endTS > x.startTS);
  }

  // ---------- UI ----------
  function appendPromotionsUI(items) {
    const wrap = document.createElement('div');
    wrap.className = 'pp-item collapsible collapsed';

    // Promotions использует те же классы/компоновку, что LiveOps,
    // но id — уникальные (promoTl*)
    wrap.innerHTML = `
<div class="pp-title">
  <button class="pp-collapser" type="button">
    Promotions <span class="chev">▾</span>
  </button>
</div>

<div class="pp-body">
  <!-- [CAL] Timeline (Promotions, LiveOps-like) -->
  <section class="pp-cal" id="ppPromoCal">
   <div class="tl-wrap">
    <div class="tl-rescol">
        <div class="tl-res-header">Promotion types</div>
        <div class="tl-res-list" id="promoTlResList"></div>
    </div>

   <div class="tl-grid" id="promoTlGrid">
  <div class="tl-toolbar" id="promoTlToolbar">
    <div class="tl-left">
      <span class="tl-cal-wrap">
        <button class="tl-btn tl-icon-btn" data-nav="calendar" aria-haspopup="dialog" aria-expanded="false" data-hint="Pick a date">
          <span class="tl-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
              <path d="M7 2v2H5a2 2 0 0 0-2 2v2h18V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm14 8H3v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10zm-2 2v8H5v-8h14z"/>
            </svg>
          </span>
          Calendar
        </button>
        <input id="promoTlDateInput" type="date" aria-hidden="true" />
      </span>

      <button class="tl-btn" data-nav="prev" aria-label="Back" data-hint="Go to previous day">&#x276E;</button>
      <button class="tl-btn" data-nav="today" data-hint="Jump to today">today</button>
      <button class="tl-btn" data-nav="next" aria-label="Next" data-hint="Go to next day">&#x276F;</button>
    </div>

    <div class="tl-title" id="promoTlTitle"></div>
    <div class="tl-right"></div>
  </div>

   <div class="tl-grid-header" id="promoTlHeader"></div>
  <div class="tl-grid-body" id="promoTlBody"></div>
</div>

</div>
  </section>

  <!-- [TABLE] Promotions table (LiveEvents-like: filters/sort/pager/info) -->
  
<section class="pp-lo" style="margin-top:10px;">
    <div class="pp-liveops" id="ppPromoLiveops">

      <button class="pp-close-float" id="ppPromoLoClose" type="button" aria-label="Close">×</button>

      <div class="pp-table pp-lo-table" id="ppPromoLoTable">
        <div class="pp-t-head">

            <!-- State -->
            <div class="pp-th state">
             <button class="pp-th-btn" id="ppPromoStateBtn" type="button" aria-haspopup="true">
  <span class="txt">State</span><span class="arr" aria-hidden="true">↕</span><span class="pp-filter-ico" aria-hidden="true"></span>
</button>
              <div class="pp-filter-pop" id="ppPromoStatePop" hidden>
                <div class="pp-filter-actions">
                  <button class="pp-mini" id="ppPromoStateAll" type="button">All</button>
                  <button class="pp-mini" id="ppPromoStateNone" type="button">None</button>
                </div>
                <div class="pp-filter-list" id="ppPromoStateList"></div>
                <div class="pp-filter-actions">
                  <button id="ppPromoStateReset" class="pp-link-btn" type="button">RESET</button>
                  <button id="ppPromoStateApply" class="pp-btn primary" type="button">CONFIRM</button>
                </div>
              </div>
            </div>

            <!-- Name -->
            <div class="pp-th name">
             <button class="pp-th-btn" id="ppPromoNameBtn" type="button" aria-haspopup="true">
  <span class="txt">Name</span><span class="arr" aria-hidden="true">↕</span><span class="pp-filter-ico" aria-hidden="true"></span>
</button>
              <div class="pp-filter-pop" id="ppPromoNamePop" hidden>
                <div class="pp-filter-row">
                  <button class="pp-rule-btn" id="ppPromoNameRuleBtn" type="button" data-val="contains">
                    <span class="txt">Contains</span><span class="arr">▾</span>
                  </button>
                  <input class="pp-filter-inp" id="ppPromoNameQuery" placeholder="Name..." />
                </div>
                <div class="pp-filter-actions">
                  <button id="ppPromoNameReset" class="pp-link-btn" type="button">RESET</button>
                  <button id="ppPromoNameApply" class="pp-btn primary" type="button">CONFIRM</button>
                </div>

                <div class="pp-rule-pop" id="ppPromoNameRuleMenu" hidden>
                  <button type="button" data-val="contains">Contains</button>
                  <button type="button" data-val="eq">Equals</button>
                  <button type="button" data-val="starts">Starts with</button>
                  <button type="button" data-val="ends">Ends with</button>
                  <button type="button" data-val="blank">Is blank</button>
                </div>
              </div>
            </div>

            <!-- Type -->
            <div class="pp-th type">
             <button class="pp-th-btn" id="ppPromoTypeBtn" type="button" aria-haspopup="true">
  <span class="txt">Type</span><span class="arr" aria-hidden="true">↕</span><span class="pp-filter-ico" aria-hidden="true"></span>
</button>
              <div class="pp-filter-pop" id="ppPromoTypePop" hidden>
                <div class="pp-filter-row">
                  <button class="pp-rule-btn" id="ppPromoTypeRuleBtn" type="button" data-val="contains">
                    <span class="txt">Contains</span><span class="arr">▾</span>
                  </button>
                  <input class="pp-filter-inp" id="ppPromoTypeQuery" placeholder="Type..." />
                </div>
                <div class="pp-filter-actions">
                  <button id="ppPromoTypeReset" class="pp-link-btn" type="button">RESET</button>
                  <button id="ppPromoTypeApply" class="pp-btn primary" type="button">CONFIRM</button>
                </div>

                <div class="pp-rule-pop" id="ppPromoTypeRuleMenu" hidden>
                  <button type="button" data-val="contains">Contains</button>
                  <button type="button" data-val="eq">Equals</button>
                  <button type="button" data-val="starts">Starts with</button>
                  <button type="button" data-val="ends">Ends with</button>
                  <button type="button" data-val="blank">Is blank</button>
                </div>
              </div>
            </div>

            <!-- Start Date -->
            <div class="pp-th start">
             <button class="pp-th-btn" id="ppPromoStartBtn" type="button" aria-haspopup="true">
  <span class="txt">Start Date</span><span class="arr" aria-hidden="true">↕</span><span class="pp-filter-ico" aria-hidden="true"></span>
</button>
              <div class="pp-filter-pop pp-cal-pop" id="ppPromoStartPop" hidden>
                <div class="pp-cal-top">
                  <select class="pp-sel" id="ppPromoStartRule">
                    <option value="between">Between</option>
                    <option value="gte">After (>=)</option>
                    <option value="lte">Before (<=)</option>
                    <option value="blank">Is blank</option>
                  </select>
                </div>
                <div class="pp-cal-inputs" id="ppPromoStartInputs">
                  <input class="pp-filter-inp" id="ppPromoStartFrom" placeholder="YYYY-MM-DD [HH:mm]" />
                  <input class="pp-filter-inp" id="ppPromoStartTo" placeholder="YYYY-MM-DD [HH:mm]" />
                </div>
                <div class="pp-filter-actions">
                  <button id="ppPromoStartReset" class="pp-link-btn" type="button">RESET</button>
                  <button id="ppPromoStartApply" class="pp-btn primary" type="button">CONFIRM</button>
                </div>
              </div>
            </div>

            <!-- End Date -->
            <div class="pp-th end">
             <button class="pp-th-btn" id="ppPromoEndBtn" type="button" aria-haspopup="true">
  <span class="txt">End Date</span><span class="arr" aria-hidden="true">↕</span><span class="pp-filter-ico" aria-hidden="true"></span>
</button>

              <div class="pp-filter-pop pp-cal-pop" id="ppPromoEndPop" hidden>
                <div class="pp-cal-top">
                  <select class="pp-sel" id="ppPromoEndRule">
                    <option value="between">Between</option>
                    <option value="gte">After (>=)</option>
                    <option value="lte">Before (<=)</option>
                    <option value="blank">Is blank</option>
                  </select>
                </div>
                <div class="pp-cal-inputs" id="ppPromoEndInputs">
                  <input class="pp-filter-inp" id="ppPromoEndFrom" placeholder="YYYY-MM-DD [HH:mm]" />
                  <input class="pp-filter-inp" id="ppPromoEndTo" placeholder="YYYY-MM-DD [HH:mm]" />
                </div>
                <div class="pp-filter-actions">
                  <button id="ppPromoEndReset" class="pp-link-btn" type="button">RESET</button>
                  <button id="ppPromoEndApply" class="pp-btn primary" type="button">CONFIRM</button>
                </div>
              </div>
            </div>

            <!-- Info col -->
            <div class="pp-th info"></div>

        </div>

        <div class="pp-t-body" id="ppPromoTBody"></div>
      </div>

           <!-- right info panel -->
           <!-- right info panel + floating buttons (same layout as LiveOps) -->
      <aside class="pp-liveops-detail" id="ppPromoLoDetail" aria-hidden="true">
        <div class="muted small">Select a promotion to view details</div>
      </aside>

      <button id="ppPromoAdminBtn" class="pp-admin-float pp-btn" type="button">PromotionInTheAdmin</button>
      
    </div>

    <div class="pp-pager" id="ppPromoPager">
      <button id="ppPromoResetBtn" class="pp-btn pp-reset" type="button" title="Reset all table filters">
        Reset Filters
      </button>

      <span class="pp-label">Rows per page</span>
      <span class="pp-sel-wrap">
        <select class="pp-sel" id="ppPromoRows">
          <option>10</option>
          <option selected>25</option>
          <option>50</option>
          <option>75</option>
          <option>100</option>
        </select>
      </span>

      <span id="ppPromoRange">0–0 of 0</span>

      <span class="pp-nav">
        <button class="pp-icon" id="ppPromoFirst" title="First"><span>|‹</span></button>
        <button class="pp-icon" id="ppPromoPrev" title="Prev"><span>‹</span></button>
        <button class="pp-icon" id="ppPromoNext" title="Next"><span>›</span></button>
        <button class="pp-icon" id="ppPromoLast" title="Last"><span>›|</span></button>
      </span>
    </div>

  </section>


</div>
`;


    // collapsible (используем общий wireCollapser если есть)
    if (typeof window.wireCollapser === 'function') {
      window.wireCollapser(wrap);
    } else {
      const btn = wrap.querySelector('.pp-collapser');
      const body = wrap.querySelector('.pp-body');
      const chev = btn?.querySelector('.chev');
      const setCollapsed = (flag) => {
        wrap.classList.toggle('collapsed', flag);
        if (body) body.hidden = flag;
        if (chev) chev.textContent = flag ? '▾' : '▴';
      };
      setCollapsed(true);
      btn?.addEventListener('click', () => setCollapsed(!wrap.classList.contains('collapsed')));
    }

    el('#ppResults')?.appendChild(wrap);

    try {
      initPromoTimeline(items, wrap);
    } catch (e) {
      console.error('[Promotions] initPromoTimeline failed:', e);
    }

    try {
      renderPromoTable(items, wrap);
    } catch (e) {
      console.error('[Promotions] renderPromoTable failed:', e);
    }
  }


  function renderPromoTable(items, wrap) {
    const detEl = wrap.querySelector('#ppPromoLoDetail');
    const bodyEl = wrap.querySelector('#ppPromoTBody');
    const headEl = wrap.querySelector('#ppPromoLoTable .pp-t-head');
    const closeBtn = wrap.querySelector('#ppPromoLoClose');
    const adminBtn = wrap.querySelector('#ppPromoAdminBtn');

    if (!bodyEl || !detEl) return;

    closeBtn?.addEventListener('click', () => {
      const liveopsEl = wrap.querySelector('#ppPromoLiveops') || wrap;
      liveopsEl.classList.remove('info-open');
      detEl.setAttribute('aria-hidden', 'true');
    });


    // Same behavior as LiveOps: floating "Go to admin" button (fixed to panel bottom).
    // Requirement: on click open Google.
    adminBtn?.addEventListener('click', () => {
      window.open('https://www.google.com', '_blank', 'noopener');
    });



    // --- helpers (локально, чтобы не зависеть от ProfileParser.js) ---
    function stripUTC(s) { return String(s || '').replace(/\s*UTC\s*$/i, '').trim(); }
    function toMsFromCell(s) {
      const iso = stripUTC(s).replace(' ', 'T') + 'Z';
      const ms = Date.parse(iso);
      return Number.isFinite(ms) ? ms : null;
    }
    function dayStartMs(isoDate) { return Date.parse(isoDate + 'T00:00:00Z'); }
    function dayEndMs(isoDate) { return Date.parse(isoDate + 'T23:59:59Z'); }

    function passDateRule(cellStr, f) {
      if (!f || !f.rule) return true;
      const t = toMsFromCell(cellStr);
      if (t == null) return true;

      const hasTime = (s) => typeof s === 'string' && s.trim().length > 10 && /\d{2}:\d{2}$/.test(s.trim());
      const toPointMs = (s) => {
        if (!s) return null;
        const [d, tm] = s.trim().split(/\s+/);
        if (hasTime(s)) return Date.parse(`${d}T${tm}:00Z`);
        return null;
      };

      const rule = f.rule;
      if (rule === 'blank') return !String(cellStr || '').trim();

      if (rule === 'today') {
        const now = new Date();
        const d = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
        return t >= dayStartMs(d) && t <= dayEndMs(d);
      }

      if (rule === 'before') {
        const p = toPointMs(f.to) ?? (f.to ? dayStartMs(f.to.trim()) : null);
        if (p == null) return true;
        return t < p;
      }
      if (rule === 'after') {
        const p = toPointMs(f.from) ?? (f.from ? dayEndMs(f.from.trim()) : null);
        if (p == null) return true;
        return t > p;
      }

      // between
      const fromHasTime = hasTime(f.from);
      const toHasTime = hasTime(f.to);

      const fromMs = f.from ? (toPointMs(f.from) ?? dayStartMs(f.from.trim())) : null;
      const toMs = f.to ? (toPointMs(f.to) ?? dayEndMs(f.to.trim())) : null;

      if (fromMs != null && toMs != null) return t >= fromMs && t <= toMs;
      if (fromMs != null) return t >= fromMs;
      if (toMs != null) return t <= toMs;
      return true;
    }

    // Ставит выпадающее меню ровно под кнопкой внутри текущего попапа
    function openMenuBelow(buttonEl, menuEl) {
      if (!buttonEl || !menuEl) return;
      const pop = buttonEl.closest('#ppPromoNamePop, #ppPromoTypePop, #ppPromoStartPop, #ppPromoEndPop');
      if (!pop) return;

      const popRect = pop.getBoundingClientRect();
      const btnRect = buttonEl.getBoundingClientRect();

      const left = btnRect.left - popRect.left;
      const top = btnRect.top - popRect.top + btnRect.height + 6;

      menuEl.style.position = 'absolute';
      menuEl.style.left = `${left}px`;
      menuEl.style.top = `${top}px`;
      menuEl.style.minWidth = `${btnRect.width}px`;
      menuEl.style.width = `${btnRect.width}px`;
      menuEl.hidden = false;
    }

    // --- normalize rows to LiveEvents table columns ---
    const base = (items || []).map((r) => ({
      state: 'On',
      name: r.name,
      type: r.type,
      startPretty: r.startPretty,
      endPretty: r.endPretty,
      startTS: r.startTS,
      endTS: r.endTS,
      raw: r.raw
    }));

    // --- state ---
    let sortKey = 'name';
    let sortDir = 'asc';

    let pageSize = 25;
    let page = 1;

    let nameFilter = { rule: 'contains', query: '' };
    let startFilter = { rule: 'between', from: '', to: '' };
    let endFilter = { rule: 'between', from: '', to: '' };

    const allTypes = Array.from(new Set(base.map(i => i.type).filter(Boolean))).sort();
    let typeFilter = new Set(); // empty = all
    let typeTextFilter = { rule: 'contains', query: '' };

    const allStates = ['On']; // promotions — всегда On (чтобы таблица 1-в-1 выглядела)
    let stateFilter = new Set(allStates); // по умолчанию всё включено

    // фиксированная высота тела (как LiveEvents)
    const FIXED_ROWS = 10;
    function setBodyHeightByRow() {
      const st = getComputedStyle(bodyEl);
      const padV = (parseFloat(st.paddingTop) || 0) + (parseFloat(st.paddingBottom) || 0);
      const rh = Number(getComputedStyle(wrap).getPropertyValue('--pp-row-h').replace('px', '')) || 52;
      bodyEl.style.height = (rh * FIXED_ROWS + padV) + 'px';
    }
    setBodyHeightByRow();

    // align panel top
    function alignDetailTop() {
      detEl.style.top = '0px';
      const floater = wrap.querySelector('#ppPromoLoClose');
      if (floater) floater.style.top = '8px';
    }
    alignDetailTop();
    if (headEl && typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(alignDetailTop).observe(headEl);
    }

    // --- filtering ---
    function applyFilters(list) {
      let rows = list.slice();

      // state
      if (stateFilter && stateFilter.size) {
        rows = rows.filter(r => stateFilter.has(r.state));
      }

      // name
      if (nameFilter) {
        const q = (nameFilter.query || '').toLowerCase();
        rows = rows.filter(r => {
          const s = (r.name || '').toLowerCase();
          switch (nameFilter.rule) {
            case 'contains': return s.includes(q);
            case 'notcontains': return q ? !s.includes(q) : true;
            case 'starts': return s.startsWith(q);
            case 'equals': return s === q;
            case 'blank': return !s.trim();
            default: return true;
          }
        });
      }

      // type (checkbox set)
      if (typeFilter && typeFilter.size) {
        rows = rows.filter(r => typeFilter.has(r.type));
      }

      // type (text rule)
      if (typeTextFilter) {
        const q = (typeTextFilter.query || '').toLowerCase();
        rows = rows.filter(r => {
          const s = (r.type || '').toLowerCase();
          switch (typeTextFilter.rule) {
            case 'contains': return s.includes(q);
            case 'notcontains': return q ? !s.includes(q) : true;
            case 'starts': return s.startsWith(q);
            case 'equals': return s === q;
            case 'blank': return !s.trim();
            default: return true;
          }
        });
      }

      // dates
      rows = rows.filter(r => passDateRule(r.startPretty, startFilter) && passDateRule(r.endPretty, endFilter));
      return rows;
    }

    // --- sorting ---
    function cmp(a, b) {
      const dir = (sortDir === 'desc') ? -1 : 1;
      const key = sortKey;

      const av = a[key];
      const bv = b[key];

      // timestamps for dates
      if (key === 'startPretty') return (a.startTS - b.startTS) * dir;
      if (key === 'endPretty') return (a.endTS - b.endTS) * dir;

      const as = String(av ?? '');
      const bs = String(bv ?? '');
      return as.localeCompare(bs) * dir;
    }

    // --- detail panel ---

    function showDetail(row) {
      if (!row) return;

      const rawName = String(row.name ?? '');
      const rawType = String(row.type ?? '');

      const safeName = escapeHtml(rawName);
      const safeType = escapeHtml(rawType);
      const safeStart = escapeHtml(row.startPretty);
      const safeEnd = escapeHtml(row.endPretty);

      const raw = row.raw ?? {};

      // --- small helpers ---
      const isTruthy = (v) => v === true || String(v).toLowerCase() === 'true';
      const lastToken = (s) => String(s || '').split('.').filter(Boolean).pop() || String(s || '');
      const esc = (v) => escapeHtml(String(v ?? ''));
      const asArr = (v) => Array.isArray(v) ? v : (v ? [v] : []);

      // ---- Theme (ONLY theme.id, no type/id labels) ----
      const themeId = raw?.theme?.id ?? raw?.themeId ?? '';

      // ---- Assets (rename ClientAssets -> Assets; group popup/icon; no horizontal scroll) ----
      // Source in JSON: raw.theme.clientAssets: [{name:'popup', android:'...', ios:'...'}, ...]
      // ---- Assets (2 buttons -> expands panels) ----
      // Source in JSON: raw.theme.clientAssets: [{name:'popup', android:'...', ios:'...'}, ...]

      // ---- Assets (accordion buttons: PopUp assets / Icon assets; panels under their button; full width) ----
      // Source in JSON: raw.theme.clientAssets: [{name:'popup', android:'...', ios:'...'}, ...]
      const clientAssets = asArr(raw?.theme?.clientAssets);

      const byName = (nm) => clientAssets.find(a => String(a?.name || '').toLowerCase() === nm);
      const popupA = byName('popup');
      const iconA = byName('icon');

      const assetBlock = (a) => {
        if (!a) return '<span class="muted">—</span>';
        const nm = esc(a?.name || '');
        const andPath = a?.android ? esc(a.android) : '';
        const iosPath = a?.ios ? esc(a.ios) : '';
        return `
  <div class="pp-assets2">
    <div class="pp-asset2">
      <div class="pp-asset2-name">${nm}</div>
      <div class="pp-asset2-lines">
        ${andPath ? `
          <div class="pp-asset2-line">
            <span class="pp-asset2-k">Android:</span>
            <code class="pp-asset2-code">${andPath}</code>
          </div>` : ''}
        ${iosPath ? `
          <div class="pp-asset2-line">
            <span class="pp-asset2-k">iOS:</span>
            <code class="pp-asset2-code">${iosPath}</code>
          </div>` : ''}
      </div>
    </div>
  </div>
`;
      };

      const assetsKvHtml = (popupA || iconA)
        ? `
    <div class="pp-kv pp-kv-assets">
      <span class="pp-k">Assets</span>

      ${popupA ? `
        <button type="button" class="pp-asset-toggle pp-asset-toggle-row" data-asset="popup" aria-expanded="false">
          <span class="pp-asset-toggle-text">PopUp assets</span>
          <span class="pp-asset-toggle-chev" aria-hidden="true">▸</span>
        </button>
        <div class="pp-asset-panel" data-asset-panel="popup" hidden>
          ${assetBlock(popupA)}
        </div>
      ` : ''}

      ${iconA ? `
        <button type="button" class="pp-asset-toggle pp-asset-toggle-row" data-asset="icon" aria-expanded="false">
          <span class="pp-asset-toggle-text">Icon assets</span>
          <span class="pp-asset-toggle-chev" aria-hidden="true">▸</span>
        </button>
        <div class="pp-asset-panel" data-asset-panel="icon" hidden>
          ${assetBlock(iconA)}
        </div>
      ` : ''}

    </div>
`
        : `
    <div class="pp-kv">
      <span class="pp-k">Assets</span>
      <span class="pp-v"><span class="muted">—</span></span>
    </div>
`;


      // ---- Segment / Subsegment (no duplicated word "Segment:" inside value) ----
      // segment = main value; externalSegment = subsegment (collapsible like LiveOps)
      const seg = raw?.segment ?? '';
      const subseg = raw?.externalSegment ?? '';

      const segmentHtml = `
        <div class="pp-seg-wrap">
          <div class="pp-seg-main"><code class="pp-code">${esc(seg) || '—'}</code></div>
          ${subseg
          ? `
              <details class="pp-extseg">
                <summary class="pp-extseg-sum">Show External Segment</summary>
                <div class="pp-extseg-val"><code class="pp-code">${esc(subseg)}</code></div>
              </details>
            `
          : ''}
        </div>
      `;

      // ---- Conditions (order: Level first, then AppVersion, then others) ----
      const conds = asArr(raw?.conditions);
      const normCond = (c) => {
        const path = String(c?.pathToField ?? '');
        const op = String(c?.operator ?? '');
        const val = String(c?.value ?? '');
        const p = path.toLowerCase();

        if (p.includes('level')) return { rank: 1, label: 'Level', op, val };
        if (p.includes('appversion')) return { rank: 2, label: 'AppVersion', op, val };

        return { rank: 3, label: lastToken(path), op, val };
      };

      const condHtml = conds.length
        ? `<div class="pp-lines">
            ${conds
          .map(normCond)
          .sort((a, b) => (a.rank - b.rank) || a.label.localeCompare(b.label))
          .map(c => `<div class="pp-line"><span class="pp-strong">${esc(c.label)}</span> ${esc(c.op)} <span class="pp-strong">${esc(c.val)}</span></div>`)
          .join('')}
          </div>`
        : '<span class="muted">—</span>';

      // ---- ProgressBar (ONLY if enabled; if disabled -> do not show at all) ----
      // If JSON has raw.displayProgressBar === true and raw.progressBar.missions: [{index:0,reward:'HC1'}, ...]
      const progressEnabled = isTruthy(raw?.displayProgressBar) || isTruthy(raw?.theme?.withProgressBar);
      const missions = asArr(raw?.progressBar?.missions);

      const progressBarBlock = (progressEnabled && missions.length)
        ? `
    <div class="pp-kv">
      <span class="pp-k">ProgressBar</span>
      <span class="pp-v">
        <div class="pp-lines">
          ${missions
          .slice()
          .sort((a, b) => Number(a?.index ?? 0) - Number(b?.index ?? 0))
          .map(m => {
            const idx = m?.index ?? '';
            const reward = m?.reward ?? '';
            return `<div class="pp-line"><span class="pp-strong">Index ${esc(idx)}</span>: <code class="pp-code">${esc(reward)}</code></div>`;
          })
          .join('')}
        </div>
      </span>
    </div>
  `
        : '';


      // ---- Offers (accordion like Assets: buttons on the right, panels full-width under each button) ----
      const offers = asArr(raw?.offers);

      const offerCard = (o) => {
        const sku = String(o?.sku ?? '').trim();
        const isFree = isTruthy(o?.isVirtual);

        const skuLine = sku
          ? (isFree ? `${esc(sku)} <span class="pp-free">(Free)</span>` : esc(sku))
          : (isFree ? '<span class="pp-free">Free</span>' : '<span class="muted">—</span>');

        const rewards = asArr(o?.rewards);

        // ВНУТРИ КАРТОЧКИ: только SKU + Rewards (без "Offer #N")
        return `
  <div class="pp-offer-card pp-offer-card-acc">
    <div class="pp-offer-row">
      <div class="pp-offer-k">SKU:</div>
      <div class="pp-offer-v"><code class="pp-code">${skuLine}</code></div>
    </div>

    <div class="pp-offer-row pp-offer-row-rews">
      <div class="pp-offer-k">Rewards:</div>
      <div class="pp-offer-v">
        ${rewards.length ? `
          <div class="pp-rews">
            ${rewards.map(r => {
          const rName = String(r?.name ?? '').trim();
          const rVal = r?.value ?? '';

          // “специфический тайп” — пытаемся вытащить максимально гибко
          const rTypeRaw =
            r?.type ??
            r?.rewardType ??
            r?.specificType ??
            r?.meta?.type ??
            r?.metaType ??
            '';

          const rType = String(rTypeRaw ?? '').trim();

          return `
          <div class="pp-rew-row">
            <div class="pp-rew-main">
              <span class="pp-rew-bullet" aria-hidden="true">•</span>
              <div class="pp-rew-content">
                <div class="pp-rew-line">
                  <code class="pp-code pp-rew-name">&#039;${esc(rName)}&#039;</code><span class="pp-colon">:</span>
                  <code class="pp-code">${esc(rVal)}</code>
                </div>

                ${rType ? `
                  <div class="pp-rew-meta">
                    <span class="pp-rew-meta-k">Type:</span>
                    <code class="pp-code pp-rew-meta-v">${esc(rType)}</code>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        `;
        }).join('')}

          </div>
        ` : '<span class="muted">—</span>'}
      </div>
    </div>
  </div>
`;
      };

      const offersKvHtml = offers.length
        ? `
  <div class="pp-kv pp-kv-offers">
    <span class="pp-k">Offers</span>

    ${offers.map((o, i) => `
      <button type="button"
              class="pp-offer-toggle pp-offer-toggle-row"
              data-offer="${i}"
              aria-expanded="false">
        <span class="pp-offer-toggle-text">Offer #${i + 1}</span>
        <span class="pp-offer-toggle-chev" aria-hidden="true">▸</span>
      </button>

      <div class="pp-offer-panel" data-offer-panel="${i}" hidden>
        ${offerCard(o)}
      </div>
    `).join('')}
  </div>
`
        : `
  <div class="pp-kv">
    <span class="pp-k">Offers</span>
    <span class="pp-v"><span class="muted">—</span></span>
  </div>
`;


      // ---- Raw (collapsible + copy button only when open; no layout shift) ----
      let rawPretty = '';
      let rawCopyText = '';
      try {
        rawCopyText = JSON.stringify(raw ?? {}, null, 2);
        rawPretty = escapeHtml(rawCopyText);
      } catch {
        rawCopyText = String(raw ?? '');
        rawPretty = escapeHtml(rawCopyText);
      }

      // Store raw copy text on panel element (NOT html-escaped)
      detEl.dataset.rawText = rawCopyText;

      detEl.innerHTML = `
  <div class="pp-kvs">

    <div class="pp-kv pp-kv-name">
      <span class="pp-k">Name</span>
      <span class="pp-v">
        <span class="pp-name-text">${safeName}</span>
        <button id="ppPromoCopyName" class="pp-ico" type="button" data-hint="Copy to clipboard" aria-label="Copy to clipboard">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 9h11v11H9V9zm-5 5V4h11" stroke="currentColor" stroke-width="1.5"></path>
          </svg>
        </button>
      </span>
    </div>

    <div class="pp-kv"><span class="pp-k">Type</span><span class="pp-v">${safeType}</span></div>

    <div class="pp-kv"><span class="pp-k">State</span>
      <span class="pp-v"><span class="pp-state"><span class="pp-check" aria-hidden="true">✓</span> On</span></span>
    </div>

    <div class="pp-kv"><span class="pp-k">Start</span><span class="pp-v">${safeStart}</span></div>
    <div class="pp-kv"><span class="pp-k">End</span><span class="pp-v">${safeEnd}</span></div>

    <!-- Conditions moved up near End -->
    <div class="pp-kv"><span class="pp-k">Conditions</span><span class="pp-v">${condHtml}</span></div>

  <div class="pp-kv"><span class="pp-k">Theme</span><span class="pp-v"><code class="pp-code">${esc(themeId) || '—'}</code></span></div>

  ${assetsKvHtml}



    <div class="pp-kv"><span class="pp-k">Segment</span><span class="pp-v">${segmentHtml}</span></div>

    <div class="pp-kv"><span class="pp-k">TimeDurationMinutes</span><span class="pp-v"><code class="pp-code">${esc(raw?.timeDurationMinutes ?? '—')}</code></span></div>

    <div class="pp-kv"><span class="pp-k">showOnBoard</span><span class="pp-v"><code class="pp-code">${esc(raw?.showOnBoard ?? '—')}</code></span></div>
    <div class="pp-kv"><span class="pp-k">showOn</span><span class="pp-v"><code class="pp-code">${esc(raw?.showOn ?? '—')}</code></span></div>

    ${progressBarBlock}

        ${offersKvHtml}


          <div class="pp-kv pp-kv-raw pp-kv-raw-only">
      <span class="pp-v">
        <details class="pp-raw-details">
          <summary class="pp-raw-sum">
            <span class="pp-raw-title">
              <span class="pp-raw-text">Show full Promotion JSON</span>
              <span class="pp-raw-chevron" aria-hidden="true">▸</span>
            </span>

            <button class="pp-ico pp-raw-copy" type="button" data-copy-raw="1" data-hint="Copy JSON" aria-label="Copy JSON">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 9h11v11H9V9zm-5 5V4h11" stroke="currentColor" stroke-width="1.5"></path>
              </svg>
            </button>
          </summary>

          <pre class="pp-raw">${rawPretty}</pre>
        </details>
      </span>
    </div>



  </div>
`;

      // IMPORTANT: кладём в data-copy-name НЕ html-escaped строку,
      // иначе в буфер улетает "&amp;" / "&#39;" и т.п.
      let copyBtn = detEl.querySelector('#ppPromoCopyName');

      // SAFETY: если по какой-то причине кнопка не попала в DOM — создадим её вручную
      if (!copyBtn) {
        const v = detEl.querySelector('.pp-kv-name .pp-v');
        if (v) {
          const btn = document.createElement('button');
          btn.id = 'ppPromoCopyName';
          btn.className = 'pp-ico';
          btn.type = 'button';
          btn.setAttribute('data-hint', 'Copy to clipboard');
          btn.setAttribute('aria-label', 'Copy to clipboard');
          btn.setAttribute('data-copy-name', '');

          btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 9h11v11H9V9zm-5 5V4h11" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        `.trim();

          v.appendChild(btn);
          copyBtn = btn;
        }
      }

      if (copyBtn) copyBtn.setAttribute('data-copy-name', rawName);



      // ---- OPEN the info panel (this is what makes "Info" visually work) ----
      detEl.setAttribute('aria-hidden', 'false');
      const liveopsEl = wrap.querySelector('#ppPromoLiveops') || wrap;
      liveopsEl.classList.add('info-open');

      // keep close button visible (CSS already depends on .info-open)


    }



    // copy name inside detail (same UX as LiveOps: icon button + tooltip)
    // copy buttons inside detail (Name + Raw JSON)
    detEl.addEventListener('click', async (e) => {

      // --- Assets toggles (independent: each button controls its own panel) ---
      const toggle = e.target.closest('button.pp-asset-toggle');
      if (toggle) {
        e.preventDefault();

        const kind = toggle.getAttribute('data-asset');
        if (!kind) return;

        const myPanel = detEl.querySelector(`.pp-asset-panel[data-asset-panel="${kind}"]`);
        if (!myPanel) return;

        const isOpen = toggle.getAttribute('aria-expanded') === 'true';
        const nextOpen = !isOpen;

        toggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
        const chev = toggle.querySelector('.pp-asset-toggle-chev');
        if (chev) chev.textContent = nextOpen ? '▾' : '▸';

        myPanel.hidden = !nextOpen;
        return;
      }

      // --- Offers toggles (independent: each button controls its own offer panel) ---
      const offerToggle = e.target.closest('button.pp-offer-toggle');
      if (offerToggle) {
        e.preventDefault();

        const idx = offerToggle.getAttribute('data-offer');
        if (idx == null) return;

        const myPanel = detEl.querySelector(`.pp-offer-panel[data-offer-panel="${idx}"]`);
        if (!myPanel) return;

        const isOpen = offerToggle.getAttribute('aria-expanded') === 'true';
        const nextOpen = !isOpen;

        offerToggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
        const chev = offerToggle.querySelector('.pp-offer-toggle-chev');
        if (chev) chev.textContent = nextOpen ? '▾' : '▸';

        myPanel.hidden = !nextOpen;
        return;
      }


      // --- RAW copy button ---
      const rawBtn = e.target.closest('button[data-copy-raw="1"]');
      if (rawBtn) {
        // IMPORTANT: do NOT toggle <details> when clicking the button in <summary>
        e.preventDefault();
        e.stopPropagation();

        const text = detEl.dataset.rawText || '';
        const prevHint = rawBtn.getAttribute('data-hint') || 'Copy JSON';

        const setHintTemp = (hint) => {
          rawBtn.setAttribute('data-hint', hint);
          setTimeout(() => rawBtn.setAttribute('data-hint', prevHint), 900);
        };

        try {
          await navigator.clipboard.writeText(text);
          setHintTemp('Copied!');
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          setHintTemp('Copied!');
        }
        return;
      }

      // --- Name copy button ---
      const b = e.target.closest('button[data-copy-name]');
      if (!b) return;

      const text = b.getAttribute('data-copy-name') || '';
      const prevHint = b.getAttribute('data-hint') || 'Copy to clipboard';

      const setHintTemp = (hint) => {
        b.setAttribute('data-hint', hint);
        setTimeout(() => b.setAttribute('data-hint', prevHint), 900);
      };

      try {
        await navigator.clipboard.writeText(text);
        setHintTemp('Copied!');
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setHintTemp('Copied!');
      }
    });



    // --- pagination controls ---
    const rowsSel = wrap.querySelector('#ppPromoRows');
    const rangeEl = wrap.querySelector('#ppPromoRange');
    const firstBtn = wrap.querySelector('#ppPromoFirst');
    const prevBtn = wrap.querySelector('#ppPromoPrev');
    const nextBtn = wrap.querySelector('#ppPromoNext');
    const lastBtn = wrap.querySelector('#ppPromoLast');
    const resetBtn = wrap.querySelector('#ppPromoResetBtn');

    // --- header click sort by column ---
    function syncPromoSortIcons() {
      const map = [
        ['#ppPromoStateBtn', 'state'],
        ['#ppPromoNameBtn', 'name'],
        ['#ppPromoTypeBtn', 'type'],
        ['#ppPromoStartBtn', 'startPretty'],
        ['#ppPromoEndBtn', 'endPretty'],
      ];

      map.forEach(([sel, key]) => {
        const btn = wrap.querySelector(sel);
        if (!btn) return;

        const ico = btn.querySelector('.arr');
        if (!ico) return;

        // default
        ico.textContent = '↕';

        // active column
        if (sortKey === key) {
          ico.textContent = (sortDir === 'asc') ? '↑' : '↓';
        }
      });
    }

    function wireSort(btnId, key) {
      const b = wrap.querySelector(btnId);
      b?.addEventListener('click', (e) => {
        // если кликнули по иконке фильтра — НЕ сортируем
        if (e.target.closest('.pp-filter-ico')) return;

        e.stopPropagation();
        if (sortKey === key) sortDir = (sortDir === 'asc') ? 'desc' : 'asc';
        else { sortKey = key; sortDir = 'asc'; }

        renderRows(true);
        syncPromoSortIcons();
      });
    }

    wireSort('#ppPromoStateBtn', 'state');
    wireSort('#ppPromoNameBtn', 'name');
    wireSort('#ppPromoTypeBtn', 'type');
    wireSort('#ppPromoStartBtn', 'startPretty');
    wireSort('#ppPromoEndBtn', 'endPretty');

    // --- render rows ---
    let allFilteredSorted = [];
    function renderRows(resetPage) {
      if (resetPage) page = 1;

      allFilteredSorted = applyFilters(base).sort(cmp);

      const total = allFilteredSorted.length;
      const pages = Math.max(1, Math.ceil(total / pageSize));
      page = Math.max(1, Math.min(page, pages));

      const from = (page - 1) * pageSize;
      const to = Math.min(total, from + pageSize);
      const view = allFilteredSorted.slice(from, to);

      // range label
      if (rangeEl) rangeEl.textContent = total ? `${from + 1}–${to} of ${total}` : '0–0 of 0';

      // nav state
      if (firstBtn) firstBtn.disabled = page <= 1;
      if (prevBtn) prevBtn.disabled = page <= 1;
      if (nextBtn) nextBtn.disabled = page >= pages;
      if (lastBtn) lastBtn.disabled = page >= pages;

      // rows html (make Promotions rows identical to LiveOps rows)
      // - State: use .pp-state with green check ✓ (same CSS as LiveOps)
      // - Name: use same ".cell" structure so existing ellipsis rule applies
      // - Info: same button classes as LiveOps to match size/spacing
      bodyEl.innerHTML = view.map((r) => {
        const label = String(r.state || 'On');
        return `
              <div class="pp-t-row" data-name="${escapeHtml(r.name)}">
                <div class="cell">
                  <span class="pp-state on">
                    <span class="dot"></span><span class="lbl">${escapeHtml(label)}</span>
                  </span>
                </div>

                <div class="cell">${escapeHtml(r.name)}</div>
                <div class="cell type">${escapeHtml(r.type)}</div>
                <div class="cell">${escapeHtml(r.startPretty)}</div>
                <div class="cell">${escapeHtml(r.endPretty)}</div>

                <div class="cell">
                  <button class="pp-btn pp-info" type="button" data-info="1">Info</button>
                </div>
              </div>
            `;
      }).join('');

      syncPromoSortIcons();
    }

    // --- click row: info ---
    bodyEl.addEventListener('click', (e) => {
      const infoBtn = e.target.closest('button[data-info="1"]');
      if (!infoBtn) return;

      const rowEl = infoBtn.closest('.pp-t-row');
      const name = rowEl?.getAttribute('data-name') || '';
      const row = allFilteredSorted.find(x => x.name === name) || null;

      // выделение выбранной строки
      bodyEl.querySelectorAll('.pp-t-row.selected').forEach(n => n.classList.remove('selected'));
      rowEl?.classList.add('selected');

      showDetail(row);
    });

    // --- pager events ---
    rowsSel?.addEventListener('change', () => {
      pageSize = Number(rowsSel.value || 25);
      renderRows(true);
    });
    firstBtn?.addEventListener('click', () => { page = 1; renderRows(false); });
    prevBtn?.addEventListener('click', () => { page = Math.max(1, page - 1); renderRows(false); });
    nextBtn?.addEventListener('click', () => { page = page + 1; renderRows(false); });
    lastBtn?.addEventListener('click', () => {
      const pages = Math.max(1, Math.ceil(allFilteredSorted.length / pageSize));
      page = pages;
      renderRows(false);
    });

    resetBtn?.addEventListener('click', () => {
      nameFilter = { rule: 'contains', query: '' };
      typeFilter = new Set();
      typeTextFilter = { rule: 'contains', query: '' };
      startFilter = { rule: 'between', from: '', to: '' };
      endFilter = { rule: 'between', from: '', to: '' };
      stateFilter = new Set(allStates);

      // UI sync minimal (попапы сами подтянут draft при открытии)
      wrap.classList.remove('info-open');
      detEl.innerHTML = '';
      renderRows(true);
    });

    // --- filter wiring (State) ---
    (function wireStateFilter() {
      const btn = wrap.querySelector('#ppPromoStateBtn');
      const pop = wrap.querySelector('#ppPromoStatePop');
      const list = wrap.querySelector('#ppPromoStateList');
      const allBtn = wrap.querySelector('#ppPromoStateAll');
      const noneBtn = wrap.querySelector('#ppPromoStateNone');
      const reset = wrap.querySelector('#ppPromoStateReset');
      const apply = wrap.querySelector('#ppPromoStateApply');

      if (!btn || !pop || !list) return;

      let draft = new Set(stateFilter);

      function renderList() {
        list.innerHTML = allStates.map(s => {
          const id = `ppPromoState_${s}`;
          const checked = draft.has(s) ? 'checked' : '';
          return `<label class="pp-chk"><input type="checkbox" data-val="${escapeHtml(s)}" ${checked}/> <span>${escapeHtml(s)}</span></label>`;
        }).join('');
      }

      btn.addEventListener('click', (e) => {
        // открываем фильтр ТОЛЬКО по клику на funnel-иконку
        if (!e.target.closest('.pp-filter-ico')) return;

        e.stopPropagation();
        // close others
        wrap.querySelector('#ppPromoNamePop')?.setAttribute('hidden', '');
        wrap.querySelector('#ppPromoTypePop')?.setAttribute('hidden', '');
        wrap.querySelector('#ppPromoStartPop')?.setAttribute('hidden', '');
        wrap.querySelector('#ppPromoEndPop')?.setAttribute('hidden', '');

        const willOpen = pop.hidden;
        pop.hidden = !pop.hidden;
        if (willOpen) {
          draft = new Set(stateFilter);
          renderList();
        }
      });

      list.addEventListener('change', (e) => {
        const inp = e.target.closest('input[type="checkbox"][data-val]');
        if (!inp) return;
        const v = inp.getAttribute('data-val');
        if (inp.checked) draft.add(v); else draft.delete(v);
      });

      allBtn?.addEventListener('click', () => { draft = new Set(allStates); renderList(); });
      noneBtn?.addEventListener('click', () => { draft = new Set(); renderList(); });
      reset?.addEventListener('click', () => { draft = new Set(allStates); stateFilter = new Set(allStates); pop.hidden = true; renderRows(true); });
      apply?.addEventListener('click', () => { stateFilter = new Set(draft); pop.hidden = true; renderRows(true); });

      document.addEventListener('click', (e) => {
        if (!document.body.contains(pop) || pop.hidden) return;
        if (e.target.closest('#ppPromoStatePop') || e.target.closest('#ppPromoStateBtn')) return;
        pop.hidden = true;
      });
    })();

    // --- filter wiring (Name) ---
    (function wireNameFilter() {
      const btn = wrap.querySelector('#ppPromoNameBtn');
      const pop = wrap.querySelector('#ppPromoNamePop');
      const ruleBtn = wrap.querySelector('#ppPromoNameRuleBtn');
      const ruleMenu = wrap.querySelector('#ppPromoNameRuleMenu');
      const queryInput = wrap.querySelector('#ppPromoNameQuery');
      const reset = wrap.querySelector('#ppPromoNameReset');
      const apply = wrap.querySelector('#ppPromoNameApply');

      if (!btn || !pop) return;

      function syncConfirmState() {
        // ничего «умного» — просто держим UI живым
      }

      btn.addEventListener('click', (e) => {
        // открываем фильтр ТОЛЬКО по клику на funnel-иконку
        if (!e.target.closest('.pp-filter-ico')) return;

        e.stopPropagation();

        wrap.querySelector('#ppPromoStatePop')?.setAttribute('hidden', '');
        wrap.querySelector('#ppPromoTypePop')?.setAttribute('hidden', '');
        wrap.querySelector('#ppPromoStartPop')?.setAttribute('hidden', '');
        wrap.querySelector('#ppPromoEndPop')?.setAttribute('hidden', '');

        const willOpen = pop.hidden;
        pop.hidden = !pop.hidden;
        if (willOpen) {
          ruleBtn.dataset.val = nameFilter.rule || 'contains';
          ruleBtn.querySelector('.txt').textContent = ({
            contains: 'Contains', notcontains: 'Not contains', starts: 'Starts with', equals: 'Equals', blank: 'Is blank'
          })[ruleBtn.dataset.val] || 'Contains';
          queryInput.value = nameFilter.query || '';
          queryInput.focus();
        }
      });


      ruleBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (ruleMenu.hidden) openMenuBelow(ruleBtn, ruleMenu);
        else ruleMenu.hidden = true;
      });

      ruleMenu?.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-val]');
        if (!b) return;
        ruleBtn.dataset.val = b.dataset.val;
        ruleBtn.querySelector('.txt').textContent = b.textContent;
        ruleMenu.hidden = true;
        syncConfirmState();
      });

      queryInput?.addEventListener('input', syncConfirmState);

      reset?.addEventListener('click', () => {
        nameFilter = { rule: 'contains', query: '' };
        ruleBtn.dataset.val = 'contains';
        ruleBtn.querySelector('.txt').textContent = 'Contains';
        queryInput.value = '';
        pop.hidden = true;
        renderRows(true);
      });

      apply?.addEventListener('click', () => {
        nameFilter = { rule: ruleBtn.dataset.val, query: queryInput.value.trim() };
        pop.hidden = true;
        renderRows(true);
      });

      document.addEventListener('click', (e) => {
        if (!document.body.contains(pop) || pop.hidden) return;

        if (!ruleMenu.hidden &&
          !e.target.closest('#ppPromoNameRuleMenu') &&
          !e.target.closest('#ppPromoNameRuleBtn')) {
          ruleMenu.hidden = true;
          return;
        }
        if (e.target.closest('#ppPromoNamePop') || e.target.closest('#ppPromoNameBtn')) return;
        pop.hidden = true;
        ruleMenu.hidden = true;
      });
    })();

    // --- filter wiring (Type) ---
    (function wireTypeFilter() {
      const btn = wrap.querySelector('#ppPromoTypeBtn');
      const pop = wrap.querySelector('#ppPromoTypePop');

      const search = wrap.querySelector('#ppPromoTypeSearch');
      const listBox = wrap.querySelector('#ppPromoTypeList');
      const allBtn = wrap.querySelector('#ppPromoTypeAll');
      const noneBtn = wrap.querySelector('#ppPromoTypeNone');

      const ruleBtn = wrap.querySelector('#ppPromoTypeRuleBtn');
      const ruleMenu = wrap.querySelector('#ppPromoTypeRuleMenu');
      const queryInput = wrap.querySelector('#ppPromoTypeQuery');

      const reset = wrap.querySelector('#ppPromoTypeReset');
      const apply = wrap.querySelector('#ppPromoTypeApply');

      if (!btn || !pop || !listBox) return;

      let draftSet = new Set(typeFilter);
      let draftText = { ...typeTextFilter };

      function buildList(q) {
        const qq = String(q || '').toLowerCase();
        const filtered = allTypes.filter(t => String(t || '').toLowerCase().includes(qq));
        listBox.innerHTML = filtered.map(t => {
          const checked = draftSet.has(t) ? 'checked' : '';
          return `<label class="pp-chk"><input type="checkbox" data-val="${escapeHtml(t)}" ${checked}/> <span>${escapeHtml(t)}</span></label>`;
        }).join('');
      }

      btn.addEventListener('click', (e) => {
        if (!e.target.closest('.pp-filter-ico')) return;
        e.stopPropagation();

        wrap.querySelector('#ppPromoStatePop')?.setAttribute('hidden', '');
        wrap.querySelector('#ppPromoNamePop')?.setAttribute('hidden', '');
        wrap.querySelector('#ppPromoStartPop')?.setAttribute('hidden', '');
        wrap.querySelector('#ppPromoEndPop')?.setAttribute('hidden', '');

        const willOpen = pop.hidden;
        pop.hidden = !pop.hidden;

        if (willOpen) {
          draftSet = new Set(typeFilter);
          draftText = { ...typeTextFilter };
          search.value = '';
          buildList('');

          ruleBtn.dataset.val = draftText.rule || 'contains';
          ruleBtn.querySelector('.txt').textContent = ({
            contains: 'Contains', notcontains: 'Not contains', starts: 'Starts with', equals: 'Equals', blank: 'Is blank'
          })[ruleBtn.dataset.val] || 'Contains';

          queryInput.value = draftText.query || '';
        }
      });

      search?.addEventListener('input', () => buildList(search.value));

      listBox.addEventListener('change', (e) => {
        const inp = e.target.closest('input[type="checkbox"][data-val]');
        if (!inp) return;
        const v = inp.getAttribute('data-val');
        if (inp.checked) draftSet.add(v); else draftSet.delete(v);
      });

      allBtn?.addEventListener('click', () => { draftSet = new Set(allTypes); buildList(search.value); });
      noneBtn?.addEventListener('click', () => { draftSet = new Set(); buildList(search.value); });

      ruleBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (ruleMenu.hidden) openMenuBelow(ruleBtn, ruleMenu);
        else ruleMenu.hidden = true;
      });

      ruleMenu?.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-val]');
        if (!b) return;
        ruleBtn.dataset.val = b.dataset.val;
        ruleBtn.querySelector('.txt').textContent = b.textContent;
        ruleMenu.hidden = true;
      });

      reset?.addEventListener('click', () => {
        typeFilter = new Set();
        typeTextFilter = { rule: 'contains', query: '' };
        pop.hidden = true;
        renderRows(true);
      });

      apply?.addEventListener('click', () => {
        typeFilter = new Set(draftSet);
        typeTextFilter = { rule: ruleBtn.dataset.val, query: queryInput.value.trim() };
        pop.hidden = true;
        renderRows(true);
      });

      document.addEventListener('click', (e) => {
        if (!document.body.contains(pop) || pop.hidden) return;
        if (!ruleMenu.hidden &&
          !e.target.closest('#ppPromoTypeRuleMenu') &&
          !e.target.closest('#ppPromoTypeRuleBtn')) {
          ruleMenu.hidden = true;
          return;
        }
        if (e.target.closest('#ppPromoTypePop') || e.target.closest('#ppPromoTypeBtn')) return;
        pop.hidden = true;
        ruleMenu.hidden = true;
      });
    })();

    // --- wire date filters (Start/End) ---
    function wireDateFilter(cfg) {
      const btn = wrap.querySelector(cfg.btnSel);
      const pop = wrap.querySelector(cfg.popSel);
      const ruleBtn = wrap.querySelector(cfg.ruleBtnSel);
      const ruleMenu = wrap.querySelector(cfg.ruleMenuSel);
      const fromInp = wrap.querySelector(cfg.fromSel);
      const toInp = wrap.querySelector(cfg.toSel);
      const resetBtn = wrap.querySelector(cfg.resetSel);
      const applyBtn = wrap.querySelector(cfg.applySel);

      const labels = { between: 'Between', before: 'Before', after: 'After', today: 'Today', blank: 'Is blank' };

      if (!btn || !pop) return;

      btn.addEventListener('click', (e) => {
        if (!e.target.closest('.pp-filter-ico')) return;
        e.stopPropagation();

        wrap.querySelector('#ppPromoStatePop')?.setAttribute('hidden', '');
        wrap.querySelector('#ppPromoNamePop')?.setAttribute('hidden', '');
        wrap.querySelector('#ppPromoTypePop')?.setAttribute('hidden', '');
        // закрыть второй date-pop, чтобы не было двух одновременно
        if (cfg.popSel === '#ppPromoStartPop') wrap.querySelector('#ppPromoEndPop')?.setAttribute('hidden', '');
        if (cfg.popSel === '#ppPromoEndPop') wrap.querySelector('#ppPromoStartPop')?.setAttribute('hidden', '');

        const willOpen = pop.hidden;
        pop.hidden = !pop.hidden;

        if (willOpen) {
          const cur = cfg.get();
          ruleBtn.dataset.val = cur.rule || 'between';
          ruleBtn.querySelector('.txt').textContent = labels[ruleBtn.dataset.val] || 'Between';
          if (fromInp) fromInp.value = cur.from || '';
          if (toInp) toInp.value = cur.to || '';
        }
      });

      // tabs inside pop
      pop.querySelectorAll('.pp-dtp-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          pop.querySelector('.pp-dtp')?.setAttribute('data-active', tab.dataset.bind);
        });
      });

      ruleBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (ruleMenu.hidden) openMenuBelow(ruleBtn, ruleMenu);
        else ruleMenu.hidden = true;
      });

      ruleMenu?.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-val]');
        if (!b) return;
        ruleBtn.dataset.val = b.dataset.val;
        ruleBtn.querySelector('.txt').textContent = b.textContent;
        ruleMenu.hidden = true;
      });

      resetBtn?.addEventListener('click', () => {
        cfg.set({ rule: 'between', from: '', to: '' });
        if (fromInp) fromInp.value = '';
        if (toInp) toInp.value = '';
        pop.hidden = true;
        renderRows(true);
      });

      applyBtn?.addEventListener('click', () => {
        cfg.set({ rule: ruleBtn.dataset.val, from: fromInp?.value || '', to: toInp?.value || '' });
        pop.hidden = true;
        renderRows(true);
      });

      document.addEventListener('click', (e) => {
        if (!document.body.contains(pop) || pop.hidden) return;
        if (e.target.closest(cfg.popSel) || e.target.closest(cfg.btnSel)) return;
        pop.hidden = true;
        if (ruleMenu) ruleMenu.hidden = true;
      });
    }

    wireDateFilter({
      btnSel: '#ppPromoStartBtn', popSel: '#ppPromoStartPop',
      ruleBtnSel: '#ppPromoStartRuleBtn', ruleMenuSel: '#ppPromoStartRuleMenu',
      fromSel: '#ppPromoStartFrom', toSel: '#ppPromoStartTo',
      resetSel: '#ppPromoStartReset', applySel: '#ppPromoStartApply',
      get: () => startFilter, set: (v) => { startFilter = v; }
    });
    wireDateFilter({
      btnSel: '#ppPromoEndBtn', popSel: '#ppPromoEndPop',
      ruleBtnSel: '#ppPromoEndRuleBtn', ruleMenuSel: '#ppPromoEndRuleMenu',
      fromSel: '#ppPromoEndFrom', toSel: '#ppPromoEndTo',
      resetSel: '#ppPromoEndReset', applySel: '#ppPromoEndApply',
      get: () => endFilter, set: (v) => { endFilter = v; }
    });

    // initial UI defaults
    const stateList = wrap.querySelector('#ppPromoStateList');
    if (stateList) {
      stateList.innerHTML = `<label class="pp-chk"><input type="checkbox" checked disabled /> <span>On</span></label>`;
    }

    // initial render
    renderRows(true);
  }



  function initPromoTimeline(items, wrap) {
    // Promotions календарь = тот же движок, что и у LiveOps (ProfileParser.js),
    // только с другими id (promoTl*)
    if (typeof window.initTimelineCalendar === 'function') {

      // 1) Нормализуем, чтобы движок точно получил name (он мапит title из x.name)
      const normalized = (items || []).map((it) => {
        const t = (it?.name ?? it?.title ?? it?.id ?? '').toString();
        return {
          ...it,
          name: (it?.name ?? t),
          title: (it?.title ?? t),
        };
      });

      window.initTimelineCalendar(normalized, {
        title: 'promoTlTitle',
        header: 'promoTlHeader',
        body: 'promoTlBody',
        res: 'promoTlResList',
        grid: 'promoTlGrid',
        toolbar: 'promoTlToolbar',
        dateInput: 'promoTlDateInput',
      });



      const forceTitles = () => {
        const root = document.getElementById('ppPromoCal');
        if (!root) return;

        const promoBody = document.getElementById('promoTlBody');
        const bodyRect = promoBody ? promoBody.getBoundingClientRect() : null;

        // Promotions может рендерить бары как .tl-event и/или .pp-cal-bar (на разных режимах)
        const bars = root.querySelectorAll('.tl-event, .pp-cal-bar');

        bars.forEach(bar => {
          const title = (bar.dataset.title || '').trim();
          if (!title) return;

          let txt = bar.querySelector('.txt');
          if (!txt) {
            txt = document.createElement('span');
            txt.className = 'txt';
            bar.insertBefore(txt, bar.firstChild);
          }

          // Всегда восстанавливаем текст (не только если пусто)
          txt.textContent = title;

          // Визуальная страховка
          txt.style.display = 'block';
          txt.style.opacity = '1';
          txt.style.visibility = 'visible';
          txt.style.color = '#fff';
          txt.style.webkitTextFillColor = '#fff';
          txt.style.zIndex = '10';
          txt.style.pointerEvents = 'none';

          // ВАЖНО: уходим от sticky (он у тебя и даёт “плавание” под нагрузкой)
          // Делаем текст абсолютным и компенсируем scroll вручную через translate3d.
          txt.style.position = 'absolute';
          txt.style.left = '0';
          txt.style.top = '0';
          txt.style.bottom = '0';
          txt.style.padding = '0 6px 0 8px';
          txt.style.whiteSpace = 'nowrap';
          txt.style.overflow = 'hidden';
          txt.style.textOverflow = 'ellipsis';
          txt.style.willChange = 'transform';

          // ---- ручная "липкость" по реальным координатам (без offsetLeft) ----
          if (!bodyRect) {
            txt.style.transform = 'translate3d(0px,0,0)';
            return;
          }

          const barRect = bar.getBoundingClientRect();

          // сколько бар ушёл левее видимой области
          let shift = bodyRect.left - barRect.left;
          if (!Number.isFinite(shift)) shift = 0;
          if (shift < 0) shift = 0;

          // не даём тексту уехать правее ширины бара
          const maxShift = Math.max(0, barRect.width - 16);
          if (shift > maxShift) shift = maxShift;

          txt.style.transform = `translate3d(${Math.round(shift)}px,0,0)`;
        });
      };

      // debounce wrapper to avoid calling forceTitles too often (MutationObserver can be noisy)
      let _forceTitlesRaf = 0;
      const scheduleForceTitles = () => {
        if (_forceTitlesRaf) return;
        _forceTitlesRaf = requestAnimationFrame(() => {
          _forceTitlesRaf = 0;
          forceTitles();
        });
      };




      // два тика, потому что таймлайн иногда дорисовывает строки после первого кадра
      // два тика, потому что таймлайн иногда дорисовывает строки после первого кадра
      requestAnimationFrame(() => {
        forceTitles();
        requestAnimationFrame(forceTitles);
      });

      // === PLAN B+++: Promotions таймлайн при скролле/сдвиге якоря делает render(),
      // который пересоздаёт бары => .txt может снова пропадать.
      // Поэтому:
      // 1) слушаем scroll на правом полотне
      // 2) слушаем любые мутации DOM (render пересоздаёт ноды)
      // и всегда мягко восстанавливаем .txt из bar.dataset.title
      // rAF-петля во время активного скролла:
      // обновляем позиции текста каждый кадр => нет "плавания" и "догона" после остановки
      const bindSmoothScrollTitles = (() => {
        let raf = 0;
        let lastScrollTs = 0;

        const tick = () => {
          raf = 0;
          forceTitles();

          // если скролл был совсем недавно — продолжаем крутить кадры
          if (Date.now() - lastScrollTs < 140) {
            raf = requestAnimationFrame(tick);
          }
        };

        return () => {
          const promoBody = document.getElementById('promoTlBody');
          if (!promoBody) return;

          promoBody.addEventListener(
            'scroll',
            () => {
              lastScrollTs = Date.now();
              if (!raf) raf = requestAnimationFrame(tick);
            },
            { passive: true }
          );
        };
      })();

      bindSmoothScrollTitles();


      const moRoot = document.getElementById('ppPromoCal');
      if (moRoot && typeof MutationObserver !== 'undefined') {
        const mo = new MutationObserver(scheduleForceTitles);
        mo.observe(moRoot, { childList: true, subtree: true });
      }


      // 3) один дополнительный тик — на случай поздних дорисовок после resize/first paint
      setTimeout(forceTitles, 0);

      // 4) ГАРАНТИЯ: движок таймлайна может пересоздать DOM уже ПОСЛЕ rAF/setTimeout(0)
      // (что у тебя и видно: текст появляется только когда ты начинаешь скроллить).
      // Поэтому "дожимаем" восстановление заголовков коротким интервалом ~2 секунды.
      // Останавливаемся раньше, если у всех баров уже есть непустой .txt.
      const hasAllTitles = () => {
        const root = document.getElementById('ppPromoCal');
        if (!root) return false;
        const bars = root.querySelectorAll('.pp-cal-bar, .tl-event');
        if (!bars.length) return false;

        for (const bar of bars) {
          const title = (bar.dataset.title || '').trim();
          if (!title) continue; // если у бара нет title — пропускаем, он не критерий
          const txt = bar.querySelector('.txt');
          if (!txt || !txt.textContent || !txt.textContent.trim()) return false;
        }
        return true;
      };

      let tries = 0;
      const maxTries = 20;      // 20 * 100ms = ~2 секунды
      const interval = setInterval(() => {
        forceTitles();

        tries++;
        if (tries >= maxTries || hasAllTitles()) {
          clearInterval(interval);
        }
      }, 100);

      return;


    }

    // fallback: если по какой-то причине LiveOps календарь недоступен
    console.warn('[Promotions] initTimelineCalendar not found. Promotions timeline is not initialized.');
  }





  // ---------- public api ----------
  window.PP_Promotions = {
    extract: extractPromotions,
    appendPromotionsUI
  };
})();
