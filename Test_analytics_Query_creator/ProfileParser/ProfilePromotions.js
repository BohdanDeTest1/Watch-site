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

            return {
                id: String(id),
                name: String(name),
                type: String(type),
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
        <div class="tl-res-header">Types</div>
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

  <!-- [TABLE] LiveOps-like compact table -->
  <section class="pp-lo" style="margin-top:10px;">
    <div class="pp-lo-table" id="ppPromoTable">
      <div class="pp-t-head">
        <div class="pp-t-row">
          <div class="pp-t-cell col-name">Name</div>
          <div class="pp-t-cell col-type">Type</div>
          <div class="pp-t-cell col-start">Start Date</div>
          <div class="pp-t-cell col-end">End Date</div>
          <div class="pp-t-cell col-info"></div>
        </div>
      </div>
      <div class="pp-t-body" id="ppPromoTBody"></div>
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
        const body = wrap.querySelector('#ppPromoTBody');
        if (!body) return;

        const rows = (items || []).slice().sort((a, b) => a.startTS - b.startTS);

        body.innerHTML = rows.map(r => `
<div class="pp-t-row">
  <div class="pp-t-cell col-name" title="${escapeHtml(r.name)}">${escapeHtml(r.name)}</div>
  <div class="pp-t-cell col-type" title="${escapeHtml(r.type)}">${escapeHtml(r.type)}</div>
  <div class="pp-t-cell col-start">${escapeHtml(r.startPretty)}</div>
  <div class="pp-t-cell col-end">${escapeHtml(r.endPretty)}</div>
  <div class="pp-t-cell col-info">
    <button class="pp-btn pp-btn-sm" type="button" data-raw="${escapeHtml(JSON.stringify(r.raw))}">Info</button>
  </div>
</div>
`).join('');

        // простой Info (alert) — чтобы поведение было “как минимум” похоже
        body.addEventListener('click', (e) => {
            const b = e.target.closest('button[data-raw]');
            if (!b) return;
            try {
                const raw = JSON.parse(b.dataset.raw || '{}');
                alert(JSON.stringify(raw, null, 2));
            } catch {
                alert(b.dataset.raw || '');
            }
        });
    }

    function initPromoTimeline(items, wrap) {
        // Promotions календарь = тот же движок, что и у LiveOps (ProfileParser.js),
        // только с другими id (promoTl*)
        if (typeof window.initTimelineCalendar === 'function') {
            window.initTimelineCalendar(items, {
                title: 'promoTlTitle',
                header: 'promoTlHeader',
                body: 'promoTlBody',
                res: 'promoTlResList',
                grid: 'promoTlGrid',
                toolbar: 'promoTlToolbar',
                dateInput: 'promoTlDateInput',
            });
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
