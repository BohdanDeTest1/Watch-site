// === Tool registration (Profile Parser) ===
(function () {
    let inited = false;
    const KEY = 'pp-unlocked'; // sessionStorage key

    async function ensureMarkup(container) {
        let tpl = document.getElementById('pp-root');
        if (!tpl) {
            const tryPaths = ['ProfileParser.html', 'ProfileParser/ProfileParser.html'];
            for (const p of tryPaths) {
                try {
                    const res = await fetch(p, { cache: 'no-store' });
                    if (!res.ok) continue;
                    const html = await res.text();
                    const ghost = document.createElement('div');
                    ghost.innerHTML = html;
                    tpl = ghost.querySelector('#pp-root');
                    if (tpl) break;
                } catch (_) { }
            }
        }
        const mountPoint = container || document.getElementById('tool-root') || document.body;
        if (tpl && !mountPoint.querySelector('#pp-root')) {
            mountPoint.appendChild(tpl.cloneNode(true));
        }
    }

    function isUnlocked() {
        return sessionStorage.getItem(KEY) === '1';
    }
    function lock() {
        sessionStorage.removeItem(KEY);
    }
    function unlock() {
        sessionStorage.setItem(KEY, '1');
    }

    function showGate() {
        const gate = document.getElementById('ppGate');
        const bd = document.getElementById('ppGateBackdrop');
        const tab = document.getElementById('tab2View');
        if (!gate || !bd || !tab) return;

        tab.classList.add('pp-locked');     // <-- включаем размытие
        gate.classList.remove('hidden');
        bd.hidden = false;
        setTimeout(() => document.getElementById('ppPass')?.focus(), 0);
    }

    function hideGate() {
        const gate = document.getElementById('ppGate');
        const bd = document.getElementById('ppGateBackdrop');
        const tab = document.getElementById('tab2View');
        if (!gate || !bd || !tab) return;

        tab.classList.remove('pp-locked');  // <-- снимаем размытие
        gate.classList.add('hidden');
        bd.hidden = true;
    }

    function wireGate() {
        const form = document.getElementById('ppGateForm');
        const pass = document.getElementById('ppPass');
        const err = document.getElementById('ppErr');
        const cancel = document.getElementById('ppCancelBtn');

        cancel?.addEventListener('click', (e) => {
            e.preventDefault();
            // просто вернёмся на первую вкладку
            if (typeof window.switchTab === 'function') window.switchTab('tab1');
            hideGate();
        });

        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            const val = (pass?.value || '').trim();
            if (val === '!!!!') {
                unlock(); hideGate();
            } else {
                err && (err.style.display = '');
                pass?.select();
            }
        });
    }

    // === URLs (реальные) и МОКИ (локальные файлы)
    const URL_TPL = {
        state: 'https://static.ttstage-ext.net/data/travel_town/testing-2_12_master_[Variable]-all.json',
        liveops: 'https://profile-provider-v2-service.ttstage-int.net/stage/internal-api/v2/config/profiles/2_12_master_[Variable]/liveops',
        promos: 'https://profile-provider-v2-service.ttstage-int.net/stage/internal-api/v2/config/profiles/2_12_master_[Variable]/promotionsScheduleNew',
    };
    // Моки лежат в папке ProfileParser/
    const MOCKS = {
        state: 'ProfileParser/Stage_profile_State.json',
        liveops: 'ProfileParser/Stage_liveops.json',
        promos: 'ProfileParser/Stage_Promotions.json',
    };
    const USE_MOCKS = true; // оставляем включённым

    function buildUrl(kind, name) {
        if (USE_MOCKS) return MOCKS[kind];
        return URL_TPL[kind].replace('[Variable]', encodeURIComponent(name));
    }

    // утилита: читаем как ТЕКСТ, валидируем JSON.parse
    async function fetchJsonText(url) {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        try { JSON.parse(text); } catch (e) { throw new Error('Invalid JSON'); }
        return text;
    }
    function first10(str) {
        const t = (str || '').replace(/^\s+/, '');
        return t.slice(0, 10);
    }
    // формат: 12 Mar 2025, 17:19 UTC
    function formatUtcIso(isoStr) {
        try {
            const d = new Date(isoStr);
            const s = d.toLocaleString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                timeZone: 'UTC', hour12: false
            }).replace(',', '');
            return `${s} UTC`;
        } catch { return isoStr || ''; }
    }

    // вывод карточки с парой ключ-значение
    function appendKVResult(title, kvPairs, metaText) {
        const wrap = document.createElement('div');
        wrap.className = 'pp-item';
        const rows = kvPairs.map(([k, v]) =>
            `<div class="pp-kv"><span class="pp-k">${k}</span><span class="pp-v">${v}</span></div>`
        ).join('');

        const meta = metaText ? `<div class="pp-meta">${metaText}</div>` : '';

        wrap.innerHTML = `
    <div class="pp-title">${title}</div>
    <div class="pp-kvs">${rows}</div>
    ${meta}
  `;
        wireCollapser(wrap);
        el('#ppResults')?.appendChild(wrap);
    }



    // Делает секцию сворачиваемой (по умолчанию — свернута)
    function wireCollapser(wrap) {
        const btn = wrap.querySelector('.pp-collapser');
        const body = wrap.querySelector('.pp-body');
        const chev = btn?.querySelector('.chev');

        function setCollapsed(flag) {
            wrap.classList.toggle('collapsed', flag);
            if (body) body.hidden = flag;
            if (chev) chev.textContent = flag ? '▾' : '▴';
        }
        setCollapsed(true); // дефолт: закрыто

        btn?.addEventListener('click', () => setCollapsed(!wrap.classList.contains('collapsed')));
        btn?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
        });
    }


    // --- LiveOps helpers ---
    // seconds/ms → "YYYY-MM-DD HH:mm:ss UTC"
    function formatUnix(unixLike) {
        if (unixLike == null || unixLike === '') return '—';
        const n = Number(unixLike);
        const ms = n < 1e12 ? n * 1000 : n; // если пришли секунды, домножим
        const d = new Date(ms);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const mi = String(d.getUTCMinutes()).padStart(2, '0');
        const ss = String(d.getUTCSeconds()).padStart(2, '0');
        return `${y}-${m}-${dd} ${hh}:${mi}:${ss} UTC`;
    }
    // вырезаем суффикс " UTC"
    function stripUTC(s) {
        return (s || '').replace(/\s*UTC$/, '');
    }

    // "YYYY-MM-DD HH:mm:ss UTC" -> ms (UTC)
    function toMsFromCell(s) {
        const iso = stripUTC(s).replace(' ', 'T') + 'Z';
        const ms = Date.parse(iso);
        return Number.isFinite(ms) ? ms : null;
    }
    function dayStartMs(isoDate /* YYYY-MM-DD */) { return Date.parse(isoDate + 'T00:00:00Z'); }
    function dayEndMs(isoDate) { return Date.parse(isoDate + 'T23:59:59Z'); }

    function passDateRule(cellStr, f) {
        if (!f || !f.rule) return true;
        const t = toMsFromCell(cellStr);
        if (t == null) return true;

        if (f.rule === 'between') {
            const a = f.from ? dayStartMs(f.from) : null;
            const b = f.to ? dayEndMs(f.to) : null;
            return (a == null || t >= a) && (b == null || t <= b);
        }
        if (f.rule === 'before') {
            const b = f.from ? dayEndMs(f.from) : null;
            return (b == null) || (t <= b);
        }
        if (f.rule === 'after') {
            const a = f.from ? dayStartMs(f.from) : null;
            return (a == null) || (t >= a);
        }
        return true;
    }


    // приводим коллекцию liveops к массиву объектов
    function extractLiveOps(json) {
        // поддержим разные формы: data.liveOp / data.liveops / liveOp / liveops / data.items …
        const candidates = [
            json?.data?.liveOp, json?.data?.liveops, json?.liveOp, json?.liveops,
            json?.data?.items, json?.items
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

        return arr.map((it, idx) => {
            const id = it.id ?? it.ID ?? idx;
            const name = it.name ?? it.title ?? `LiveOp ${idx + 1}`;
            const type = it.type ?? it.category ?? '—';

            // старт/финал (подстраховываемся по полям)
            const start = it.startDate ?? it.start ?? it.start_time ?? it.start_at ?? it.begin_at;
            const end = it.endDate ?? it.end ?? it.end_time ?? it.end_at ?? it.finish_at;

            // condition.serialized { type: 'min_level', value: N } (или в массиве conditions)
            const ser = it.condition?.serialized
                ?? (Array.isArray(it.conditions) ? it.conditions[0]?.serialized : undefined)
                ?? it.conditions?.serialized;

            const minLevel = (ser && /min.?level/i.test(String(ser.type))) ? (ser.value ?? '—') : (ser?.value ?? '—');

            // соберём ВСЕ conditions → строки вида "level >= 17", "level <= 22", "appVersion >= 2.22.222"
            const condLines = [];
            if (Array.isArray(it.conditions)) {
                for (const c of it.conditions) {
                    const field = (c.fieldName || c.serialized?.type || '').replace(/min.?level/i, 'level') || 'condition';
                    const op = c.operator || (/level/i.test(field) ? '>=' : '>=');
                    const val = (c.value ?? c.serialized?.value ?? '—');
                    condLines.push(`${field} ${op} ${val}`);
                }
            } else if (it.condition?.serialized) {
                const s = it.condition.serialized;
                const field = String(s.type || '').replace(/min.?level/i, 'level') || 'condition';
                const val = (s.value ?? '—');
                const op = /level/i.test(field) ? '>=' : '>='; // оператора нет — подставим разумный дефолт
                condLines.push(`${field} ${op} ${val}`);
            }

            // --- ТЕМА ---
            let themeId = null;
            let themeAssets = null;

            if (it.theme) {
                if (typeof it.theme === 'string') {
                    themeId = it.theme;
                } else {
                    themeId = it.theme.id ?? null;
                    const ca = it.theme.clientAssets;
                    if (ca) {
                        if (Array.isArray(ca)) {
                            const first = ca.find(x => x.android || x.ios) || ca[0];
                            if (first) themeAssets = { android: first.android, ios: first.ios, name: first.name };
                        } else if (typeof ca === 'object') {
                            themeAssets = { android: ca.android, ios: ca.ios, name: ca.name };
                        }
                    }
                }
            }

            // --- статус ---
            // freeze имеет приоритет над eventState
            const freezeEvent = Boolean(it.freezeEvent);
            const rawState = String(it.eventState || 'off').toLowerCase(); // on/off/pause/freeze
            const displayState = freezeEvent ? 'freeze' : (['on', 'off', 'pause', 'freeze'].includes(rawState) ? rawState : 'off');

            // --- prerequisites ---
            let prereq = [];
            const pr = it.liveopsPrerequisites ?? it.liveOpsPrerequisites ?? it.prerequisites;
            if (Array.isArray(pr)) {
                prereq = pr.map(x => ({
                    eventType: x.eventType ?? x.type ?? '',
                    category: x.category ?? '',
                    comboIndex: (typeof x.comboIndex === 'number' ? x.comboIndex : (x.comboIndex ?? ''))
                }));
            }

            return {
                id, name, type,
                startPretty: formatUnix(start),
                endPretty: formatUnix(end),
                startTS: Number(start) < 1e12 ? Number(start) * 1000 : Number(start),
                endTS: Number(end) < 1e12 ? Number(end) * 1000 : Number(end),
                conditions: condLines,
                themeId, themeAssets,
                displayState, freezeEvent,
                prereq
            };

        });


    }

    // Таблица LiveOps + слева панель деталей
    function appendLiveOpsTable(items) {
        const wrap = document.createElement('div');
        wrap.className = 'pp-item collapsible collapsed';
        wrap.innerHTML = `
  <div class="pp-title">
    <button class="pp-collapser" type="button">
      LiveOps <span class="chev">▾</span>
    </button>
  </div>

  <div class="pp-body">
    <div class="pp-liveops">

<div class="pp-table" id="ppLoTable">
  <div class="pp-t-head">

    <!-- State + кнопка фильтра -->
    <div class="pp-state-filter">
      <span class="pp-sort" data-key="displayState">State</span>
      <button id="ppStateBtn" class="pp-icon-btn" type="button" aria-label="Filter State" title="Filter State"></button>

      <div class="pp-filter-pop pp-state-pop" id="ppStatePop" hidden>
        <div id="ppStateList" class="pp-state-list">
          <label class="pp-check"><input type="checkbox" value="on"><span>On</span></label>
          <label class="pp-check"><input type="checkbox" value="freeze"><span>Freeze</span></label>
          <label class="pp-check"><input type="checkbox" value="pause"><span>Pause</span></label>
        </div>
        <div class="pp-filter-actions">
          <button id="ppStateReset" class="pp-link-btn" type="button">RESET</button>
          <button id="ppStateApply" class="pp-btn primary" type="button" disabled>CONFIRM</button>
        </div>
      </div>
    </div>

    <!-- Name + кнопка фильтра -->
    <div>
      <span class="pp-name-filter">
        <span class="pp-sort" data-key="name">Name</span>
        <button id="ppNameBtn" class="pp-icon-btn" type="button" aria-label="Filter Name" title="Filter Name"></button>
      </span>

      <div class="pp-filter-pop pp-name-pop" id="ppNamePop" hidden>
        <div class="pp-filter-row">
          <button id="ppNameRuleBtn" class="pp-select" type="button" data-val="contains">
            <span class="txt">Contains</span><span class="chev">▾</span>
          </button>
          <input id="ppNameQuery" type="text" class="pp-input" placeholder="Search" />
        </div>

        <div id="ppNameRuleMenu" class="pp-select-menu" hidden>
          <button data-val="contains">Contains</button>
          <button data-val="notcontains">Not contains</button>
          <button data-val="starts">Starts with</button>
          <button data-val="equals">Equals to</button>
          <button data-val="blank">Blank</button>
        </div>

        <div class="pp-filter-actions">
          <button id="ppNameReset" class="pp-link-btn" type="button">RESET</button>
          <button id="ppNameApply" class="pp-btn primary" type="button" disabled>CONFIRM</button>
        </div>
      </div>
    </div>

    <!-- Type -->
    <div class="pp-type-filter">
      <span class="pp-sort" data-key="type">Type</span>
      <button id="ppTypeBtn" class="pp-icon-btn" type="button" aria-label="Filter Type" title="Filter Type"></button>

      <div class="pp-filter-pop pp-type-pop" id="ppTypePop" hidden>
        <input class="pp-inp" id="ppTypeSearch" type="text" placeholder="Filter list…">
        <div id="ppTypeList" class="pp-type-list"></div>

        <div class="pp-filter-actions">
          <button id="ppTypeReset" class="pp-link-btn" type="button">RESET</button>
          <button id="ppTypeApply" class="pp-btn primary" type="button" disabled>CONFIRM</button>
        </div>
      </div>
    </div>

    <!-- Start date -->
    <div class="pp-date-filter">
      <div class="pp-sort" data-key="startPretty">Start Date</div>
      <button id="ppStartBtn" class="pp-icon-btn" aria-label="Filter Start Date" title="Filter"></button>

      <div id="ppStartPop" class="pp-filter-pop pp-date-pop" hidden role="dialog" aria-label="Start date filter">
        <div class="pp-filter-row" style="display:grid;grid-template-columns:160px 1fr 1fr;gap:12px">
          <button id="ppStartRuleBtn" class="pp-select" data-val="between">
            <span class="txt">Between</span><span class="chev">▾</span>
          </button>
          <input id="ppStartFrom" class="pp-inp" type="date" placeholder="Start Date">
          <input id="ppStartTo"   class="pp-inp" type="date" placeholder="End Date">
          <div id="ppStartRuleMenu" class="pp-select-menu" hidden>
            <button data-val="between" type="button">Between</button>
            <button data-val="before"  type="button">Before</button>
            <button data-val="after"   type="button">After</button>
          </div>
        </div>
        <div class="pp-filter-actions">
          <button id="ppStartReset" class="pp-link-btn" type="button">RESET</button>
          <button id="ppStartApply" class="pp-btn primary" type="button">CONFIRM</button>
        </div>
      </div>
    </div>

    <!-- End date -->
    <div class="pp-date-filter">
      <div class="pp-sort" data-key="endPretty">End Date</div>
      <button id="ppEndBtn" class="pp-icon-btn" aria-label="Filter End Date" title="Filter"></button>

      <div id="ppEndPop" class="pp-filter-pop pp-date-pop" hidden role="dialog" aria-label="End date filter">
        <div class="pp-filter-row" style="display:grid;grid-template-columns:160px 1fr 1fr;gap:12px">
          <button id="ppEndRuleBtn" class="pp-select" data-val="between">
            <span class="txt">Between</span><span class="chev">▾</span>
          </button>
          <input id="ppEndFrom" class="pp-inp" type="date" placeholder="Start Date">
          <input id="ppEndTo"   class="pp-inp" type="date" placeholder="End Date">
          <div id="ppEndRuleMenu" class="pp-select-menu" hidden>
            <button data-val="between" type="button">Between</button>
            <button data-val="before"  type="button">Before</button>
            <button data-val="after"   type="button">After</button>
          </div>
        </div>
        <div class="pp-filter-actions">
          <button id="ppEndReset" class="pp-link-btn" type="button">RESET</button>
          <button id="ppEndApply" class="pp-btn primary" type="button">CONFIRM</button>
        </div>
      </div>
    </div>

  </div>

  <div class="pp-t-body" id="ppTBody"></div>
</div>

<!-- панель деталей и плавающие кнопки -->
<div class="pp-liveops-detail" id="ppLoDetail">
  <div class="muted small">Select an event to view details</div>
</div>
<button id="ppLoClose" class="pp-close-float" aria-label="Close">×</button>
<button id="ppAdminBtn" class="pp-admin-float pp-btn" type="button">Events in the Admin</button>

    </div> <!-- /.pp-liveops -->

    <div class="pp-pager" id="ppPager">
      <span class="pp-label">Rows per page</span>
      <span class="pp-sel-wrap">
        <select class="pp-sel" id="ppRows">
          <option selected>10</option><option>25</option><option>50</option>
          <option>75</option><option>100</option>
        </select>
      </span>
      <span id="ppRange">0–0 of 0</span>
      <span class="pp-nav">
        <button class="pp-icon" id="ppFirst" title="First"><span>|‹</span></button>
        <button class="pp-icon" id="ppPrev"  title="Previous"><span>‹</span></button>
        <button class="pp-icon" id="ppNext"  title="Next"><span>›</span></button>
        <button class="pp-icon" id="ppLast"  title="Last"><span>›|</span></button>
      </span>
    </div>
  </div> <!-- /.pp-body -->
`;

        wireCollapser(wrap);


        const closeBtn = wrap.querySelector('#ppLoClose');
        const tableBox = wrap.querySelector('#ppLoTable');
        closeBtn.addEventListener('click', () => wrap.classList.remove('info-open'));

        const adminBtn = wrap.querySelector('#ppAdminBtn');
        adminBtn?.addEventListener('click', () => {
            window.open('https://www.google.com', '_blank', 'noopener');
        });

        el('#ppResults')?.appendChild(wrap);

        const detEl = wrap.querySelector('#ppLoDetail');
        const bodyEl = wrap.querySelector('#ppTBody');
        const headEl = wrap.querySelector('.pp-t-head');

        function alignDetailTop() {
            // панель начинается строго от верха таблицы
            detEl.style.top = '0px';
            // крестик — чуть ниже верхнего края (не зависит от скролла панели)
            const floater = wrap.querySelector('#ppLoClose');
            if (floater) floater.style.top = '8px';
        }
        alignDetailTop();
        new ResizeObserver(alignDetailTop).observe(headEl);
        // Ставит выпадающее меню ровно под кнопкой внутри текущего попапа
        function openMenuBelow(buttonEl, menuEl) {
            if (!buttonEl || !menuEl) return;
            const pop = buttonEl.closest('#ppNamePop, #ppTypePop, #ppStartPop, #ppEndPop');
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



        // ---------- состояние сортировки/фильтра ----------
        let sortKey = 'name';
        let sortDir = 'asc';
        let typeFilter = new Set(); // пустой = показываем всё
        const stateFilter = new Set();
        const allTypes = Array.from(new Set(items.map(i => i.type).filter(Boolean))).sort();
        let typeTextFilter = { rule: 'contains', query: '' }; // текстовое правило для Type
        let startFilter = { rule: 'between', from: '', to: '' };
        let endFilter = { rule: 'between', from: '', to: '' };
        let viewRows = [];
        let allFilteredSorted = [];        // полный набор после фильтра/сортировки
        let pageSize = 10;
        let page = 1;
        let nameFilter = { rule: 'contains', query: '' }; // <— новое состояние



        const FIXED_ROWS = 10;
        let openRowH = null;

        function setBodyHeightByRow() {
            const st = getComputedStyle(bodyEl);
            const padV = (parseFloat(st.paddingTop) || 0) + (parseFloat(st.paddingBottom) || 0);
            const rh = Number(getComputedStyle(wrap).getPropertyValue('--pp-row-h').replace('px', '')) || openRowH || 52;
            bodyEl.style.height = (rh * FIXED_ROWS + padV) + 'px';
        }

        // высоту строки берём при первом открытии панели и распространяем на обе моды
        function syncRowHeightToOpen() {
            const probe = bodyEl.querySelector('.pp-t-row');
            if (!probe) return;
            openRowH = probe.getBoundingClientRect().height;
            wrap.style.setProperty('--pp-row-h', openRowH + 'px');
            setBodyHeightByRow();
        }

        function enforceFixedHeight() { /* no-op */ }

        const rowsSel = wrap.querySelector('#ppRows');
        const rangeEl = wrap.querySelector('#ppRange');
        const btnFirst = wrap.querySelector('#ppFirst');
        const btnPrev = wrap.querySelector('#ppPrev');
        const btnNext = wrap.querySelector('#ppNext');
        const btnLast = wrap.querySelector('#ppLast');

        rowsSel.addEventListener('change', () => {
            pageSize = Number(rowsSel.value);
            page = 1;
            renderRows();
        });
        btnFirst.addEventListener('click', () => { page = 1; renderRows(); });
        btnPrev.addEventListener('click', () => { page = Math.max(1, page - 1); renderRows(); });
        btnNext.addEventListener('click', () => { page = Math.min(Math.ceil(allFilteredSorted.length / pageSize) || 1, page + 1); renderRows(); });
        btnLast.addEventListener('click', () => { page = Math.max(1, Math.ceil(allFilteredSorted.length / pageSize) || 1); renderRows(); });

        // ---------- рендер шапки сортировки ----------
        function updateSortIndicators() {
            headEl.querySelectorAll('.pp-sort').forEach(s => {
                s.classList.remove('asc', 'desc');
                if (s.dataset.key === sortKey) s.classList.add(sortDir);
            });
        }

        function cmp(a, b, k) {
            const va = (a[k] ?? '').toString().toLowerCase();
            const vb = (b[k] ?? '').toString().toLowerCase();
            if (va < vb) return -1;
            if (va > vb) return 1;
            return 0;
        }


        // ---------- рендер строк ----------
        function renderRows() {
            let rows = items.slice();

            // фильтр по Name
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

            if (stateFilter.size) {
                rows = rows.filter(r => stateFilter.has(r.displayState));
            }

            // фильтр по типам
            if (typeFilter.size) {
                rows = rows.filter(r => typeFilter.has(r.type));
            }

            // текстовое правило Type
            if (typeTextFilter) {
                const tq = (typeTextFilter.query || '').toLowerCase();
                rows = rows.filter(r => {
                    const s = (r.type || '').toLowerCase();
                    switch (typeTextFilter.rule) {
                        case 'contains': return s.includes(tq);
                        case 'notcontains': return tq ? !s.includes(tq) : true;
                        case 'starts': return s.startsWith(tq);
                        case 'equals': return s === tq;
                        case 'blank': return !s.trim();
                        default: return true;
                    }
                });
            }


            // --- Start / End date filters ---
            rows = rows.filter(r =>
                passDateRule(r.startPretty, startFilter) &&
                passDateRule(r.endPretty, endFilter)
            );


            // сортировка
            rows.sort((a, b) => (sortDir === 'asc' ? 1 : -1) * cmp(a, b, sortKey));

            // сохраняем «весь набор» для пагинации
            allFilteredSorted = rows;

            // пагинация
            const total = rows.length;
            const pages = Math.max(1, Math.ceil(total / pageSize));
            if (page > pages) page = pages;

            const startIdx = (page - 1) * pageSize;
            const endIdx = Math.min(startIdx + pageSize, total);
            const slice = rows.slice(startIdx, endIdx);

            // для Info используем именно то, что на странице
            viewRows = slice;

            // метка «x–y of N»
            rangeEl.textContent = `${total ? (startIdx + 1) : 0}–${endIdx} of ${total}`;
            btnFirst.disabled = btnPrev.disabled = (page <= 1);
            btnLast.disabled = btnNext.disabled = (page >= pages);

            // рендер строк
            bodyEl.innerHTML = slice.map((lo, i) => {
                const label = lo.displayState.charAt(0).toUpperCase() + lo.displayState.slice(1);
                return `
      <div class="pp-t-row" data-idx="${i}">
        <div class="cell">
          <span class="pp-state ${lo.displayState}">
            <span class="dot"></span><span class="lbl">${label}</span>
          </span>
        </div>
        <div class="cell">${lo.name}</div>
        <div class="cell">${lo.type || '—'}</div>
        <div class="cell">${stripUTC(lo.startPretty)} (UTC)</div>
        <div class="cell">${stripUTC(lo.endPretty)} (UTC)</div>
        <div class="cell"><button class="pp-btn pp-info" data-idx="${i}" type="button">Info</button></div>
      </div>
    `;
            }).join('');
            setBodyHeightByRow();
            enforceFixedHeight();
        }



        // ---------- детальная панель ----------
        function showDetail(idx) {
            const lo = viewRows[idx];
            if (!lo) return;

            const condHtml = (lo.conditions && lo.conditions.length)
                ? `<div class="pp-conds">${lo.conditions.map(s => `<div>${s}</div>`).join('')}</div>`
                : '<div class="muted">—</div>';

            const hasAssets = !!lo.themeAssets && (lo.themeAssets.android || lo.themeAssets.ios);
            const assetsInside = hasAssets ? `
  <button class="pp-link assets" id="ppAssetsTgl">
    assets <span class="chev" id="ppAssetsChev">▾</span>
  </button>
  <div class="pp-assets" id="ppAssetsBox" hidden>
    ${lo.themeAssets.android ? `<div class="row"><strong>And:</strong> <code>${lo.themeAssets.android}</code></div>` : ''}
    ${lo.themeAssets.ios ? `<div class="row"><strong>iOS:</strong> <code>${lo.themeAssets.ios}</code></div>` : ''}
  </div>` : '';

            let themeHtml = (lo.themeId ? `<code>${lo.themeId}</code>` : '—');

            // готовим содержимое строки Assets (если есть что показывать)
            let assetsKV = '';
            if (lo.themeAssets && (lo.themeAssets.android || lo.themeAssets.ios)) {
                const assetsList = `
    <div class="pp-assets" id="ppAssetsBox">
      ${lo.themeAssets.android ? `<div class="row"><strong>And:</strong> <code>${lo.themeAssets.android}</code></div>` : ''}
      ${lo.themeAssets.ios ? `<div class="row"><strong>iOS:</strong> <code>${lo.themeAssets.ios}</code></div>` : ''}
    </div>
  `;
                assetsKV = `
    <div class="pp-kv">
      <span class="pp-k">Assets</span>
      <span class="pp-v">${assetsList}</span>
    </div>`;
            }



            const prereqHtml = (lo.prereq && lo.prereq.length)
                ? `<div class="pp-wrap">` + lo.prereq.map(p => {
                    const lines = [];
                    if (p.eventType) lines.push(`eventType: ${p.eventType}`);
                    if (p.category) lines.push(`category: ${p.category}`);
                    if (p.comboIndex !== '' && p.comboIndex !== undefined) lines.push(`comboIndex: ${p.comboIndex}`);
                    return `<div>${lines.join(`\n`)}</div>`;
                }).join('') + `</div>`
                : '<div class="muted">—</div>';


            detEl.innerHTML = `
  <div class="pp-kvs">
    <div class="pp-kv"><span class="pp-k">Name</span><span class="pp-v">${lo.name}</span></div>
    <div class="pp-kv"><span class="pp-k">Type</span><span class="pp-v">${lo.type || '—'}</span></div>
    <div class="pp-kv"><span class="pp-k">State</span>
      <span class="pp-v"><span class="pp-state ${lo.displayState}"><span class="dot"></span>
      <span class="lbl">${lo.displayState.charAt(0).toUpperCase() + lo.displayState.slice(1)}</span></span></span>
    </div>
    <div class="pp-kv"><span class="pp-k">Start date</span><span class="pp-v">${stripUTC(lo.startPretty)} (UTC)</span></div>
    <div class="pp-kv"><span class="pp-k">End date</span><span class="pp-v">${stripUTC(lo.endPretty)} (UTC)</span></div>
    <div class="pp-kv"><span class="pp-k">Conditions</span><span class="pp-v">${condHtml}</span></div>
    <div class="pp-kv"><span class="pp-k">Theme</span><span class="pp-v">${themeHtml}</span></div>
    ${assetsKV}
<div class="pp-kv"><span class="pp-k">LiveOps prerequisites</span><span class="pp-v">${prereqHtml}</span></div>
</div>
`;



            const tgl = detEl.querySelector('#ppAssetsTgl');
            if (tgl) {
                const box = detEl.querySelector('#ppAssetsBox');
                const chev = detEl.querySelector('#ppAssetsChev');
                tgl.addEventListener('click', () => {
                    const hidden = box.hasAttribute('hidden');
                    if (hidden) { box.removeAttribute('hidden'); chev.textContent = '▴'; }
                    else { box.setAttribute('hidden', ''); chev.textContent = '▾'; }
                });
            }

            //удалили крестик

            // обработчик для кнопки "Event in the Admin"
            detEl.querySelector('#ppAdminBtn')?.addEventListener('click', () => {
                window.open('https://www.google.com', '_blank', 'noopener');
            });


        }



        // ---------- события ----------
        // сортировка по клику на заголовки
        headEl.addEventListener('click', (e) => {
            const s = e.target.closest('.pp-sort');
            if (!s) return;
            const key = s.dataset.key;
            if (key === sortKey) sortDir = (sortDir === 'asc' ? 'desc' : 'asc');
            else { sortKey = key; sortDir = 'asc'; }
            updateSortIndicators();
            renderRows();
        });

        // Info
        bodyEl.addEventListener('click', (e) => {
            const btn = e.target.closest('.pp-info');
            if (!btn) return;
            const idx = Number(btn.dataset.idx);
            showDetail(idx);
            wrap.classList.add('info-open');
            syncRowHeightToOpen();

            // подсветка строки на текущей странице
            bodyEl.querySelectorAll('.pp-t-row.selected').forEach(r => r.classList.remove('selected'));
            const rowEl = btn.closest('.pp-t-row');
            if (rowEl) rowEl.classList.add('selected');
        });

        bodyEl.addEventListener('click', (e) => {
            if (e.target.closest('.pp-info')) return; // кнопка Info обрабатывается выше
            const row = e.target.closest('.pp-t-row');
            if (!row) return;
            bodyEl.querySelectorAll('.pp-t-row.selected').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');

            // если панель открыта — сразу перерисовываем детали для кликнутой строки
            if (wrap.classList.contains('info-open')) {
                const i = Number(row.dataset.idx);
                showDetail(i);
            }
        });

        // ---------- фильтр по состоянию (State) ----------
        const stateBtn = wrap.querySelector('#ppStateBtn');
        const statePop = wrap.querySelector('#ppStatePop');
        const stateListBox = wrap.querySelector('#ppStateList');
        const stateResetBtn = wrap.querySelector('#ppStateReset');
        const stateApplyBtn = wrap.querySelector('#ppStateApply');

        // локальный «черновик», чтобы не портить боевое состояние, пока попап открыт
        let stateDraft = new Set();

        // синхронизация кнопки Confirm (в нашем случае можно всегда разрешать)
        function syncStateConfirm() {
            if (stateApplyBtn) stateApplyBtn.disabled = false;
        }

        // открыть/закрыть попап State
        stateBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = statePop.hidden;

            // 1) Всегда закрываем меню правил Name/Type
            wrap.querySelector('#ppNameRuleMenu')?.setAttribute('hidden', '');
            wrap.querySelector('#ppTypeRuleMenu')?.setAttribute('hidden', '');

            // 2) Закрываем другие попапы
            wrap.querySelector('#ppNamePop')?.setAttribute('hidden', '');
            wrap.querySelector('#ppTypePop')?.setAttribute('hidden', '');

            wrap.querySelector('#ppStartPop')?.setAttribute('hidden', '');
            wrap.querySelector('#ppEndPop')?.setAttribute('hidden', '');


            // 3) Тоггл текущего
            statePop.hidden = !statePop.hidden;

            if (willOpen) {
                // инициализировать чекбоксы из боевого stateFilter
                stateDraft = new Set(stateFilter);
                stateListBox.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = stateDraft.has(cb.value);
                });
                syncStateConfirm();
                // фокус переводить не обязательно; если хочешь — на первый чекбокс:
                stateListBox.querySelector('input[type="checkbox"]')?.focus();
            }
        });

        // клики по чекбоксам
        stateListBox?.addEventListener('change', (e) => {
            const cb = e.target.closest('input[type="checkbox"]');
            if (!cb) return;
            if (cb.checked) stateDraft.add(cb.value);
            else stateDraft.delete(cb.value);
            syncStateConfirm();
        });

        // RESET: всё снять, применить и закрыть
        stateResetBtn?.addEventListener('click', () => {
            stateDraft.clear();
            stateFilter = new Set();           // боевое — пусто
            stateListBox.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            syncStateConfirm();
            statePop.hidden = true;
            renderRows();
        });

        // APPLY: применить черновик → боевое
        stateApplyBtn?.addEventListener('click', () => {
            stateFilter = new Set(stateDraft);
            statePop.hidden = true;
            renderRows();
        });

        // клик вне — закрыть попап State (но меню правил Name/Type мы уже закрываем выше при открытии)
        document.addEventListener('click', (e) => {
            if (!document.body.contains(statePop) || statePop.hidden) return;
            if (e.target.closest('#ppStatePop') || e.target.closest('#ppStateBtn')) return;
            statePop.hidden = true;
        });


        // ---------- фильтр по имени ----------
        const nameBtn = wrap.querySelector('#ppNameBtn');
        const namePop = wrap.querySelector('#ppNamePop');
        const ruleBtn = wrap.querySelector('#ppNameRuleBtn');
        const ruleMenu = wrap.querySelector('#ppNameRuleMenu');
        const queryInput = wrap.querySelector('#ppNameQuery');
        const resetBtn = wrap.querySelector('#ppNameReset');
        const applyBtn = wrap.querySelector('#ppNameApply');

        // function sync() {
        //     const rule = ruleBtn?.dataset.val || 'between';

        //     // 1) показать/спрятать ТОЛЬКО второй инпут
        //     if (toInp) toInp.style.display = (rule === 'between') ? '' : 'none';

        //     // 2) подогнать сетку под 2 поля (Between) или 1 поле (Before/After)
        //     const row = ruleBtn ? ruleBtn.closest('.pp-filter-row') : null;
        //     if (row) {
        //         row.style.gridTemplateColumns = (rule === 'between')
        //             ? '160px 1fr 1fr'   // правило + 2 поля
        //             : '160px 1fr';      // правило + 1 поле
        //     }

        //     // 3) динамическая ширина поп-апа
        //     // Between — шире, Before/After — уже
        //     if (pop) {
        //         pop.style.minWidth = (rule === 'between') ? '520px' : '360px';
        //     }

        //     // 4) доступность Apply
        //     if (applyBtn) {
        //         const hasA = !!(fromInp?.value);
        //         const hasB = !!(toInp?.value);
        //         applyBtn.disabled = (rule === 'between') ? (!hasA && !hasB) : !hasA;
        //     }
        // }

        // function sync() {
        //     const rule = ruleBtn?.dataset.val || 'between';
        //     // при Before/After второй инпут скрываем
        //     if (toInp) toInp.parentElement.style.display = (rule === 'between') ? '' : 'none';
        //     if (applyBtn) {
        //         const hasA = !!(fromInp?.value);
        //         const hasB = !!(toInp?.value);
        //         applyBtn.disabled = (rule === 'between') ? (!hasA && !hasB) : !hasA;
        //     }
        // }

        // ---------- фильтр по имени ----------

        function syncConfirmState() {
            const rule = ruleBtn?.dataset.val || 'contains';
            const needText = rule !== 'blank';
            if (queryInput) {
                queryInput.disabled = !needText;
                if (!needText) queryInput.value = '';
            }
            // Apply активна, если либо rule=blank, либо в поле есть текст
            if (applyBtn) {
                applyBtn.disabled = (rule === 'blank') ? false : !(queryInput.value.trim());
            }
        }

        nameBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = namePop.hidden;

            // 1) ВСЕГДА закрываем оба меню правил
            wrap.querySelector('#ppNameRuleMenu')?.setAttribute('hidden', '');
            wrap.querySelector('#ppTypeRuleMenu')?.setAttribute('hidden', '');

            // 2) закрываем Type-попап (если открыт)
            const tPop = wrap.querySelector('#ppTypePop');
            if (tPop) tPop.hidden = true;

            wrap.querySelector('#ppStatePop')?.setAttribute('hidden', '');
            wrap.querySelector('#ppStartPop')?.setAttribute('hidden', '');
            wrap.querySelector('#ppEndPop')?.setAttribute('hidden', '');


            // 3) открываем/закрываем Name-попап
            namePop.hidden = !namePop.hidden;
            if (willOpen) {
                syncConfirmState();
                queryInput?.focus();
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

        resetBtn?.addEventListener('click', () => {
            nameFilter = { rule: 'contains', query: '' };
            ruleBtn.dataset.val = 'contains';
            ruleBtn.querySelector('.txt').textContent = 'Contains';
            queryInput.value = '';
            namePop.hidden = true;
            renderRows();
        });

        applyBtn?.addEventListener('click', () => {
            nameFilter = { rule: ruleBtn.dataset.val, query: queryInput.value.trim() };
            namePop.hidden = true;
            renderRows();
        });

        // клик «вне» — закрыть попап/меню
        document.addEventListener('click', (e) => {
            if (!document.body.contains(namePop) || namePop.hidden) return;

            // если открыт список правил — закрываем ТОЛЬКО его и не трогаем поп-ап
            // if (!ruleMenu.hidden && !e.target.closest('#ppRuleMenu') && !e.target.closest('#ppRuleBtn')) {
            //     ruleMenu.hidden = true;
            //     return; // не закрывать namePop
            // }

            if (!ruleMenu.hidden &&
                !e.target.closest('#ppNameRuleMenu') &&
                !e.target.closest('#ppNameRuleBtn')) {
                ruleMenu.hidden = true;
                return;
            }

            // иначе стандартное закрытие поп-апа по клику вне
            if (e.target.closest('#ppNamePop') || e.target.closest('#ppNameBtn')) return;
            namePop.hidden = true;
            ruleMenu.hidden = true;
        });

        // ---------- фильтр по типу ----------

        // ---------- фильтр по Type ----------
        const typeBtn = wrap.querySelector('#ppTypeBtn');
        const typePop = wrap.querySelector('#ppTypePop');

        const typeSearch = wrap.querySelector('#ppTypeSearch');
        const typeListBox = wrap.querySelector('#ppTypeList');
        const typeRuleBtn = wrap.querySelector('#ppTypeRuleBtn');
        const typeRuleMenu = wrap.querySelector('#ppTypeRuleMenu');
        const typeQueryInput = wrap.querySelector('#ppTypeQuery');
        const typeResetBtn = wrap.querySelector('#ppTypeReset');
        const typeApplyBtn = wrap.querySelector('#ppTypeApply');

        let typeDraft = new Set();                          // черновик чекбоксов
        let typeTextDraft = { rule: 'contains', query: '' };// черновик текстового правила

        function buildTypeList(filterStr = '') {
            const q = (filterStr || '').toLowerCase();
            const arr = allTypes.filter(t => t.toLowerCase().includes(q));
            typeListBox.innerHTML = arr.map(t => {
                const checked = typeDraft.has(t) ? 'checked' : '';
                return `<label class="pp-type-opt"><input type="checkbox" value="${t}" ${checked}/> <span>${t}</span></label>`;
            }).join('') || '<div class="muted small">No types</div>';
        }

        function syncTypeConfirmState() {
            const rule = typeRuleBtn?.dataset.val || 'contains';
            const needText = rule !== 'blank';
            if (typeQueryInput) typeQueryInput.disabled = !needText;
            if (!needText && typeQueryInput) typeQueryInput.value = '';
            // подтверждать можно всегда — применение делаем одной кнопкой
            typeApplyBtn && (typeApplyBtn.disabled = false);
        }

        // открыть/закрыть и инициализировать черновики
        typeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = typePop.hidden;

            // 1) ВСЕГДА закрываем оба меню правил
            wrap.querySelector('#ppNameRuleMenu')?.setAttribute('hidden', '');
            wrap.querySelector('#ppTypeRuleMenu')?.setAttribute('hidden', '');

            // 2) закрываем Name-попап (если открыт)
            const nPop = wrap.querySelector('#ppNamePop');
            if (nPop) nPop.hidden = true;

            wrap.querySelector('#ppStatePop')?.setAttribute('hidden', '');
            wrap.querySelector('#ppStartPop')?.setAttribute('hidden', '');
            wrap.querySelector('#ppEndPop')?.setAttribute('hidden', '');


            // 3) открываем/закрываем Type-попап
            typePop.hidden = !typePop.hidden;
            if (willOpen) {
                // твоя инициализация Type остаётся без изменений
                typeDraft = new Set(typeFilter);
                typeTextDraft = { ...typeTextFilter };
                typeSearch && (typeSearch.value = '');
                typeQueryInput && (typeQueryInput.value = typeTextDraft.query || '');
                if (typeRuleBtn) {
                    typeRuleBtn.dataset.val = typeTextDraft.rule || 'contains';
                    typeRuleBtn.querySelector('.txt').textContent = ({
                        contains: 'Contains', notcontains: 'Not contains', starts: 'Starts with', equals: 'Equals to', blank: 'Blank'
                    })[typeRuleBtn.dataset.val] || 'Contains';
                }
                buildTypeList('');
                syncTypeConfirmState();
                typeSearch?.focus();
            }
        });

        typeListBox?.addEventListener('change', (e) => {
            const cb = e.target.closest('input[type="checkbox"]');
            if (!cb) return;
            if (cb.checked) typeDraft.add(cb.value);
            else typeDraft.delete(cb.value);
            syncTypeConfirmState();
        });

        // ---------- Фильтры дат (Start/End) ----------
        function wireDateFilter(opts) {
            const { btnSel, popSel, ruleBtnSel, ruleMenuSel, fromSel, toSel, resetSel, applySel, get, set } = opts;
            const btn = wrap.querySelector(btnSel);
            const pop = wrap.querySelector(popSel);
            const ruleBtn = wrap.querySelector(ruleBtnSel);
            const ruleMenu = wrap.querySelector(ruleMenuSel);
            const fromInp = wrap.querySelector(fromSel);
            const toInp = wrap.querySelector(toSel);
            const resetBtn = wrap.querySelector(resetSel);
            const applyBtn = wrap.querySelector(applySel);
            const labels = { between: 'Between', before: 'Before', after: 'After' };

            // function sync() {
            //     const rule = ruleBtn?.dataset.val || 'between';

            //     // скрываем ТОЛЬКО второй инпут (а не всю строку)
            //     if (toInp) toInp.style.display = (rule === 'between') ? '' : 'none';

            //     // (косметика) плейсхолдер 1-го поля
            //     if (fromInp) {
            //         if (rule === 'before') fromInp.placeholder = 'Until date';
            //         else if (rule === 'after') fromInp.placeholder = 'From date';
            //         else fromInp.placeholder = 'Start Date';
            //     }

            //     // доступность кнопки Apply
            //     if (applyBtn) {
            //         const hasA = !!(fromInp?.value);
            //         const hasB = !!(toInp?.value);
            //         applyBtn.disabled = (rule === 'between') ? (!hasA && !hasB) : !hasA;
            //     }
            // }

            function sync() {
                const rule = ruleBtn?.dataset.val || 'between';

                // 1) показать/спрятать второй инпут
                if (toInp) toInp.style.display = (rule === 'between') ? '' : 'none';

                // 2) сетка: 2 поля (Between) или 1 поле (Before/After)
                const row = ruleBtn ? ruleBtn.closest('.pp-filter-row') : null;
                if (row) {
                    row.style.gridTemplateColumns = (rule === 'between')
                        ? '160px 1fr 1fr'
                        : '160px 1fr';
                }

                // 3) ширина поп-апа: по умолчанию 520px; узкий — 360px (через класс)
                if (pop) {
                    if (rule === 'between') pop.classList.remove('single');
                    else pop.classList.add('single');
                }

                // 4) состояние кнопки Apply
                if (applyBtn) {
                    const hasA = !!(fromInp?.value);
                    const hasB = !!(toInp?.value);
                    applyBtn.disabled = (rule === 'between') ? (!hasA && !hasB) : !hasA;
                }
            }


            btn?.addEventListener('click', (e) => {
                e.stopPropagation();

                // 1) Закрыть ВСЕ прочие попапы и меню правил
                wrap.querySelectorAll('.pp-filter-pop').forEach(p => { if (p !== pop) p.setAttribute('hidden', ''); });
                wrap.querySelectorAll('.pp-select-menu').forEach(m => m.setAttribute('hidden', ''));

                // 2) Тоггл текущего
                const willOpen = pop.hidden;
                pop.hidden = !pop.hidden;

                if (willOpen) {
                    const cur = (typeof get === 'function') ? get() : { rule: 'between', from: '', to: '' };
                    if (ruleBtn) {
                        ruleBtn.dataset.val = cur.rule || 'between';
                        ruleBtn.querySelector('.txt').textContent = labels[ruleBtn.dataset.val] || 'Between';
                    }
                    if (fromInp) fromInp.value = cur.from || '';
                    if (toInp) toInp.value = cur.to || '';
                    sync();
                    fromInp?.focus();
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
                sync();
            });

            fromInp?.addEventListener('input', sync);
            toInp?.addEventListener('input', sync);

            resetBtn?.addEventListener('click', () => {
                set({ rule: 'between', from: '', to: '' });
                if (fromInp) fromInp.value = '';
                if (toInp) toInp.value = '';
                pop.hidden = true;
                renderRows();
            });

            applyBtn?.addEventListener('click', () => {
                set({ rule: ruleBtn.dataset.val, from: fromInp?.value || '', to: toInp?.value || '' });
                pop.hidden = true;
                renderRows();
            });

            // клик вне — закрыть попап (и меню правил)
            document.addEventListener('click', (e) => {
                if (!document.body.contains(pop) || pop.hidden) return;
                if (e.target.closest(popSel) || e.target.closest(btnSel)) return;
                pop.hidden = true;
                ruleMenu && (ruleMenu.hidden = true);
            });
        }

        // Подключаем оба дата-фильтра
        wireDateFilter({
            btnSel: '#ppStartBtn', popSel: '#ppStartPop',
            ruleBtnSel: '#ppStartRuleBtn', ruleMenuSel: '#ppStartRuleMenu',
            fromSel: '#ppStartFrom', toSel: '#ppStartTo',
            resetSel: '#ppStartReset', applySel: '#ppStartApply',
            get: () => startFilter, set: (v) => { startFilter = v; }
        });
        wireDateFilter({
            btnSel: '#ppEndBtn', popSel: '#ppEndPop',
            ruleBtnSel: '#ppEndRuleBtn', ruleMenuSel: '#ppEndRuleMenu',
            fromSel: '#ppEndFrom', toSel: '#ppEndTo',
            resetSel: '#ppEndReset', applySel: '#ppEndApply',
            get: () => endFilter, set: (v) => { endFilter = v; }
        });


        typeSearch?.addEventListener('input', () => buildTypeList(typeSearch.value));

        typeRuleBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeRuleMenu.hidden) openMenuBelow(typeRuleBtn, typeRuleMenu);
            else typeRuleMenu.hidden = true;
        });
        typeRuleMenu?.addEventListener('click', (e) => {
            const b = e.target.closest('button[data-val]');
            if (!b) return;
            typeRuleBtn.dataset.val = b.dataset.val;
            typeRuleBtn.querySelector('.txt').textContent = b.textContent;
            typeRuleMenu.hidden = true;
            syncTypeConfirmState();
        });
        typeQueryInput?.addEventListener('input', syncTypeConfirmState);

        // RESET: сбрасываем всё (чекбоксы, правило, текст), применяем и закрываем попап
        typeResetBtn?.addEventListener('click', () => {
            // 1) очистить «черновик»
            typeDraft = new Set();
            typeTextDraft = { rule: 'contains', query: '' };

            // 2) очистить «боевое» состояние фильтра и применить
            typeFilter = new Set();                          // чекбоксы → пусто
            typeTextFilter = { rule: 'contains', query: '' };// текстовое правило → дефолт

            // 3) обновить UI
            if (typeRuleBtn) {
                typeRuleBtn.dataset.val = 'contains';
                typeRuleBtn.querySelector('.txt').textContent = 'Contains';
            }
            if (typeQueryInput) typeQueryInput.value = '';
            if (typeSearch) typeSearch.value = '';
            buildTypeList('');           // перерисовать список чекбоксов (все сняты)
            syncTypeConfirmState();

            // 4) закрыть попап и перерисовать таблицу
            typePop.hidden = true;
            renderRows();
        });


        typeApplyBtn?.addEventListener('click', () => {
            typeFilter = new Set(typeDraft);
            typeTextFilter = { rule: typeRuleBtn.dataset.val, query: (typeQueryInput?.value || '').trim() };
            typePop.hidden = true;
            renderRows();
        });

        // клик вне попапа — закрываем
        // клик вне: если открыт список правил — закрываем ТОЛЬКО его; иначе закрываем попап
        document.addEventListener('click', (e) => {
            if (!document.body.contains(typePop) || typePop.hidden) return;

            // закрыть только меню правил, если кликнули вне него и вне кнопки его открытия
            if (!typeRuleMenu.hidden &&
                !e.target.closest('#ppTypeRuleMenu') &&
                !e.target.closest('#ppTypeRuleBtn')) {
                typeRuleMenu.hidden = true;
                return; // не закрываем сам попап фильтра
            }

            // обычное закрытие попапа по клику вне его области/кнопки
            if (e.target.closest('#ppTypePop') || e.target.closest('#ppTypeBtn')) return;
            typePop.hidden = true;
            typeRuleMenu.hidden = true;
        });



        // стартовый рендер
        updateSortIndicators();
        renderRows();
    }



    function el(q) { return document.querySelector(q); }
    function appendResult(title, text10, totalLen) {
        const item = document.createElement('div');
        item.className = 'pp-item';
        item.innerHTML = `
    <div class="pp-title">${title}</div>
    <div class="pp-meta">Файл содержит: <code>${text10}</code> • Длина: ${totalLen} символов</div>
  `;
        el('#ppResults')?.appendChild(item);
    }

    function appendPromotionsSection(text10, totalLen) {
        const wrap = document.createElement('div');
        wrap.className = 'pp-item collapsible collapsed';
        wrap.innerHTML = `
      <div class="pp-title">
        <button class="pp-collapser" type="button">
          Promotions <span class="chev">▾</span>
        </button>
      </div>
      <div class="pp-body">
        <div class="pp-meta">Файл содержит: <code>${text10}</code> • Длина: ${totalLen} символов</div>
      </div>
    `;
        wireCollapser(wrap);
        el('#ppResults')?.appendChild(wrap);
    }


    // основной сценарий — строго последовательно
    async function runProfileLookup(name) {
        const btn = el('#ppSearch');
        const results = el('#ppResults');
        const err = el('#ppFormErr');

        err.style.display = 'none';
        results.innerHTML = '';
        btn.disabled = true; btn.classList.add('pp-loading');

        try {
            // 1. Profile state (parse JSON и выводим поля; без метатекста)
            {
                const t = await fetchJsonText(buildUrl('state', name));
                const json = JSON.parse(t);
                const prof = json?.data?.profile || {};

                const profileName = prof.name ?? '—';
                const changePurpose = prof.change_purpose ?? '—';
                const updatedAtISO = prof.updated_at ?? '';
                const lastPublish = updatedAtISO ? formatUtcIso(updatedAtISO) : '—';

                appendKVResult(
                    'Profile state',
                    [
                        ['Profile name', String(profileName)],
                        ['Change purpose', String(changePurpose)],
                        ['Last publish date', lastPublish],
                    ]
                    // метатекст не передаём — строка ниже карточки не рендерится
                );
            }


            // 2. LiveOps — таблица + фильтр + панель деталей
            {
                const t = await fetchJsonText(buildUrl('liveops', name));
                const json = JSON.parse(t);
                const items = extractLiveOps(json);

                if (!items.length) {
                    appendKVResult('LiveOps', [['Status', 'No items found']]);
                } else {
                    appendLiveOpsTable(items);
                }
            }


            // 3. Promotions
            {
                const t = await fetchJsonText(buildUrl('promos', name));
                appendPromotionsSection(first10(t), t.length);
            }

        } catch (e) {
            const item = document.createElement('div');
            item.className = 'pp-item';
            item.innerHTML = `<div class="pp-title">Ошибка</div>
      <div class="pp-meta" style="color:var(--validation-warn)">Не удалось получить данные: ${e.message}</div>`;
            results.appendChild(item);
        } finally {
            btn.disabled = false; btn.classList.remove('pp-loading');
        }
    }

    // навесить обработчики формы
    function wireUI() {
        const form = el('#ppForm');
        const nameInput = el('#ppName');
        const err = el('#ppFormErr');

        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = (nameInput?.value || '').trim();
            if (!name) {
                err.style.display = '';
                return;
            }
            runProfileLookup(name);
        });
    }


    async function init(container) {
        if (inited) return;
        inited = true;
        sessionStorage.removeItem('pp-unlocked');

        await ensureMarkup(container);
        wireGate(); // навесим обработчики на форму
        wireUI();   // <— подключаем обработчик submit (preventDefault + запуск моков)
    }

    // вызывается при активации вкладки (см. правку switchTab в Main.js)
    function onActivate() {
        // Вставка готова? (если вдруг init ещё не успел)
        if (!document.getElementById('pp-root')) return;
        // Показать «замок», если не разблокировано
        if (!isUnlocked()) showGate();
    }

    // Экспорт для Main.js
    window.Tools = window.Tools || {};
    window.Tools.profileParser = { init, onActivate };
})();
