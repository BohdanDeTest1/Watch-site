/* ProfilePromotions.js
   Promotions: parse + calendar + table (scoped, no conflicts with LiveOps)
*/
(function () {
    // ---------- utils ----------
    function el(q) { return document.querySelector(q); }

    function toMsAny(v) {
        if (v == null || v === '') return NaN;
        if (typeof v === 'number' && Number.isFinite(v)) return v < 1e12 ? v * 1000 : v;
        if (typeof v === 'string' && /^[0-9]+$/.test(v)) {
            const n = Number(v);
            return n < 1e12 ? n * 1000 : n;
        }
        const t = Date.parse(String(v));
        return Number.isFinite(t) ? t : NaN;
    }

    function fmtUtc(ms) {
        if (!Number.isFinite(ms)) return '—';
        const d = new Date(ms);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
    }

    function escapeHtml(s) {
        return String(s ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function uniq(arr) {
        const out = [];
        const set = new Set();
        for (const x of (arr || [])) {
            const k = String(x ?? '').trim();
            if (!k || set.has(k)) continue;
            set.add(k);
            out.push(k);
        }
        return out;
    }

    // ---------- parser (tolerant) ----------
    // NOTE: структура promosScheduleNew может отличаться — поэтому делаем “поиск кандидатов” как в LiveOps.
    function extractPromotions(json) {
        const candidates = [
            json?.data?.promotionsScheduleNew,
            json?.data?.promotions,
            json?.data?.items,
            json?.promotionsScheduleNew,
            json?.promotions,
            json?.items
        ].filter(Boolean);

        let raw = candidates.find(x => Array.isArray(x) || typeof x === 'object');
        if (!raw) return [];

        let arr = [];
        if (Array.isArray(raw)) {
            arr = raw;
        } else {
            // объект с ключами-идентификаторами
            arr = Object.entries(raw).map(([id, v]) => ({ id, ...v }));
        }

        // Нормализуем к единому виду: { id, name, type, startTS, endTS, startPretty, endPretty }
        return arr.map((it, idx) => {
            const id = it.id ?? it.ID ?? idx;

            const name =
                it.name ??
                it.title ??
                it.promoName ??
                it.promotionName ??
                `Promotion ${idx + 1}`;

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
                id,
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

    // ---------- UI: section + calendar + table ----------
    function appendPromotionsUI(items) {
        const wrap = document.createElement('div');
        wrap.className = 'pp-item collapsible collapsed';
        wrap.innerHTML = `
      <div class="pp-title">
        <button class="pp-collapser" type="button">
          Promotions <span class="chev">▾</span>
        </button>
      </div>

      <div class="pp-body">
        <section class="pp-promos" id="ppPromos">
          <div class="pp-promos__cal" id="ppPromosCal"></div>
          <div class="pp-promos__table" id="ppPromosTable"></div>
        </section>
      </div>
    `;

        // collapsible logic (используем уже существующий wireCollapser из ProfileParser.js, если он есть)
        if (typeof window.wireCollapser === 'function') {
            window.wireCollapser(wrap);
        } else {
            // fallback: простое сворачивание
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

        // render calendar + table
        renderCalendar(items, wrap.querySelector('#ppPromosCal'));
        renderTable(items, wrap.querySelector('#ppPromosTable'));
    }

    function renderTable(items, mount) {
        if (!mount) return;

        if (!items || !items.length) {
            mount.innerHTML = `<div class="pp-meta">No promotions found</div>`;
            return;
        }

        // простой сорт: start asc
        const rows = items.slice().sort((a, b) => a.startTS - b.startTS);

        mount.innerHTML = `
      <div class="pp-promos__table-head">
        <div class="pp-promos__h">Name</div>
        <div class="pp-promos__h">Type</div>
        <div class="pp-promos__h">Start</div>
        <div class="pp-promos__h">End</div>
      </div>
      <div class="pp-promos__table-body">
        ${rows.map(r => `
          <div class="pp-promos__row" data-id="${escapeHtml(r.id)}">
            <div class="pp-promos__cell name" title="${escapeHtml(r.name)}">${escapeHtml(r.name)}</div>
            <div class="pp-promos__cell type">${escapeHtml(r.type)}</div>
            <div class="pp-promos__cell">${escapeHtml(r.startPretty)}</div>
            <div class="pp-promos__cell">${escapeHtml(r.endPretty)}</div>
          </div>
        `).join('')}
      </div>
    `;
    }

    // лёгкий календарь: “день” с 24 часами (как твой текущий TL), rows по Type
    function renderCalendar(items, mount) {
        if (!mount) return;

        if (!items || !items.length) {
            mount.innerHTML = `<div class="pp-meta">No promotions found</div>`;
            return;
        }

        // группируем по type
        const byType = new Map();
        for (const it of items) {
            const t = (it.type || '—').trim() || '—';
            if (!byType.has(t)) byType.set(t, []);
            byType.get(t).push(it);
        }
        const types = [...byType.keys()].sort((a, b) => a.localeCompare(b));

        // якорный день: берём min start, и показываем день start (UTC)
        const minStart = Math.min(...items.map(x => x.startTS));
        const anchorDay = new Date(minStart);
        const dayStart = Date.parse(`${anchorDay.getUTCFullYear()}-${String(anchorDay.getUTCMonth() + 1).padStart(2, '0')}-${String(anchorDay.getUTCDate()).padStart(2, '0')}T00:00:00Z`);
        const dayEnd = dayStart + 24 * 3600_000;

        // layout
        mount.innerHTML = `
      <div class="pp-promos-cal">
        <div class="pp-promos-cal__top">
          <div class="pp-promos-cal__title">
            UTC day: <b>${escapeHtml(fmtUtc(dayStart).slice(0, 10))}</b>
            <span class="muted small"> (auto-picked from data)</span>
          </div>
        </div>

        <div class="pp-promos-cal__grid">
          <div class="pp-promos-cal__left">
            <div class="pp-promos-cal__left-head">Types</div>
            <div class="pp-promos-cal__left-body">
              ${types.map(t => `<div class="pp-promos-cal__left-row" title="${escapeHtml(t)}">${escapeHtml(t)}</div>`).join('')}
            </div>
          </div>

          <div class="pp-promos-cal__right">
            <div class="pp-promos-cal__hours">
              ${Array.from({ length: 24 }).map((_, h) => `<div class="pp-promos-cal__hour">${String(h).padStart(2, '0')}:00</div>`).join('')}
            </div>

            <div class="pp-promos-cal__rows">
              ${types.map((t, idx) => {
            const list = (byType.get(t) || []).slice()
                .map(ev => {
                    const a = Math.max(ev.startTS, dayStart);
                    const b = Math.min(ev.endTS, dayEnd);
                    if (b <= a) return null;
                    return { a, b, ev };
                })
                .filter(Boolean)
                .sort((x, y) => x.a - y.a);

            return `
                  <div class="pp-promos-cal__row" data-type="${escapeHtml(t)}" data-row="${idx}">
                    ${list.map(({ a, b, ev }) => {
                const leftPct = ((a - dayStart) / (24 * 3600_000)) * 100;
                const widthPct = ((b - a) / (24 * 3600_000)) * 100;
                return `
                        <div class="pp-promos-cal__bar"
                             style="left:${leftPct}%; width:${Math.max(widthPct, 0.5)}%;"
                             data-name="${escapeHtml(ev.name)}"
                             data-start="${escapeHtml(ev.startPretty)}"
                             data-end="${escapeHtml(ev.endPretty)}"
                             title="">
                          <span class="txt">${escapeHtml(ev.name)}</span>
                        </div>
                      `;
            }).join('')}
                  </div>
                `;
        }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

        // кастомный tooltip (минимальный) — чтобы не зависеть от title
        const root = mount.querySelector('.pp-promos-cal');
        const tip = document.createElement('div');
        tip.className = 'pp-promos-tip';
        tip.hidden = true;
        document.body.appendChild(tip);

        function hideTip() { tip.hidden = true; }
        function showTip(e, bar) {
            const name = bar.dataset.name || '';
            const start = bar.dataset.start || '';
            const end = bar.dataset.end || '';
            tip.innerHTML = `
        <div class="pp-promos-tip__t">${escapeHtml(name)}</div>
        <div class="pp-promos-tip__r"><span class="k">Start</span><span class="v">${escapeHtml(start)}</span></div>
        <div class="pp-promos-tip__r"><span class="k">End</span><span class="v">${escapeHtml(end)}</span></div>
      `;
            tip.hidden = false;

            const r = tip.getBoundingClientRect();
            const vw = window.innerWidth, vh = window.innerHeight;
            const GAP = 10;

            let left = e.clientX + GAP;
            let top = e.clientY + GAP;

            if (left + r.width > vw - 8) left = Math.max(8, vw - r.width - 8);
            if (top + r.height > vh - 8) top = Math.max(8, vh - r.height - 8);

            tip.style.left = left + 'px';
            tip.style.top = top + 'px';
        }

        root.addEventListener('mousemove', (e) => {
            const bar = e.target.closest('.pp-promos-cal__bar');
            if (!bar) return hideTip();
            showTip(e, bar);
        }, { passive: true });

        root.addEventListener('mouseleave', hideTip, { passive: true });
        window.addEventListener('scroll', hideTip, { passive: true });
    }

    // ---------- public api ----------
    window.PP_Promotions = {
        extract: extractPromotions,
        appendPromotionsUI
    };
})();
