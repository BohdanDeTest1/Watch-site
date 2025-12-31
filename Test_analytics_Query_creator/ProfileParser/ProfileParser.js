// === Tool registration (Profile Parser) ===
(function () {
    let inited = false;
    const KEY = 'pp-unlocked'; // sessionStorage key

    async function ensureMarkup(container) {
        let tpl = document.getElementById('pp-root');
        if (!tpl) {
            const tryPaths = [
                'ProfileParser.html',
                './ProfileParser.html',
                'ProfileParser/ProfileParser.html',
                './ProfileParser/ProfileParser.html'
            ];
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

        if (!tpl) {
            // аварийная разметка, чтобы вкладка не была пустой
            const ghost = document.createElement('div');
            ghost.innerHTML = `
    <div id="pp-root">
      <div class="pp-wrap">
        <form id="ppForm" class="pp-form">
          <label class="pp-label" for="ppName">Profile name</label>
          <input id="ppName" class="pp-input" placeholder="Pool"/>
          <button id="ppSearch" class="pp-btn" type="submit">Search</button>
          <div id="ppFormErr" class="pp-err" style="display:none">Enter a profile name</div>
        </form>
        <div id="ppResults"></div>
      </div>
    </div>`;
            tpl = ghost.querySelector('#pp-root');
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
        liveops: 'ProfileParser/Stage_01_event.json',
        promos: 'ProfileParser/Stage_01_promo.json',
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
    // ---------- Safe dynamic script loader (Promotions only) ----------
    // Самый безопасный вариант: не трогаем LiveOps, а для Promotions подгружаем модуль при необходимости.
    const __ppScriptLoadCache = new Map();

    function __ppLoadScriptOnce(src) {
        if (__ppScriptLoadCache.has(src)) return __ppScriptLoadCache.get(src);

        const p = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onload = () => resolve(true);
            s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(s);
        });

        __ppScriptLoadCache.set(src, p);
        return p;
    }

    async function __ppEnsureGlobal(globalName, srcCandidates) {
        if (window[globalName]) return true;

        const list = Array.isArray(srcCandidates) ? srcCandidates : [srcCandidates];
        for (const src of list) {
            try {
                await __ppLoadScriptOnce(src);

                // даём браузеру “тик”, чтобы window.* успел проставиться
                await new Promise(r => setTimeout(r, 0));

                if (window[globalName]) return true;
            } catch (e) {
                // пробуем следующий candidate
            }
        }
        return Boolean(window[globalName]);
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

    window.wireCollapser = wireCollapser;

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
    // вырезаем суффикс " UTC"
    function stripUTC(s) {
        return (s || '').replace(/\s*UTC$/, '');
    }

    // [FIX] used in LiveOps detail panel + calendar context popup (prevents XSS + fixes "escapeHtml is not defined")
    function escapeHtml(v) {
        return String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }



    // базовые цвета (приближённые к карточкам на скрине), без «сверх-светлых»
    const __PP_BASE_PALETTE = [
        '#D74C87', // розовый
        '#FF6F8A', // коралл-розовый
        '#27BFC0', // бирюза
        '#FF6464', // коралл
        '#8F8F93', // серый средний
        '#84DB8C', // зелёный пастель (не слишком светлый)
        '#BFA792', // тёплый беж
        '#73CFC1', // мятный
        '#C4926F', // тёплый коричневатый
        '#FFA63C', // тёплый оранж
        '#8672D8', // фиолетово-синий
        '#F04A38', // красно-оранж
        '#1A9E24', // зелёный насыщенный
        '#5A7DFF', // яркий индиго/синий
        '#D59C1E', // золотистый
        '#16C784', // изумруд
        '#48A9F8'  // небесно-синий (средний)
    ];

    // вспомогательные функции: HEX <-> HSL и корректировка светлоты
    function __hexToHsl(hex) {
        hex = hex.replace('#', '').trim();
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) { h = s = 0; }
        else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h *= 60;
        }
        return { h, s, l };
    }
    function __hslToHex(h, s, l) {
        function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }
        h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const r = Math.round(hue2rgb(p, q, (h / 360) + 1 / 3) * 255);
        const g = Math.round(hue2rgb(p, q, (h / 360)) * 255);
        const b = Math.round(hue2rgb(p, q, (h / 360) - 1 / 3) * 255);
        const toHex = (n) => n.toString(16).padStart(2, '0').toUpperCase();
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
    function __adjustLightness(hex, delta /*-1..+1*/) {
        const { h, s, l } = __hexToHsl(hex);
        return __hslToHex(h, s, Math.max(0, Math.min(1, l + delta)));
    }

    // фильтрация «слишком светлых» (l>0.78) — из палитры их исключаем
    const __PP_PALETTE = __PP_BASE_PALETTE.filter(c => __hexToHsl(c).l <= 0.78);

    const __ppTypeColorCache = new Map(); // type -> базовый HEX
    let __ppPaletteIdx = 0;

    // резерв, если типов больше, чем оттенков в палитре
    let __ppNextHue = 0;
    const __PP_GOLDEN_ANGLE = 137.508;

    function __nextBaseColor() {
        if (__ppPaletteIdx < __PP_PALETTE.length) return __PP_PALETTE[__ppPaletteIdx++];
        // fallback: генерим новый различимый цвет
        const hue = Math.round(__ppNextHue % 360); __ppNextHue += __PP_GOLDEN_ANGLE;
        return __hslToHex(hue, 0.62, 0.48);
    }

    // сплошной цвет для компактных меток/бейджей
    function colorForType(typeRaw) {
        const key = String(typeRaw || '—').trim().toLowerCase();
        if (__ppTypeColorCache.has(key)) return __ppTypeColorCache.get(key);
        const base = __nextBaseColor();
        __ppTypeColorCache.set(key, base);
        return base;
    }

    // градиент для больших баров/«dot» (верх светлее, низ темнее)
    function gradientForType(typeRaw) {
        const base = colorForType(typeRaw);
        const top = __adjustLightness(base, +0.10);   // +10% светлее
        const bot = __adjustLightness(base, -0.12);   // −12% темнее
        return `linear-gradient(to bottom, ${top}, ${bot})`;
    }

    // опционально — сброс кэша (можно вызвать из консоли)
    window.__ppResetTypeColors = function () {
        __ppTypeColorCache.clear();
        __ppPaletteIdx = 0;
        __ppNextHue = 0;
    };



    // "YYYY-MM-DD HH:mm:ss UTC" -> ms (UTC)
    function toMsFromCell(s) {
        const iso = stripUTC(s).replace(' ', 'T') + 'Z';
        const ms = Date.parse(iso);
        return Number.isFinite(ms) ? ms : null;
    }
    function dayStartMs(isoDate /* YYYY-MM-DD */) { return Date.parse(isoDate + 'T00:00:00Z'); }
    function dayEndMs(isoDate) { return Date.parse(isoDate + 'T23:59:59Z'); }

    function passDateRule(cellStr, f) {
        // cellStr — строка из таблицы формата "YYYY-MM-DD HH:mm:ss UTC"
        if (!f || !f.rule) return true;
        const t = toMsFromCell(cellStr);
        if (t == null) return true;

        // поддержка значений "YYYY-MM-DD HH:mm" в фильтре
        const hasTime = (s) => typeof s === 'string' && s.trim().length > 10 && /\d{2}:\d{2}$/.test(s.trim());
        const toPointMs = (s) => {
            if (!s) return null;
            const [d, tm] = s.trim().split(/\s+/); // "YYYY-MM-DD" ["HH:mm"]
            if (hasTime(s)) return Date.parse(`${d}T${tm}:00Z`);
            // без времени — границы суток
            return null;
        };

        if (f.rule === 'between') {
            const a = hasTime(f.from) ? toPointMs(f.from) : (f.from ? dayStartMs(f.from) : null);
            const b = hasTime(f.to) ? toPointMs(f.to) : (f.to ? dayEndMs(f.to) : null);
            return (a == null || t >= a) && (b == null || t <= b);
        }
        if (f.rule === 'before') {
            const b = hasTime(f.from) ? toPointMs(f.from) : (f.from ? dayEndMs(f.from) : null);
            return (b == null) || (t <= b);
        }
        if (f.rule === 'after') {
            const a = hasTime(f.from) ? toPointMs(f.from) : (f.from ? dayStartMs(f.from) : null);
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

        function toMsAny(v) {
            if (v == null || v === '') return NaN;
            // уже число
            if (typeof v === 'number' && Number.isFinite(v)) return v < 1e12 ? v * 1000 : v;

            // строка с только цифрами → unix sec/ms
            if (typeof v === 'string' && /^[0-9]+$/.test(v)) {
                const n = Number(v);
                return n < 1e12 ? n * 1000 : n;
            }
            // иначе пробуем парсить как ISO
            const t = Date.parse(String(v));
            return Number.isFinite(t) ? t : NaN;
        }
        function prettyFromAny(v) {
            const ms = toMsAny(v);
            if (!Number.isFinite(ms)) return '—';
            const d = new Date(ms);
            const pad = n => String(n).padStart(2, '0');
            return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
        }


        return arr.map((it, idx) => {
            const id = it.id ?? it.ID ?? idx;
            const name = it.name ?? it.title ?? `LiveOp ${idx + 1}`;
            const type = it.type ?? it.category ?? '—';

            // старт/финал (подстраховываемся по полям)
            const start = it.startDate ?? it.start ?? it.start_time ?? it.start_at ?? it.begin_at;
            const end = it.endDate ?? it.end ?? it.end_time ?? it.end_at ?? it.finish_at;

            // --- [CONDITIONS] собираем все известные формы в единый список строк ---
            function normOp(op, field) {
                const o = String(op || '').trim();
                if (o) return o;
                // разумные дефолты
                if (/level/i.test(field)) return '>=';
                if (/version/i.test(field)) return '>=';
                return '>=';
            }
            function pushCond(lines, fieldRaw, op, val) {
                const field = String(fieldRaw || '').replace(/min.?level/i, 'level').trim() || 'condition';
                const value = (val ?? '').toString().trim();
                if (!value) return;
                lines.push(`${field} ${normOp(op, field)} ${value}`);
            }
            function fromNode(node, out) {
                if (!node) return;
                // варианты узлов
                // 1) { fieldName, operator, value }
                if (node.fieldName || node.operator || node.value != null) {
                    pushCond(out, node.fieldName, node.operator, (node.value ?? node.serialized?.value));
                    return;
                }
                // 2) { serialized: { type, value, operator? } }
                if (node.serialized) {
                    const s = node.serialized;
                    pushCond(out, s.type, s.operator, s.value);
                    return;
                }
                // 3) объект-мапа вида { appVersion: {operator, value}, eventLevel: {…} }
                if (typeof node === 'object' && !Array.isArray(node)) {
                    for (const [k, v] of Object.entries(node)) {
                        if (v && (v.value != null || v.serialized?.value != null)) {
                            pushCond(out, k, v.operator || v.serialized?.operator, (v.value ?? v.serialized?.value));
                        }
                    }
                }
                // 4) строка уже готовая
                if (typeof node === 'string') {
                    const s = node.trim();
                    if (s) out.push(s);
                }
            }
            const condLines = [];

            // Основные формы:
            if (Array.isArray(it.conditions)) {
                it.conditions.forEach(n => fromNode(n, condLines));
            } else if (it.conditions && typeof it.conditions === 'object') {
                fromNode(it.conditions, condLines);
            }

            // Одинарная форма { condition: { serialized } }
            if (it.condition?.serialized) {
                fromNode(it.condition, condLines);
            }

            // Деревья условий: it.condition.conditions = [ ... ] (AND/OR — для нас не принципиально, выводим плоско)
            if (Array.isArray(it.condition?.conditions)) {
                it.condition.conditions.forEach(n => fromNode(n, condLines));
            }

            // Частые альтернативные поля из API (подстраховка)
            const alt = {
                eventLevel: it.eventLevel ?? it.level ?? it.minLevel,
                minLevel: it.minLevel,
                maxLevel: it.maxLevel,
                appVersion: it.appVersion ?? it.minAppVersion,
                minAppVersion: it.minAppVersion,
                maxAppVersion: it.maxAppVersion
            };
            for (const [k, v] of Object.entries(alt)) {
                if (v != null && v !== '') pushCond(condLines, k, undefined, v);
            }

            // Дедуп & стабильный порядок
            const _set = new Set(condLines.map(String));
            const finalConds = Array.from(_set);


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

            // [SEGMENTS] нормализуем поле сегмента и внешний сегмент
            const segVal = it.segment ?? it.internalSegment ?? null;

            // external может прийти строкой или массивом
            let externalSegments = [];
            const extRaw = it.externalSegment ?? it.externalSegments ?? null;
            if (Array.isArray(extRaw)) externalSegments = extRaw.filter(Boolean);
            else if (extRaw != null && extRaw !== '') externalSegments = [String(extRaw)];


            return {
                id, name, type,
                // startPretty: formatUnix(start),
                // endPretty: formatUnix(end),
                // startTS: Number(start) < 1e12 ? Number(start) * 1000 : Number(start),
                // endTS: Number(end) < 1e12 ? Number(end) * 1000 : Number(end),
                startPretty: prettyFromAny(start),
                endPretty: prettyFromAny(end),
                startTS: toMsAny(start),
                endTS: toMsAny(end),
                conditions: finalConds,
                themeId, themeAssets,
                displayState, freezeEvent,
                prereq,
                segment: segVal ?? null,

                // IMPORTANT: keep original event JSON for "Show full LiveEvent JSON"
                raw: it,

                externalSegments
            };


        });
    }

    function aggregateByNameWithSegments(list) {
        const map = new Map(); // key = name|startTS|endTS|type
        for (const it of list) {
            const key = `${it.name}@@${it.startTS}@@${it.endTS}@@${it.type}`;
            let g = map.get(key);

            if (!g) {
                g = { ...it, segments: [], externalsBySegment: {} };
                // гарантируем массив условий
                g.conditions = Array.isArray(g.conditions) ? g.conditions.slice() : [];
                map.set(key, g);
            } else {
                // МЕРДЖ условий: собираем уникальные строки
                const a = new Set(Array.isArray(g.conditions) ? g.conditions : []);
                (Array.isArray(it.conditions) ? it.conditions : []).forEach(s => a.add(String(s)));
                g.conditions = Array.from(a);

                // IMPORTANT: keep first raw (do not lose it on merge)
                if (!g.raw && it.raw) g.raw = it.raw;

                // переносим тему/активы, если в новой записи они подробнее

                // переносим тему/активы, если в новой записи они подробнее
                if (!g.themeId && it.themeId) g.themeId = it.themeId;
                if (!g.themeAssets && it.themeAssets) g.themeAssets = it.themeAssets;
                // freeze/state/прочие поля оставляем как в первом, либо можно уточнять по своему правилу
            }

            const seg = (it.segment || '').trim();
            const exts = Array.isArray(it.externalSegments) ? it.externalSegments : [];
            if (seg) {
                if (!g.segments.includes(seg)) g.segments.push(seg);
                if (!g.externalsBySegment[seg]) g.externalsBySegment[seg] = [];
                for (const e of exts) {
                    const val = String(e).trim();
                    if (val && !g.externalsBySegment[seg].includes(val)) g.externalsBySegment[seg].push(val);
                }


            } else if (exts.length) {
                const k = '(no segment)';
                if (!g.segments.includes(k)) g.segments.push(k);
                if (!g.externalsBySegment[k]) g.externalsBySegment[k] = [];
                for (const e of exts) {
                    if (e && !g.externalsBySegment[k].includes(e)) g.externalsBySegment[k].push(e);
                }
            }
        }
        return [...map.values()];
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
 <!-- [CAL] Timeline (pure JS/CSS) -->
<section class="pp-cal" id="ppCal">
 

  <div class="tl-wrap">
    <div class="tl-rescol">
      <div class="tl-res-header">Events</div>
      <div class="tl-res-list" id="tlResList"></div>
    </div>

    <div class="tl-grid" id="tlGrid">
     <div class="tl-toolbar" id="tlToolbar">
   <div class="tl-left">
  <!-- Новая кнопка открытия поповера с календарём -->
  <!-- Кнопка + поповер под ней в локальном контейнере -->
<span class="tl-cal-wrap">
  <button class="tl-btn tl-icon-btn" data-nav="calendar" aria-haspopup="dialog" aria-expanded="false" data-hint="Pick a date">

  <span class="tl-icon" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
        <path d="M7 2v2H5a2 2 0 0 0-2 2v2h18V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm14 8H3v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10zm-2 2v8H5v-8h14z"/>
      </svg>
    </span>
    Calendar
  </button>
  <!-- Невидимый, но позиционированный якорь для showPicker -->
  <input id="tlDateInput" type="date" aria-hidden="true" />
</span>
<button class="tl-btn" data-nav="prev" aria-label="Назад" data-hint="Go to previous day">&#x276E;</button>
<button class="tl-btn" data-nav="today" data-hint="Jump to today">today</button>
<button class="tl-btn" data-nav="next" aria-label="Вперёд" data-hint="Go to next day">&#x276F;</button>

</div>
    <div class="tl-title" id="tlTitle"></div>
    <div class="tl-right"></div>
  </div>
  <div class="tl-grid-header" id="tlHeader"></div>
  <div class="tl-grid-body" id="tlBody"></div>


    </div>
  </div>
</section>
<!-- [/CAL] -->


    <div class="pp-liveops">

<div class="pp-table" id="ppLoTable">
  <div class="pp-t-head">

    <!-- State + кнопка фильтра -->
    <div class="pp-th state pp-state-filter">
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
    <div class="pp-th name">
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
    <div class="pp-th type pp-type-filter">
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
    <div class="pp-th start pp-date-filter">
      <div class="pp-sort" data-key="startPretty">Start Date</div>
      <button id="ppStartBtn" class="pp-icon-btn" aria-label="Filter Start Date" title="Filter"></button>

      <div id="ppStartPop" class="pp-filter-pop pp-date-pop pp-date-pop-fields" hidden role="dialog" aria-label="Start date filter">
  <div class="pp-dtf-main">
    <button id="ppStartRuleBtn" class="pp-select pp-dtf-rule" data-val="after" type="button">
      <span class="txt">After</span><span class="chev">▾</span>
    </button>

    <!-- Native date/time like timeline (tlDtDate/tlDtTime) -->
    <div class="pp-dtf-fields tl-dtp">
      <label class="tl-dtp-col">
        <span class="lbl">Date (UTC)</span>
        <input id="ppStartDate" type="date" class="fld pp-inp" />
      </label>

      <label class="tl-dtp-col">
        <span class="lbl">Time (UTC)</span>
        <input id="ppStartTime" type="time" step="60" class="fld pp-inp" />
      </label>
    </div>

    <div class="pp-dtf-actions">
      <button id="ppStartReset" class="pp-btn pp-reset" type="button">RESET</button>
      <button id="ppStartOk" class="pp-btn primary" type="button">CONFIRM</button>
    </div>
  </div>

  <input id="ppStartFrom" type="hidden" />
  <input id="ppStartTo" type="hidden" />

  <div id="ppStartRuleMenu" class="pp-select-menu" hidden>
  <button data-val="after" type="button">After</button>
  <button data-val="before" type="button">Before</button>
</div>
</div> <!-- /#ppStartPop -->
</div> <!-- /.pp-th.start -->


    <!-- End date -->
    <div class="pp-th end pp-date-filter">
      <div class="pp-sort" data-key="endPretty">End Date</div>
      <button id="ppEndBtn" class="pp-icon-btn" aria-label="Filter End Date" title="Filter"></button>

      <div id="ppEndPop" class="pp-filter-pop pp-date-pop pp-date-pop-fields" hidden role="dialog" aria-label="End date filter">
  <div class="pp-dtf-main">
    <button id="ppEndRuleBtn" class="pp-select pp-dtf-rule" data-val="before" type="button">
      <span class="txt">Before</span><span class="chev">▾</span>
    </button>

    <!-- Native date/time like timeline (tlDtDate/tlDtTime) -->
    <div class="pp-dtf-fields tl-dtp">
      <label class="tl-dtp-col">
        <span class="lbl">Date (UTC)</span>
        <input id="ppEndDate" type="date" class="fld pp-inp" />
      </label>

      <label class="tl-dtp-col">
        <span class="lbl">Time (UTC)</span>
        <input id="ppEndTime" type="time" step="60" class="fld pp-inp" />
      </label>
    </div>

    <div class="pp-dtf-actions">
      <button id="ppEndReset" class="pp-btn pp-reset" type="button">RESET</button>
      <button id="ppEndOk" class="pp-btn primary" type="button">CONFIRM</button>
    </div>
  </div>

  <input id="ppEndFrom" type="hidden" />
  <input id="ppEndTo" type="hidden" />

  <div id="ppEndRuleMenu" class="pp-select-menu" hidden>
    <button data-val="before" type="button">Before</button>
    <button data-val="after" type="button">After</button>
  </div>
</div>


    </div>

    <!-- ВАЖНО: 6-я колонка под кнопку Info (как в Promotions) -->
    <div class="pp-th info"></div>

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
  <!-- Новая кнопка глобального сброса фильтров -->
  <button id="ppResetBtn" class="pp-btn pp-reset" type="button" title="Reset all table filters">
    Reset Filters
  </button>

  <span class="pp-label">Rows per page</span>
<span class="pp-sel-wrap">
  <select class="pp-sel" id="ppRows">
    <option>10</option><option selected>25</option><option>50</option>
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

        function stripUTC(s) { return (s || '').replace(/\s*UTC$/, ''); }



        function groupByType(rows) {
            const map = new Map();
            rows.forEach(r => { const k = r.type || '—'; (map.get(k) || map.set(k, []).get(k)).push(r); });
            return [...map.entries()].map(([type, items]) => ({ type, items }));
        }

        // применяем действующие фильтры таблицы (используем твои переменные фильтров и хелперы)
        function filterForCalendar(src) {
            let rows = src.slice();

            // state
            if (stateFilter && stateFilter.size) rows = rows.filter(r => stateFilter.has(r.displayState));

            // type (чекбоксы)
            if (typeFilter && typeFilter.size) rows = rows.filter(r => typeFilter.has(r.type));

            // type (текстовое правило)
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

            // dates
            rows = rows.filter(r => passDateRule(r.startPretty, startFilter) &&
                passDateRule(r.endPretty, endFilter));
            return rows;
        }

        // === [CAL] масштаб (единица клетки) и хелперы ===
        let calState = {
            unit: 'd',            // 'h' | 'd' | 'w' | 'm'
            keepCenterTs: null,   // «сидим» на времени при смене масштаба
            msPerPx: null,        // миллисекунд на 1px (масштаб)
            canvasStartMs: null,  // задаются в renderCalendar
            canvasEndMs: null,
            gridMs: null,
            view: 'day',          // 'month' | 'week' | 'day'
            // ВАЖНО: берём ТЕКУЩЕЕ UTC-время как якорь,
            // а границы суток считаем в computeRange → от UTC-полуночи
            anchorMs: Date.now(),
            ticks: 0
        };



        function pickGridMs(msPerPx) {
            // шаги: 30с → 1м → 5м → 10м → 15м → 30м → 1–12ч → 1–3д → неделя
            const c = [
                30e3, 60e3, 5 * 60e3, 10 * 60e3, 15 * 60e3, 30 * 60e3,
                3600e3, 2 * 3600e3, 3 * 3600e3, 6 * 3600e3, 12 * 3600e3,
                24 * 3600e3, 2 * 24 * 3600e3, 3 * 24 * 3600e3, 7 * 24 * 3600e3
            ];
            let best = c[0], bestErr = Math.abs(best / msPerPx - 80);
            for (const v of c) {
                const err = Math.abs(v / msPerPx - 80);
                if (err < bestErr) { best = v; bestErr = err; }
            }
            return best;
        }

        function fmtTickMsByGrid(t, gMs) {
            const d = new Date(t);
            const pad = n => String(n).padStart(2, '0');
            const yyyy = d.getUTCFullYear();
            const MM = pad(d.getUTCMonth() + 1);
            const DD = pad(d.getUTCDate());
            const hh = pad(d.getUTCHours());
            const mm = pad(d.getUTCMinutes());
            const ss = pad(d.getUTCSeconds());

            // На мелких шагах — два ряда: дата \n время
            if (gMs <= 30e3) return `${DD}.${MM}.${yyyy}\n${hh}:${mm}:${ss}`;
            if (gMs < 3600e3) return `${DD}.${MM}.${yyyy}\n${hh}:${mm}`;
            if (gMs < 24 * 3600e3) return `${DD}.${MM}.${yyyy}\n${hh}:00`;
            return `${DD}.${MM}.${yyyy}\n00:00`; // или \n${hh}:${mm} если хочешь реальное время тика

        }

        function startOfDayUTCms(ms) {
            const d = new Date(ms); d.setUTCHours(0, 0, 0, 0); return d.getTime();
        }

        function startOfWeekUTC(ms) { // неделя с понедельника
            const d = new Date(startOfDayUTCms(ms));
            const wd = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - wd);
            return d.getTime();
        }

        function startOfMonthUTC(ms) {
            const d = new Date(ms); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); return d.getTime();
        }

        function computeRange(_view, anchorMs) {
            // Всегда 1 сутки [UTC-полночь .. +24ч)
            const A = startOfDayUTCms(anchorMs);
            return [A, A + 24 * 3600e3];
        }

        // Локальная полночь в миллисекундах (UTC-инстант как число)
        function startOfLocalDayAsUTCms(now = new Date()) {
            const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            return localMidnight.getTime() - now.getTimezoneOffset() * 60000;
        }
        if (typeof window !== 'undefined') {
            window.startOfLocalDayAsUTCms = window.startOfLocalDayAsUTCms || startOfLocalDayAsUTCms;
        }


        const UNIT_MS = { h: 3600e3, d: 86400e3, w: 7 * 86400e3, m: 30 * 86400e3 }; // месяц ~30d ок
        const PX_PER_UNIT = { h: 48, d: 60, w: 120, m: 160 };                   // комфортный масштаб

        function getUnitMs(u) { return UNIT_MS[u] || UNIT_MS.d; }
        function pxPerUnit(u) { return PX_PER_UNIT[u] || PX_PER_UNIT.d; }

        function updateUnitChips() {
            const box = wrap.querySelector('#ppCalRange');
            box?.querySelectorAll('.pp-chip').forEach(b => {
                b.classList.toggle('selected', b.dataset.unit === calState.unit);
            });
        }

        // общий охват по отфильтрованным строкам + небольшой зазор по краям
        function computeExtent(rows, unitMs) {
            let min = Infinity, max = -Infinity;
            rows.forEach(r => {
                if (typeof r.startTS === 'number') min = Math.min(min, r.startTS);
                if (typeof r.endTS === 'number') max = Math.max(max, r.endTS);
            });
            if (!isFinite(min) || !isFinite(max)) {
                const now = Date.now();
                min = now - 15 * UNIT_MS.d; max = now + 15 * UNIT_MS.d;
            }
            const padUnits = 8; // запас для скролла, чтобы «не упираться»
            const snappedA = Math.floor(min / unitMs) * unitMs - padUnits * unitMs;
            const snappedB = Math.ceil(max / unitMs) * unitMs + padUnits * unitMs;
            return [snappedA, snappedB];
        }

        // формат подписи шкалы ( по выбранной единице )
        function fmtTick(ts, unit) {
            const d = new Date(ts);
            switch (unit) {
                case 'h': return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit' });
                case 'w': { // неделя — показываем понедельник
                    const dd = new Date(ts);
                    return dd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                }
                case 'm': return d.toLocaleString('en-GB', { month: 'short', year: '2-digit' });
                default: return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            }
        }

        function renderCalendar() {
            const wrapEl = wrap;
            const rowsBox = wrapEl.querySelector('#ppCalRows');
            const scale = wrapEl.querySelector('#ppCalScale');
            const side = wrapEl.querySelector('#ppCalSide');

            // 1) данные (с учётом действующих фильтров) и группировка
            const rows = filterForCalendar(items);
            const bands = groupByType(rows);

            // шкала + строки
            const mainEl = wrapEl.querySelector('.pp-cal-main');

            // базовый диапазон A..B под режим (day/week/month)
            const [baseA, baseB] = computeRange(calState.view, calState.anchorMs);

            // назначаем «шаг сетки» и базовый масштаб под режим
            let gridMs, msPerPx;
            if (calState.view === 'month') {              // деление = 1 день
                gridMs = 24 * 3600e3; msPerPx = gridMs / 48;   // ≈48px на день
            } else if (calState.view === 'week') {        // деление = 1 час
                gridMs = 3600e3; msPerPx = gridMs / 20;   // ≈20px на час
            } else {                                      // day — 15 минут
                gridMs = 15 * 60e3; msPerPx = gridMs / 14;   // ≈14px на 15 минут
            }
            calState.gridMs = gridMs;
            calState.msPerPx = msPerPx;

            const cellW = gridMs / msPerPx;

            // --- ВАЖНО: расширяем канву относительно базового окна ---
            const viewWpx = Math.max(1, (mainEl?.clientWidth || 0));
            const viewWms = viewWpx * msPerPx;
            // держим канву ≈ 6 экранов по времени, по центру вокруг baseA..baseB
            const baseW = baseB - baseA;
            const desiredW = Math.max(baseW, viewWms * 6);
            const center = baseA + baseW / 2;
            const A = center - desiredW / 2;
            const B = center + desiredW / 2;

            // сохраняем границы полотна (будут сдвигаться при скролле)
            calState.canvasStartMs = A;
            calState.canvasEndMs = B;

            updateUnitChips();



            // [ЯКОРЬ JS-1] виртуальная отрисовка подписей шкалы
            function buildScale(scaleEl, A, B, gMs, cellW, main, mode = 'minor') {
                if (!scaleEl || !main) return 0;
                const viewW = main.clientWidth || 0;
                const scroll = main.scrollLeft || 0;
                const startIx = Math.floor(scroll / cellW);
                const offsetPx = startIx * cellW - scroll;
                const visTicks = Math.max(1, Math.ceil(viewW / cellW) + 6);

                scaleEl.style.display = 'grid';
                scaleEl.style.gridTemplateColumns = `repeat(${visTicks}, ${cellW}px)`;
                scaleEl.style.transform = `translateX(${offsetPx}px)`;
                scaleEl.innerHTML = '';

                let anyLabel = false; // ← ДОБАВЛЕНО
                for (let i = 0; i < visTicks; i++) {
                    const t = A + (startIx + i) * gMs;
                    const div = document.createElement('div');
                    div.className = 'pp-cal-tick';

                    if (mode === 'major') {
                        const d = new Date(t);
                        const pad = n => String(n).padStart(2, '0');
                        const fullDate = `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
                        if (gMs < 24 * 3600e3) {
                            if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) div.textContent = fullDate;
                            else div.textContent = '';
                        } else {
                            div.textContent = fullDate;
                        }
                        if (div.textContent) anyLabel = true; // ← ДОБАВЛЕНО
                    } else {
                        // нижняя строка — новый форматтер по gMs
                        div.textContent = fmtTickMsByGrid(t, gMs);
                    }

                    scaleEl.appendChild(div);
                }

                // ← ДОБАВЛЕНО: если в видимом окне нет полуночи — покажем дату на первом тике
                if (mode === 'major' && !anyLabel && scaleEl.firstChild) {
                    const t0 = A + startIx * gMs;
                    const d0 = new Date(t0);
                    const pad = n => String(n).padStart(2, '0');
                    const fullDate0 = `${pad(d0.getUTCDate())}.${pad(d0.getUTCMonth() + 1)}.${d0.getUTCFullYear()}`;
                    scaleEl.firstChild.textContent = fullDate0;
                }
                return visTicks;
            }


            // сначала получаем ссылки на обе шкалы
            const scaleTop = scale;
            const scaleBottom = wrapEl.querySelector('#ppCalScaleBottom');
            const totalW = Math.ceil((B - A) / calState.msPerPx);
            rowsBox.style.width = totalW + 'px';

            // [NOW-UTC:FIXED] — рисуем «сейчас» после того, как известен локальный msPerPx и размеры
            (function drawNowUTC() {
                const mainHost = wrapEl.querySelector('.pp-cal-main');
                if (!mainHost) return;

                // синхронизируем переменную высоты шкалы для корректного позиционирования бейджа
                const scaleTopEl = wrapEl.querySelector('#ppCalScale');
                const scaleH = (scaleTopEl?.offsetHeight || 40);
                mainHost.style.setProperty('--pp-scale-h', scaleH + 'px');


                // высота линии: тянем до низа контента (включая все ряды)
                const nowH = (rowsBox?.scrollHeight || mainHost.scrollHeight || 0);
                if (nowH > 0) {
                    mainHost.style.setProperty('--pp-now-h', nowH + 'px'); // см. .pp-cal-now { height: var(--pp-now-h) }
                }

                // создать/получить элемент линии
                let nowEl = mainHost.querySelector('.pp-cal-now');
                if (!nowEl) {
                    nowEl = document.createElement('div');
                    nowEl.className = 'pp-cal-now';
                    mainHost.appendChild(nowEl);
                }

                const now = Date.now(); // UTC millis

                if (now >= A && now <= B) {
                    const x = (now - A) / msPerPx;
                    nowEl.style.left = x + 'px';
                    nowEl.hidden = false;

                    // обновляем подпись времени UTC на бейдже
                    {
                        const d = new Date();
                        const hh = String(d.getUTCHours()).padStart(2, '0');
                        const mm = String(d.getUTCMinutes()).padStart(2, '0');
                        nowEl.setAttribute('data-time', `${hh}:${mm}`);
                    }



                    // [AUTO-CENTER-NOW] — один раз при первом рендере прокручиваем, чтобы «сейчас» попало в видимую область
                    // [AUTO-CENTER-NOW] — центрируем «сейчас» один раз после первого рендера
                    if (!calState._didCenterNow) {
                        const viewW = mainHost.clientWidth || 0;
                        if (viewW > 0) {
                            const desired = Math.round(x - viewW / 2);
                            const maxScroll = Math.max(0, mainHost.scrollWidth - mainHost.clientWidth);
                            mainHost.scrollLeft = Math.max(0, Math.min(desired, maxScroll));
                        }
                        calState._didCenterNow = true;
                    }


                } else {
                    nowEl.hidden = true;
                }


                // поддерживаем актуальную высоту при изменениях размеров/контента
                if (!drawNowUTC._ro && typeof ResizeObserver === 'function' && rowsBox) {
                    drawNowUTC._ro = new ResizeObserver(() => {
                        const h = rowsBox.scrollHeight;
                        if (h > 0) mainHost.style.setProperty('--pp-now-h', h + 'px');
                    });
                    drawNowUTC._ro.observe(rowsBox);
                    // плюс быстрый хук на ресайз окна
                    window.addEventListener('resize', () => {
                        const h = rowsBox.scrollHeight;
                        if (h > 0) mainHost.style.setProperty('--pp-now-h', h + 'px');
                    }, { passive: true });
                }
            })();


            // --- Центровка на «сейчас» при первом входе (UTC) ---
            // Делаем выравнивание по «красной палочке» один раз после того,
            // как у .pp-cal-main появились реальные размеры.
            if (!calState._centeredOnce) {
                const main = wrapEl.querySelector('.pp-cal-main');

                const centerOnce = () => {
                    if (!main || !Number.isFinite(calState.canvasStartMs) || !calState.msPerPx) return false;

                    const viewW = main.clientWidth || 0;
                    if (viewW <= 0 || main.scrollWidth === 0) return false;

                    // позиция «сейчас» в пикселях от начала канвы
                    const xNow = (Date.now() - calState.canvasStartMs) / (calState.msPerPx || 1);

                    const desired = Math.round(xNow - viewW / 2);
                    const maxScroll = Math.max(0, main.scrollWidth - viewW);
                    main.scrollLeft = Math.max(0, Math.min(desired, maxScroll));

                    // обновляем сдвиг фон-сетки, чтобы линии совпадали
                    const cellW = (calState.gridMs || 1) / (calState.msPerPx || 1);
                    const off = -(main.scrollLeft % cellW);
                    main.style.setProperty('--pp-grid-off', off + 'px');

                    calState._centeredOnce = true;
                    return true;
                };

                // Пытаемся сразу, если лэйаут уже готов
                if (!centerOnce()) {
                    // Если ещё 0 ширина — дожидаемся следующего кадра / ресайза
                    requestAnimationFrame(() => {
                        if (!centerOnce() && typeof ResizeObserver === 'function' && main) {
                            const ro = new ResizeObserver(() => {
                                if (centerOnce()) ro.disconnect();
                            });
                            ro.observe(main);
                        }
                    });
                }
            }



            // [FIX] вертикальный скролл и синхронное смещение event-type колонок
            elBody.addEventListener('scroll', () => {
                const dpr = window.devicePixelRatio || 1;
                const y = Math.round(elBody.scrollTop * dpr) / dpr;
                elRes.style.transform = `translateY(${-y}px)`;
            });


            // шкалы тянутся на всю ширину контейнера
            scaleTop.style.width = '';
            if (scaleBottom) scaleBottom.style.width = '';

            // [НОВОЕ] первичная отрисовка (сверху — «крупные», снизу — «мелкие»)
            const makeScales = () => {
                const t = buildScale(scaleTop, A, B, gridMs, cellW, mainEl, 'major');
                calState.ticks = t;
                buildScale(scaleBottom, A, B, gridMs, cellW, mainEl, 'minor');
            };

            makeScales();


            if (calState._onScroll && mainEl) {
                mainEl.removeEventListener('scroll', calState._onScroll);
            }

            let scaleRaf = 0;
            // отложенный ребейз после паузы
            clearTimeout(calState._rebaseTimer);
            calState._rebaseTimer = 0;

            // «перешиваем» полотно времени, когда подходим к краям
            function rebaseIfNeeded() {
                const msPerPx = calState.msPerPx || 1;
                const vw = mainEl.clientWidth || 0;
                const vwMs = vw * msPerPx;

                let A = calState.canvasStartMs;
                let B = calState.canvasEndMs;
                const W = B - A;

                const leftPx = mainEl.scrollLeft;
                const rightPx = leftPx + vw;

                const nearLeft = leftPx < vw * 0.20;
                const nearRight = rightPx > (mainEl.scrollWidth - vw * 0.20);
                if (!nearLeft && !nearRight) return;

                // запомним мировой левый край
                const worldLeftMs = A + leftPx * msPerPx;
                const shift = Math.max(vwMs * 3, W / 2);

                let newA = A, newB = B;
                if (nearLeft) { newA = A - shift; newB = B - shift; }
                if (nearRight) { newA = A + shift; newB = B + shift; }

                calState.canvasStartMs = newA;
                calState.canvasEndMs = newB;

                // ширина полотна рядов
                const totalW = Math.ceil((newB - newA) / msPerPx) + vw;
                const rowsBox = wrapEl.querySelector('.pp-cal-rows');
                if (rowsBox) rowsBox.style.width = totalW + 'px';

                // перерисуем подписи шкал под новый диапазон
                makeScales?.();

                // вернуть прежний мировой левый край
                const newLeftPx = (worldLeftMs - newA) / msPerPx;
                const maxLeft = Math.max(0, mainEl.scrollWidth - mainEl.clientWidth);
                mainEl.scrollLeft = Math.max(0, Math.min(newLeftPx, maxLeft));

                // и пересчитаем позиции видимых баров
                requestAnimationFrame(() => updateBarsPositions(mainEl.clientWidth));
            }

            // апдейтер позиций баров (только видимое окно + запас)
            function updateBarsPositions(padPx = mainEl.clientWidth) {
                const A = calState.canvasStartMs;
                const msPerPx = calState.msPerPx || 1;
                const rowsBox = wrapEl.querySelector('#ppCalRows') || wrapEl.querySelector('.pp-cal-rows');
                if (!rowsBox || !Number.isFinite(A)) return;

                const viewLeft = mainEl.scrollLeft;
                const viewRight = viewLeft + mainEl.clientWidth;
                const minTs = A + Math.max(0, viewLeft - padPx) * msPerPx;
                const maxTs = A + (viewRight + padPx) * msPerPx;

                const updIfVisible = (el) => {
                    const a = +el.dataset.a, b = +el.dataset.b;
                    if (!Number.isFinite(a) || !Number.isFinite(b)) return;
                    if (b < minTs || a > maxTs) return;
                    el.style.left = ((a - A) / msPerPx) + 'px';
                    el.style.width = Math.max(1, (b - a) / msPerPx) + 'px';
                };

                rowsBox.querySelectorAll('.pp-cal-bar, .pp-cal-overlap').forEach(updIfVisible);
            }

            calState._onScroll = function onScroll() {
                // фон-сетка — сразу
                if (!scaleRaf) {
                    scaleRaf = requestAnimationFrame(() => {
                        const off = -(mainEl.scrollLeft % cellW);
                        mainEl.style.setProperty('--pp-grid-off', off + 'px');
                        scaleRaf = 0;
                    });
                }

                // тяжёлые операции — после паузы
                clearTimeout(calState._rebaseTimer);
                calState._rebaseTimer = setTimeout(() => {
                    rebaseIfNeeded();
                    updateBarsPositions();
                }, 120);
            };
            mainEl?.addEventListener('scroll', calState._onScroll);



            mainEl.style.overflowX = 'auto';
            rowsBox.style.setProperty('--pp-dayw', cellW + 'px');
            wrapEl.querySelector('.pp-cal-main')?.style.setProperty('--pp-canvas-w', totalW + 'px');

            // [PERF] сдвиг фона сетки во вьюпорте
            // const mainEl = wrapEl.querySelector('.pp-cal-main');
            const off = -((mainEl?.scrollLeft || 0) % cellW);
            mainEl?.style.setProperty('--pp-grid-off', off + 'px');
            mainEl?.style.setProperty('--pp-dayw', cellW + 'px');


            // --- первичное центрирование на локальном «сегодня» (один раз) ---



            // левая панель типов
            side.innerHTML = '';
            bands.forEach(b => {
                const row = document.createElement('label');
                row.className = 'pp-cal-side-row';
                row.innerHTML = `
      <input type="checkbox" class="pp-cal-toggle" data-type="${b.type}" checked>
          <span class="dot" style="background:${gradientForType(b.type)}"></span>
 
      <span class="lbl" title="${b.type}">${b.type}</span>`;
                side.appendChild(row);
            });

            // строки таймлайна (одна линия на тип, пересечения — штриховка)
            rowsBox.innerHTML = '';

            // kill any native browser tooltips inside calendar (safety net)
            if (!calState._killNativeTooltip) {
                calState._killNativeTooltip = true;
                // любой элемент с title внутри полотна — очищаем, чтобы не перебивать наш попап
                mainEl.addEventListener('mouseover', (evt) => {
                    const n = evt.target && (evt.target.closest('[title]'));
                    if (n && n.getAttribute('title')) n.removeAttribute('title');
                }, { passive: true, capture: true });
            }


            // === [CTX POPUP] helpers: create/close/position =================================
            const mainElPos = mainEl.getBoundingClientRect();

            function closeCtxPopup() {
                // закрываем независимо от места вставки
                document.querySelectorAll('.pp-ctx').forEach(n => n.remove());
                calState._ctxOpen = false;
            }
            function openCtxPopup(e, data) {
                closeCtxPopup();
                calState._ctxOpen = true;

                const { title, start, end, segments = [], conditions = [], externalsBySegment = {} } = data || {};
                const pop = document.createElement('div');
                pop.className = 'pp-ctx';

                const condHtml = (Array.isArray(conditions) && conditions.length)
                    ? `<div class="conds">${conditions.map(c => `<div><code>${escapeHtml(String(c))}</code></div>`).join('')}</div>`
                    : `<span class="muted">—</span>`;

                pop.innerHTML = `
  <div class="pp-ctx-title">
    <span class="txt">${title ? escapeHtml(title) : ''}</span>
    <div class="pp-title-actions">
      <button class="pp-ico act-open" data-hint="Open in table" aria-label="Open in table" title="">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" ry="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <path d="M3 10h18M3 14h18" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <path d="M9 4v16M15 4v16" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
      </button>
      <button class="pp-ico act-copy" data-hint="Copy" aria-label="Copy" title="">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <rect x="4" y="7" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
          <rect x="9" y="4" width="11" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
        </svg>
      </button>
    </div>
  </div>
  <div class="pp-ctx-row"><span class="k">Start</span><span class="v">${escapeHtml(start || '')}</span></div>
  <div class="pp-ctx-row"><span class="k">End</span><span class="v">${escapeHtml(end || '')}</span></div>
  ${Array.isArray(segments) && segments.length ? `
    <div class="pp-ctx-row segs"><span class="k">Segments</span>
      <div class="v">
        ${segments.map(s => {
                    const exts = externalsBySegment && externalsBySegment[s] ? externalsBySegment[s] : [];
                    const extsHtml = exts.length ? `<div class="ext">${exts.map(x => `<code>${escapeHtml(x)}</code>`).join(' ')}</div>` : '';
                    return `<div class="seg"><code>${escapeHtml(String(s))}</code>${extsHtml}</div>`;
                }).join('')}
      </div>
    </div>` : ''
                    }
  <div class="pp-ctx-row"><span class="k">Conditions</span><span class="v">${condHtml}</span></div>
`;

                // === позиционирование: фикс relative к вьюпорту, по координатам клика ===
                // вставляем в <body>, чтобы ни scroll ни transform родителей не влияли
                document.body.appendChild(pop);

                // небольшой отступ от курсора
                const GAP = 12;

                // измеряем и укладываем в видимую область
                requestAnimationFrame(() => {
                    const r = pop.getBoundingClientRect();
                    const vw = window.innerWidth, vh = window.innerHeight;

                    let left = e.clientX + GAP;
                    let top = e.clientY + GAP;

                    // не выезжать за правый/нижний край
                    if (left + r.width > vw - 8) left = Math.max(8, vw - r.width - 8);
                    if (top + r.height > vh - 8) top = Math.max(8, vh - r.height - 8);

                    pop.style.left = left + 'px';
                    pop.style.top = top + 'px';
                });

                // действия
                const openBtn = pop.querySelector('.act-open');
                const copyBtn = pop.querySelector('.act-copy');

                openBtn?.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    document.dispatchEvent(new CustomEvent('pp:applyNameFilter', { detail: { title } }));
                    closeCtxPopup();
                });

                copyBtn?.addEventListener('click', async (ev) => {
                    ev.stopPropagation();
                    try {
                        await navigator.clipboard.writeText(title || '');
                        const prev = copyBtn.getAttribute('data-hint');
                        copyBtn.setAttribute('data-hint', 'Copied!');
                        setTimeout(() => copyBtn.setAttribute('data-hint', prev || 'Copy'), 900);
                    } catch {
                        const ta = document.createElement('textarea');
                        ta.value = title || '';
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                    }
                });


                // Если вылезает за край — сместим влево/вверх
                const pr = pop.getBoundingClientRect();
                const overflowX = pr.right - (rect.right);
                const overflowY = pr.bottom - (rect.bottom);
                if (overflowX > 0) pop.style.left = (x - overflowX - 12) + 'px';
                if (overflowY > 0) pop.style.top = (y - overflowY - 12) + 'px';

                // Закрытие по клику вне + защита от мгновенного переоткрытия
                const onDocClick = (evt) => {
                    if (!pop.contains(evt.target)) {
                        calState._preventOpenOnce = true;
                        closeCtxPopup();
                        document.removeEventListener('click', onDocClick, true);
                        setTimeout(() => { calState._preventOpenOnce = false; }, 0);
                    }
                };

                document.addEventListener('click', onDocClick, true);

            }


            // ================================================================================


            bands.forEach(band => {
                const rowEl = document.createElement('div');
                rowEl.className = 'pp-cal-row';
                rowEl.dataset.type = band.type;
                rowsBox.appendChild(rowEl);

                // обрезаем события типa рамками полотна A..B (из шага 3)
                const clipped = band.items
                    .slice()
                    .map(ev => {
                        const a = Math.max(ev.startTS, A);
                        const bEnd = Math.min(ev.endTS, B);
                        return (bEnd > a) ? { a, bEnd, ev } : null;
                    })
                    .filter(Boolean)
                    .sort((x, y) => x.a - y.a);

                // БАЗОВЫЕ бары (одна линия)
                clipped.forEach(({ a, bEnd, ev }) => {
                    const leftPx = (a - A) / msPerPx;
                    const widthPx = Math.max(2, (bEnd - a) / msPerPx);
                    const bar = document.createElement('div');
                    bar.dataset.a = String(a);        // ← добавить
                    bar.dataset.b = String(bEnd);     // ← добавить

                    bar.className = 'pp-cal-bar';

                    // === НАЗВАНИЕ СОБЫТИЯ/ПРОМО (липкий текст как в LiveOps) ===
                    const txt = document.createElement('div');
                    txt.className = 'txt';
                    txt.textContent = (ev?.title ?? ev?.name ?? ev?.id ?? '—');

                    bar.appendChild(txt);

                    bar.style.left = leftPx + 'px';
                    bar.style.width = widthPx + 'px';

                    bar.style.background = gradientForType(band.type);
                    // bar.title = `${ev.name}\n${stripUTC(ev.startPretty)} — ${stripUTC(ev.endPretty)} (UTC)`;
                    // bar.innerHTML = `<span class="txt">${ev.name}</span>`;
                    // rowEl.appendChild(bar);


                    bar.removeAttribute('title');

                    // Данные для контекстного окна (UTC-строки уже подготовлены в ev.startPretty/ev.endPretty)
                    bar.dataset.title = ev.name || '';
                    bar.dataset.type = band.type || '';
                    bar.dataset.startUtc = ev.startPretty || '';

                    bar.dataset.endUtc = ev.endPretty || '';
                    bar.dataset.segments = JSON.stringify(ev.segments || []);
                    bar.dataset.conditions = JSON.stringify(ev.conditions || []);
                    // externalsBySegment может отсутствовать — норм
                    bar._externalsBySegment = ev.externalsBySegment || {};


                    // попап сегментов внутри бара
                    const hasSegs = Array.isArray(ev.segments) && ev.segments.length;
                    const popHtml = hasSegs ? `
  <button class="pp-seg-btn" type="button" aria-label="Segments">▾</button>
  <div class="pp-seg-pop" hidden>
    ${ev.segments.map(s => {
                        const exts = (ev.externalsBySegment && ev.externalsBySegment[s]) ? ev.externalsBySegment[s] : [];
                        return `<div class="seg"><code>${s}</code>
          ${exts.length ? `<div class="ext">${exts.map(e => `<div><code>${e}</code></div>`).join('')}</div>` : ''}</div>`;
                    }).join('')}
  </div>
` : '';

                    // [TITLE SAFETY] — всегда экранируем + форсим видимость текста
                    bar.innerHTML = `<span class="txt" style="display:block;opacity:1;visibility:visible;color:#fff;-webkit-text-fill-color:#fff;position:sticky;left:0;z-index:2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(ev.name || '')}</span>${popHtml}`;
                    rowEl.appendChild(bar);

                    // Клик по ЛЮБОЙ части бара — показать контекстное окно в точке клика
                    bar.addEventListener('click', (evt) => {
                        // ЖЁСТКО гасим дефолт и всплытие, чтобы не стреляли старые слушатели
                        evt.preventDefault();
                        evt.stopPropagation();

                        // Если этот клик пришёл сразу после закрытия попапа — ничего не открываем
                        if (calState._preventOpenOnce) {
                            calState._preventOpenOnce = false; // на всякий — «съедаем» флаг
                            return;
                        }

                        // Подстраховка: если по какой-то причине попап ещё открыт — закрываем и не открываем новый
                        if (mainEl.querySelector('.pp-ctx')) {
                            calState._preventOpenOnce = true;
                            closeCtxPopup();
                            setTimeout(() => { calState._preventOpenOnce = false; }, 0);
                            return;
                        }

                        const data = {
                            title: bar.dataset.title,
                            start: bar.dataset.startUtc,
                            end: bar.dataset.endUtc,
                            segments: (() => { try { return JSON.parse(bar.dataset.segments || '[]'); } catch { return []; } })(),
                            conditions: (() => { try { return JSON.parse(bar.dataset.conditions || '[]'); } catch { return []; } })(),
                            externalsBySegment: bar._externalsBySegment
                        };
                        openCtxPopup(evt, data);
                    });

                    // блокируем старое контекст-меню по правому клику
                    bar.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    });



                    // поведение ▾
                    if (hasSegs) {
                        const btn = bar.querySelector('.pp-seg-btn');
                        const pop = bar.querySelector('.pp-seg-pop');
                        btn?.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const hidden = pop.hasAttribute('hidden');
                            if (hidden) pop.removeAttribute('hidden'); else pop.setAttribute('hidden', '');
                        });
                    }


                });

                // ПЕРЕСЕЧЕНИЯ (line-sweep) — тоже в px от A
                const segments = [];
                {
                    const pts = [];
                    clipped.forEach(({ a, bEnd }) => { pts.push([a, +1]); pts.push([bEnd, -1]); });
                    pts.sort((p, q) => (p[0] - q[0]) || (q[1] - p[1]));
                    let active = 0, prev = null;
                    for (const [x, delta] of pts) {
                        if (prev != null && active >= 2 && x > prev) segments.push([prev, x]);
                        active += delta;
                        prev = x;
                    }
                }
                segments.forEach(([a, bEnd]) => {

                    const leftPx = (a - A) / msPerPx;
                    const widthPx = Math.max(1, (bEnd - a) / msPerPx);
                    // const leftPx = ((a - A) / dayMS) * cellW;
                    // const widthPx = Math.max(1, ((bEnd - a) / dayMS) * cellW);
                    const ov = document.createElement('div');
                    ov.className = 'pp-cal-overlap';
                    ov.style.left = leftPx + 'px';
                    ov.style.width = widthPx + 'px';
                    ov.dataset.a = String(a);
                    ov.dataset.b = String(bEnd);
                    /* страховка: даже если CSS не подгрузился, перекрытия НЕ ловят клики */
                    ov.style.pointerEvents = 'none';
                    rowEl.appendChild(ov);

                });
            });

            // переключатель видимости типа: делаем «приглушить»
            side.addEventListener('change', (e) => {
                const cb = e.target.closest('.pp-cal-toggle'); if (!cb) return;
                rowsBox.querySelectorAll(`.pp-cal-row[data-type="${CSS.escape(cb.dataset.type)}"] .pp-cal-bar`)
                    .forEach(b => b.classList.toggle('muted', !cb.checked));
            });

            // [NOW-TICK] — раз в минуту обновляем позицию "сейчас"
            clearTimeout(calState._nowTick);
            calState._nowTick = setTimeout(() => { renderCalendar(); }, 60 * 1000);

            // === ВАЖНО: заново подключаем dropdown после перерисовки ===
            const viewBtn = wrap.querySelector('#tlViewBtn');
            const menu = wrap.querySelector('#tlDropdownMenu');
            const currentLabel = wrap.querySelector('.tl-current');

            if (viewBtn && menu && currentLabel) {
                viewBtn.onclick = (e) => {
                    e.stopPropagation();
                    menu.hidden = !menu.hidden;
                };

                // [UPDATED] правильное переключение масштаба + защита от back-swipe
                menu.onclick = (e) => {
                    const opt = e.target.closest('button[data-view]');
                    if (!opt) return;

                    const val = opt.dataset.view;
                    currentLabel.textContent = opt.textContent.trim();
                    menu.hidden = true;

                    // при смене масштаба — просим рендер заново и заново центрируем "сегодня"
                    calState._centeredOnce = false;
                    calState.view = val;
                    renderCalendar();

                    // страховка: после рендераscrollLeft>0, чтобы вертикальный жест не трактовался как "назад"
                    requestAnimationFrame(() => {
                        const m = wrap.querySelector('.pp-cal-main');
                        if (m && m.scrollLeft === 0) m.scrollLeft = 1;
                    });
                };


                document.addEventListener('click', (e) => {
                    if (!menu.hidden && !e.target.closest('.tl-dropdown')) menu.hidden = true;
                });
            }


        }

        function rescaleTimeline() {
            const main = wrap.querySelector('.pp-cal-main');
            const scaleT = wrap.querySelector('#ppCalScale');
            const scaleB = wrap.querySelector('#ppCalScaleBottom');
            const rowsBox = wrap.querySelector('#ppCalRows');

            let A = calState.canvasStartMs;
            const msPerPx = calState.msPerPx;
            if (!Number.isFinite(A) || !msPerPx) return;

            const gridMs = calState.gridMs || pickGridMs(msPerPx);
            const cellW = gridMs / msPerPx;

            const totalW = Math.ceil((calState.canvasEndMs - A) / msPerPx);

            // 1) Полотно рядов — широкое (для горизонтального скролла) + шаг фон-сетки
            rowsBox.style.width = totalW + 'px';
            rowsBox.style.setProperty('--pp-dayw', cellW + 'px');

            // 2) Обе шкалы шириной вьюпорта; содержимое отрисовываем «по виду»
            const vw = main?.clientWidth || 0;
            if (scaleT) scaleT.style.width = '';
            if (scaleB) scaleB.style.width = '';

            calState.gridMs = gridMs;

            // 3) Перестроить подписи только для видимой области

            const makeScales = () => {

                // [ЯКОРЬ JS-1] полная отрисовка подписей шкалы (без виртуализации)
                function buildScale(scaleEl, A, B, gMs, cellW, main, mode = 'minor') {
                    if (!scaleEl) return 0;
                    scaleEl.textContent = '';
                    const ticks = Math.ceil((B - A) / gMs) + 1;
                    for (let i = 0; i < ticks; i++) {
                        const t = A + i * gMs;
                        const div = document.createElement('div');
                        div.className = 'pp-cal-tick';
                        div.style.width = cellW + 'px';
                        div.style.minWidth = cellW + 'px';
                        div.style.maxWidth = cellW + 'px';

                        if (mode === 'major') {
                            const d = new Date(t);
                            const pad = n => String(n).padStart(2, '0');
                            const fullDate = `${pad(d.getUTCDate())} ${d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })}\n${d.getUTCFullYear()}`;
                            div.textContent = fullDate;
                        } else {
                            div.textContent = fmtTickMsByGrid(t, gMs); // как у тебя
                        }
                        scaleEl.appendChild(div);
                    }
                    return ticks;
                }


                const t = buildScale(scaleT, A, calState.canvasEndMs, gridMs, cellW, main, 'major');
                calState.ticks = t;
                buildScale(scaleB, A, calState.canvasEndMs, gridMs, cellW, main, 'minor');
            };


            // if (calState._onScroll && mainEl) {
            //     mainEl.removeEventListener('scroll', calState._onScroll);
            // }
            // let scaleRaf = 0;
            // calState._onScroll = function onScroll() {
            //     if (scaleRaf) return;
            //     scaleRaf = requestAnimationFrame(() => {
            //         const off = -(mainEl.scrollLeft % cellW);
            //         mainEl.style.setProperty('--pp-grid-off', off + 'px');
            //         scaleRaf = 0;
            //     });
            // };
            // mainEl?.addEventListener('scroll', calState._onScroll);

            // // [ANCHOR: R1-RESIZE] пересчёт ширины и перерисовка шкал при изменении контейнера
            // (() => {
            //     if (!mainEl) return;
            //     const ro = new ResizeObserver(() => {
            //         const w = mainEl.clientWidth || 0;
            //         if (w) {
            //             scaleTop.style.width = w + 'px';
            //             if (scaleBottom) scaleBottom.style.width = w + 'px';
            //             // перерисовать подписи в новых границах
            //             makeScales();
            //             // обновить смещение тайловой сетки
            //             const off = -(mainEl.scrollLeft % cellW);
            //             mainEl.style.setProperty('--pp-grid-off', off + 'px');
            //         }
            //     });
            //     ro.observe(mainEl);
            // })();


            // первичная отрисовка после пересчёта
            makeScales();

            // [C3 EXTRA] моментально выровнять фон-сетку (чтобы не ждать первого скролла)
            const offNow = -(main.scrollLeft % cellW);
            main.style.setProperty('--pp-grid-off', offNow + 'px');

            // [C3 EXTRA] «ребейз» окна времени, если полотно слишком широкое
            (function maybeRebase() {
                const vw = main.clientWidth || 0;
                const vwMs = vw * msPerPx;
                const curW = calState.canvasEndMs - calState.canvasStartMs;
                const desiredW = Math.max(1, vwMs * 6);        // держим ширину ~6 экранов

                if (curW > desiredW * 1.25) {                  // гистерезис, чтобы не дёргалось
                    // сохранить мировую позицию (левый край и центр)
                    const worldLeftMs = calState.canvasStartMs + main.scrollLeft * msPerPx;
                    const worldCenter = worldLeftMs + vwMs / 2;

                    // новый диапазон вокруг центра
                    const newA = worldCenter - desiredW / 2;
                    const newB = worldCenter + desiredW / 2;

                    // обновляем границы полотна и локальный A
                    calState.canvasStartMs = A = newA;
                    calState.canvasEndMs = newB;

                    // пересчитать ширину полотна
                    const totalW2 = Math.ceil((newB - newA) / msPerPx) + vw;
                    rowsBox.style.width = totalW2 + 'px';

                    // перерисовать подписи под новый A/B
                    makeScales();

                    // восстановить прежнюю мировую позицию экрана
                    const newLeftPx = (worldLeftMs - newA) / msPerPx;
                    const maxLeft = Math.max(0, main.scrollWidth - main.clientWidth);
                    main.scrollLeft = Math.max(0, Math.min(newLeftPx, maxLeft));
                }
            })();


            // // [PERF] обновляем только то, что попадает в окно видимости (+1 экран запаса)
            // const viewLeft = main.scrollLeft;
            // const viewRight = viewLeft + main.clientWidth;
            // const marginPx = main.clientWidth; // один экран запаса с каждой стороны

            // const minTs = A + Math.max(0, viewLeft - marginPx) * msPerPx;
            // const maxTs = A + (viewRight + marginPx) * msPerPx;

            // const updIfVisible = el => {
            //     const a = +el.dataset.a, b = +el.dataset.b;
            //     if (!Number.isFinite(a) || !Number.isFinite(b)) return;
            //     if (b < minTs || a > maxTs) return; // далеко вне экрана — пропускаем
            //     el.style.left = ((a - A) / msPerPx) + 'px';
            //     el.style.width = Math.max(1, (b - a) / msPerPx) + 'px';
            // };

            // rowsBox.querySelectorAll('.pp-cal-bar, .pp-cal-overlap').forEach(updIfVisible);

            // [PERF] обновляем только то, что попадает в окно видимости (+1.5 экрана запаса)
            const viewLeft = main.scrollLeft;
            const viewRight = viewLeft + main.clientWidth;
            const marginPx = Math.round(main.clientWidth * 1.5); // было 1 экран

            const minTs = A + Math.max(0, viewLeft - marginPx) * msPerPx;
            const maxTs = A + (viewRight + marginPx) * msPerPx;

            const updIfVisible = el => {
                const a = +el.dataset.a, b = +el.dataset.b;
                if (!Number.isFinite(a) || !Number.isFinite(b)) return;
                if (b < minTs || a > maxTs) return;
                el.style.left = ((a - A) / msPerPx) + 'px';
                el.style.width = Math.max(1, (b - a) / msPerPx) + 'px';
            };

            rowsBox.querySelectorAll('.pp-cal-bar, .pp-cal-overlap').forEach(updIfVisible);

        }


        function wireCalendarUI() {


            wrap.querySelector('#ppCalRange')?.addEventListener('click', (e) => {
                const b = e.target.closest('.pp-chip[data-unit]');
                if (!b) return;

                // запомним центр текущего окна как anchor
                const main = wrap.querySelector('.pp-cal-main');
                if (main && Number.isFinite(calState.canvasStartMs)) {
                    const pxCenter = main.scrollLeft + main.clientWidth / 2;
                    calState.anchorMs = calState.canvasStartMs + pxCenter * calState.msPerPx;
                }

                // map unit → view
                const unit = b.dataset.unit; // 'h' | 'd' | 'w' | 'm'
                calState.view = (unit === 'm') ? 'month' : (unit === 'w' ? 'week' : 'day');
                calState.unit = unit;              // [ANCHOR: R2] держим подсветку в синхроне
                updateUnitChips();

                renderCalendar(); // пересобираем диапазон и сетку
            });


            const mainEl = () => wrap.querySelector('.pp-cal-main');


            wrap.querySelector('#ppCalPrev')?.addEventListener('click', () => {
                const [A, B] = computeRange(calState.view, calState.anchorMs);
                calState.anchorMs = A - 1; // шаг на «один экран» назад
                renderCalendar();
            });
            wrap.querySelector('#ppCalNext')?.addEventListener('click', () => {
                const [A, B] = computeRange(calState.view, calState.anchorMs);
                calState.anchorMs = B + 1; // шаг на «один экран» вперёд
                renderCalendar();
            });


            // wireCalendarUI()

            // Кнопка Today в тулбаре — центрируем «сейчас» (UTC) строго по центру
            const todayBtn = wrap.querySelector('.tl-toolbar [data-nav="today"]');
            todayBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                const main = wrap.querySelector('.pp-cal-main');
                if (!main || !Number.isFinite(calState.canvasStartMs) || !calState.msPerPx) return;

                const xNow = (Date.now() - calState.canvasStartMs) / (calState.msPerPx || 1);
                const desired = Math.round(xNow - main.clientWidth / 2);
                const maxScroll = Math.max(0, main.scrollWidth - main.clientWidth);
                main.scrollLeft = Math.max(0, Math.min(desired, maxScroll));

                const cellW = (calState.gridMs || 1) / (calState.msPerPx || 1);
                const off = -(main.scrollLeft % cellW);
                main.style.setProperty('--pp-grid-off', off + 'px');
            });





            // drag-to-scroll по полотну
            const main = wrap.querySelector('.pp-cal-main');
            let isDown = false, startX = 0, startLeft = 0;

            main?.addEventListener('mousedown', (e) => {
                isDown = true;
                startX = e.clientX;
                startLeft = main.scrollLeft;
                main.style.cursor = 'grabbing';
                e.preventDefault();
            });
            window.addEventListener('mouseup', () => { isDown = false; main && (main.style.cursor = 'default'); });
            window.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                const dx = e.clientX - startX;
                main.scrollLeft = startLeft + dx;
            });

            // touch (мобильный свайп)
            let tStartX = 0, tStartLeft = 0;
            main?.addEventListener('touchstart', (e) => {
                const t = e.touches[0];
                tStartX = t.clientX;
                tStartLeft = main.scrollLeft;
            }, { passive: false });

            main?.addEventListener('touchmove', (e) => {
                // не позволяем вертикальной прокрутке страницы «съедать» свайп по горизонтали
                e.preventDefault();
                const t = e.touches[0];
                const dx = t.clientX - tStartX;
                main.scrollLeft = tStartLeft - dx;
            }, { passive: false });


            // wheel (трекпад/мышь): горизонтальная прокрутка с плавностью
            // — когда курсор над .pp-cal-main, вертикальные импульсы превращаем в горизонтальные
            (function () {
                const main = wrap.querySelector('.pp-cal-main');
                if (!main) return;

                // лёгкая инерция через requestAnimationFrame
                let raf = 0, vx = 0;
                let zoomRaf = 0;
                const friction = 0.9;           // коэффициент затухания
                const step = () => {
                    main.scrollLeft += vx;
                    vx *= friction;
                    if (Math.abs(vx) > 0.5) raf = requestAnimationFrame(step);
                    else { raf = 0; vx = 0; }
                };


                main.addEventListener('wheel', (e) => {
                    // Zoom (Ctrl+wheel) — как было
                    if (e.ctrlKey) {
                        // Зум отключён — удерживаем только горизонтальный скролл
                        e.preventDefault();
                        return;
                    }

                    // === Горизонтальная прокрутка с «превращением» вертикальной ===
                    // Если пользователь двигает вертикально (частый кейс на тачпадах),
                    // используем deltaY как горизонтальный сигнал.
                    let horiz = e.deltaX;
                    const absX = Math.abs(e.deltaX);
                    const absY = Math.abs(e.deltaY);

                    // Если явная горизонталь слабее вертикали — считаем, что жест вертикальный и «кладём» его в горизонталь
                    if (absY > absX) {
                        // инвертируем ось: жест вниз = вправо, жест вверх = влево (интуитивно для ленты времени)
                        horiz = e.deltaY;
                    }

                    // Также поддержим «старую школу»: Shift+wheel = горизонталь
                    if (absX === 0 && e.shiftKey) horiz = e.deltaY;

                    // Нечувствительность к микродрожанию, но без «залипаний»
                    if (Math.abs(horiz) < 0.5) return;

                    // Канва уже шире вьюпорта — крутим
                    if (main.scrollWidth > main.clientWidth) {
                        e.preventDefault();                 // не отдаём жест браузеру
                        const unit = (e.deltaMode === 1)    // line
                            ? 16
                            : (e.deltaMode === 2            // page
                                ? main.clientWidth
                                : 1);                        // pixel
                        vx += horiz * unit;                  // инерция из существующего кода
                        if (!raf) raf = requestAnimationFrame(step);
                    } else {
                        // На всякий случай защищаемся на краях, чтобы не ловить back/forward у браузера
                        e.preventDefault();
                    }
                }, { passive: false });


                // чтобы колесо не уводило страницу при достижении краёв
                main.style.overscrollBehaviorX = 'contain'; // горизонталь не «прокидываем» наружу
                main.style.overscrollBehaviorY = 'auto';
            })();

            // === Jump to… (UTC) ===
            (function () {
                const main = wrap.querySelector('.pp-cal-main');
                const btn = wrap.querySelector('#ppJumpBtn');
                const panel = wrap.querySelector('#ppJumpPanel');


                const dtBtn = wrap.querySelector('#ppDtBtn');
                const dtLabel = wrap.querySelector('#ppDtLabel');
                const dtPop = wrap.querySelector('#ppDtPicker');
                const inpD = wrap.querySelector('#ppJumpDate');
                const inpT = wrap.querySelector('#ppJumpTime');

                const unitSel = wrap.querySelector('#ppJumpUnit');
                const go = wrap.querySelector('#ppJumpGo');
                const close = wrap.querySelector('#ppJumpClose');
                const acc = wrap.querySelector('#ppDtAccept');
                const cancel = wrap.querySelector('#ppDtCancel');

                // держим всё закрытым до явного клика
                if (panel) panel.hidden = true;
                if (dtPop) dtPop.hidden = true;

                if (!btn || !panel) return;

                function setDefaultsUTC() {
                    const now = new Date();
                    const yyyy = now.getUTCFullYear();
                    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
                    const dd = String(now.getUTCDate()).padStart(2, '0');
                    const hh = String(now.getUTCHours()).padStart(2, '0');
                    const mi = String(now.getUTCMinutes()).padStart(2, '0');

                    if (inpD) inpD.value = `${yyyy}-${mm}-${dd}`;
                    if (inpT) inpT.value = `${hh}:${mi}`;
                    if (dtLabel) dtLabel.textContent = `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
                }

                function openPanel() {
                    setDefaultsUTC();
                    panel.hidden = false;

                    // клик вне панели — закрыть её
                    const onDoc = (e) => {
                        if (!panel.contains(e.target) && e.target !== btn) {
                            panel.hidden = true;
                            document.removeEventListener('mousedown', onDoc);
                            dtPop && (dtPop.hidden = true);
                        }
                    };
                    document.addEventListener('mousedown', onDoc);
                }

                // Тоггл панели
                btn.addEventListener('click', () => {
                    if (panel.hidden) openPanel(); else panel.hidden = true;
                });
                close?.addEventListener('click', () => { panel.hidden = true; dtPop && (dtPop.hidden = true); });

                // Тоггл «Select date» попапа (дата+время)
                dtBtn?.addEventListener('click', () => {
                    if (!dtPop) return;
                    if (dtPop.hidden) { setDefaultsUTC(); dtPop.hidden = false; }
                    else dtPop.hidden = true;
                });

                // Accept/Cancel внутри попапа даты
                acc?.addEventListener('click', () => {
                    if (inpD && inpT && dtLabel) {
                        const [y, m, d] = inpD.value.split('-');
                        const [hh, mi] = inpT.value.split(':');
                        dtLabel.textContent = `${d}.${m}.${y} ${hh}:${mi}`;
                    }
                    dtPop && (dtPop.hidden = true);
                });
                cancel?.addEventListener('click', () => { dtPop && (dtPop.hidden = true); });

                // Перейти к выбранной дате
                go?.addEventListener('click', () => {
                    if (!main || !inpD || !inpT) return;

                    // масштаб (если задан)
                    const unit = unitSel?.value || '';
                    if (unit) {
                        const UNIT_MS = { h: 3600e3, d: 86400e3, w: 7 * 86400e3, m: 30 * 86400e3 };
                        const PX_PER_UNIT = { h: 48, d: 60, w: 120, m: 160 };
                        calState.unit = unit;
                        calState.msPerPx = UNIT_MS[unit] / PX_PER_UNIT[unit];
                        renderCalendar();
                    }

                    // парсим UTC: YYYY-MM-DD + HH:mm → ...Z
                    const target = new Date(`${inpD.value}T${(inpT.value || '00:00')}:00Z`);
                    if (!Number.isFinite(+target)) return;

                    if (Number.isFinite(calState.canvasStartMs) && calState.msPerPx) {
                        const left = Math.max(
                            0,
                            (target.getTime() - calState.canvasStartMs) / calState.msPerPx - (main.clientWidth / 2)
                        );
                        main.scrollTo({ left, behavior: 'smooth' });
                    }
                    panel.hidden = true;
                    dtPop && (dtPop.hidden = true);
                });
            })();
        }

        // инициализация календаря один раз при создании карточки

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
        let stateFilter = new Set();
        const allTypes = Array.from(new Set(items.map(i => i.type).filter(Boolean))).sort();
        let typeTextFilter = { rule: 'contains', query: '' }; // текстовое правило для Type
        let startFilter = { rule: 'after', from: '', to: '' };
        let endFilter = { rule: 'before', from: '', to: '' };
        // момент времени, по которому фильтруем «активные сейчас» события (UTC ms) — null = фильтра нет
        let activeTimeFilterTs = null;

        let viewRows = [];
        let allFilteredSorted = [];        // полный набор после фильтра/сортировки
        let pageSize = 25;
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

        // Глобальная кнопка сброса фильтров
        const resetAllBtn = wrap.querySelector('#ppResetBtn');


        function resetAllTableFilters() {
            // 1) State
            try {
                stateFilter.clear();
                wrap.querySelectorAll('#ppStateList input[type="checkbox"]').forEach(cb => cb.checked = false);
            } catch { }

            // 2) Name
            nameFilter = { rule: 'contains', query: '' };
            const nRuleBtn = wrap.querySelector('#ppNameRuleBtn');
            const nQuery = wrap.querySelector('#ppNameQuery');
            if (nRuleBtn) { nRuleBtn.dataset.val = 'contains'; nRuleBtn.querySelector('.txt').textContent = 'Contains'; }
            if (nQuery) nQuery.value = '';

            // 3) Type (чекбоксы + текстовое правило)
            typeFilter = new Set();
            typeTextFilter = { rule: 'contains', query: '' };
            const tRuleBtn = wrap.querySelector('#ppTypeRuleBtn');
            const tQuery = wrap.querySelector('#ppTypeQuery');
            const tSearch = wrap.querySelector('#ppTypeSearch');
            const tList = wrap.querySelector('#ppTypeList');
            if (tRuleBtn) { tRuleBtn.dataset.val = 'contains'; tRuleBtn.querySelector('.txt').textContent = 'Contains'; }
            if (tQuery) tQuery.value = '';
            if (tSearch) tSearch.value = '';
            if (tList) {
                // Перерисуем список типов (все чекбоксы сняты)
                const arr = allTypes;
                tList.innerHTML = arr.map(t => `<label class="pp-type-opt"><input type="checkbox" value="${t}"/> <span>${t}</span></label>`).join('') || '<div class="muted small">No types</div>';
            }

            // 4) Dates (Start/End)
            startFilter = { rule: 'between', from: '', to: '' };
            endFilter = { rule: 'between', from: '', to: '' };

            const sRule = wrap.querySelector('#ppStartRuleBtn');
            const sFrom = wrap.querySelector('#ppStartFrom');
            const sTo = wrap.querySelector('#ppStartTo');
            if (sRule) { sRule.dataset.val = 'between'; sRule.querySelector('.txt').textContent = 'Between'; }
            if (sFrom) sFrom.value = '';
            if (sTo) sTo.value = '';

            const eRule = wrap.querySelector('#ppEndRuleBtn');
            const eFrom = wrap.querySelector('#ppEndFrom');
            const eTo = wrap.querySelector('#ppEndTo');

            // EndDate дефолт: Before (Between больше нет)
            if (eRule) { eRule.dataset.val = 'before'; eRule.querySelector('.txt').textContent = 'Before'; }
            if (eFrom) eFrom.value = '';
            if (eTo) eTo.value = '';


            // 4.5) Снять фильтр «Active at picked time»
            activeTimeFilterTs = null;

            // 5) Закрыть все открытые попапы и меню правил
            wrap.querySelectorAll('.pp-filter-pop, .pp-select-menu').forEach(p => p.hidden = true);

            // 6) Пагинация — на первую страницу и перерисовать
            page = 1;
            renderRows();
        }


        resetAllBtn?.addEventListener('click', resetAllTableFilters);


        rowsSel.addEventListener('change', () => {
            pageSize = Number(rowsSel.value);
            page = 1;
            renderRows();
        });
        btnFirst.addEventListener('click', () => { page = 1; renderRows(); });
        btnPrev.addEventListener('click', () => { page = Math.max(1, page - 1); renderRows(); });
        btnNext.addEventListener('click', () => { page = Math.min(Math.ceil(allFilteredSorted.length / pageSize) || 1, page + 1); renderRows(); });
        btnLast.addEventListener('click', () => { page = Math.max(1, Math.ceil(allFilteredSorted.length / pageSize) || 1); renderRows(); });


        // принять запрос на применение фильтра по имени из тултипа календаря
        // принять запрос на применение фильтра по имени из тултипа календаря
        document.addEventListener('pp:applyNameFilter', (ev) => {
            const title = (ev.detail && ev.detail.title) || '';
            // 1) точное совпадение по имени
            nameFilter = { rule: 'equals', query: title.trim() };
            page = 1;
            renderRows(); // пересчитать viewRows и перерисовать таблицу

            // 2) найти индекс строки на текущей странице
            const idx = viewRows.findIndex(r => (r.name || '').toLowerCase() === title.toLowerCase());

            if (idx >= 0) {
                // 3) открыть правую панель по найденной строке
                showDetail(idx);
                wrap.classList.add('info-open');
                syncRowHeightToOpen?.();

                // 4) подсветить строку и прокрутить к ней
                const rowEl = bodyEl.querySelector(`.pp-t-row[data-idx="${idx}"]`);
                if (rowEl) {
                    bodyEl.querySelectorAll('.pp-t-row.selected').forEach(r => r.classList.remove('selected'));
                    rowEl.classList.add('selected');
                    rowEl.scrollIntoView({ block: 'nearest' });
                }
            }

            // 5) прокрутить область так, чтобы таблица была в центре экрана
            document.querySelector('#ppLoTable')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        // принять запрос на фильтрацию таблицы по моменту времени (кнопка над синей линией Picked)
        document.addEventListener('pp:filterByTime', (ev) => {
            const ts = ev.detail && Number(ev.detail.ts);
            if (!Number.isFinite(ts)) return;

            activeTimeFilterTs = ts;
            page = 1;
            renderRows();

            // прокручиваем страницу к таблице, чтобы пользователь сразу видел результат
            document.querySelector('#ppLoTable')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });



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

            // фильтр по состоянию State
            if (stateFilter.size) {
                rows = rows.filter(r => stateFilter.has(r.displayState));
            }

            // фильтр по типам (чекбоксы)
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

            // фильтр «активные в выбранный момент времени» (по startTS/endTS)
            if (Number.isFinite(activeTimeFilterTs)) {
                const ts = activeTimeFilterTs;
                rows = rows.filter(r => {
                    if (Number.isFinite(r.startTS) && Number.isFinite(r.endTS)) {
                        return r.startTS <= ts && ts <= r.endTS;
                    }
                    // если по какой-то причине нет сырого TS — не режем такие строки
                    return true;
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
                : '<div class="muted">None</div>';

            // Theme
            let themeHtml = (lo.themeId ? `<code>${lo.themeId}</code>` : 'None');

            // Assets (accordion like Promotions): single button "Show assets"
            let assetsKV = '';
            if (lo.themeAssets && (lo.themeAssets.android || lo.themeAssets.ios)) {
                const andSafe = lo.themeAssets.android ? escapeHtml(lo.themeAssets.android) : '';
                const iosSafe = lo.themeAssets.ios ? escapeHtml(lo.themeAssets.ios) : '';

                assetsKV = `
    <div class="pp-kv pp-kv-assets">
      <span class="pp-k">Assets</span>

      <button class="pp-asset-toggle-row" type="button" data-asset-panel="ppAssetsPanel" aria-expanded="false">
        <span>Show assets</span>
        <span class="pp-asset-toggle-chev" aria-hidden="true">▸</span>
      </button>

      <div id="ppAssetsPanel" class="pp-asset-panel" hidden>
        <div class="pp-assets2">
          ${lo.themeAssets.android ? `
          <div class="pp-asset2">
            <div class="pp-asset2-lines">
              <div class="pp-asset2-line">
                <span class="pp-asset2-k">and:</span>
                <code class="pp-asset2-code">${andSafe}</code>
              </div>
            </div>
          </div>` : ''}

          ${lo.themeAssets.ios ? `
          <div class="pp-asset2">
            <div class="pp-asset2-lines">
              <div class="pp-asset2-line">
                <span class="pp-asset2-k">ios:</span>
                <code class="pp-asset2-code">${iosSafe}</code>
              </div>
            </div>
          </div>` : ''}
        </div>
      </div>
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
                : '<div class="muted">None</div>';

            // ---- ШАПКА с кнопкой Copy (как в календарном тултипе) ----

            // ---- ШАПКА с кнопкой Copy (как в календарном тултипе) ----

            // ---- Raw JSON (for Show full LiveEvent JSON) ----
            const rawObj = lo?.raw ?? lo;
            const rawText = JSON.stringify(rawObj, null, 2);
            const rawPretty = escapeHtml(rawText);

            detEl.innerHTML = `

           
    

  <div class="pp-kvs">
    <!-- Name: кнопка теперь внутри значения и стоит справа от текста -->
    <div class="pp-kv pp-kv-name">
      <span class="pp-k">Name</span>
      <span class="pp-v">
        <span class="pp-name-text">${lo.name}</span>
        <button id="ppCopyName" class="pp-ico" type="button" data-hint="Copy to clipboard" aria-label="Copy to clipboard">
          <!-- та же иконка, что в календарном тултипе -->
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 9h11v11H9V9zm-5 5V4h11" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        </button>
      </span>
    </div>

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


            // [SEGMENTS] вставляем KV-блок «Сегмент»
            (function renderSegmentsKV() {
                const kvs = detEl.querySelector('.pp-kvs');
                if (!kvs || !lo.segments || !lo.segments.length) return;

                const segKV = document.createElement('div');
                segKV.className = 'pp-kv';
                const many = lo.segments.length > 1;

                const segListId = 'ppSegList';
                const oneSeg = !many ? `<code>${lo.segments[0]}</code>` : `
      <button id="ppSegShowBtn" class="pp-link" type="button">Show all</button>
      <div id="${segListId}" class="pp-seg-list" hidden>
       
      ${lo.segments.map((s, i) => {
                    const key = String(s).trim();
                    const rawExts = (lo.externalsBySegment && lo.externalsBySegment[key]) ? lo.externalsBySegment[key] : [];
                    const exts = Array.isArray(rawExts) ? rawExts.map(e => String(e).trim()).filter(Boolean) : [];
                    const extId = `ppExtList-${i}`;
                    const extBtn = exts.length
                        ? `<button class="pp-link small pp-ext-tgl" data-ext="${extId}" type="button">Show External Segment</button>`
                        : '';
                    const extList = exts.length
                        ? `<div id="${extId}" class="pp-seg-ext" hidden>${exts.map(e => `<div class="row"><code>${e}</code></div>`).join('')}</div>`
                        : '';
                    return `<div class="seg-item"><code>${key}</code> ${extBtn}${extList}</div>`;
                }).join('')}

      </div>`;

                segKV.innerHTML = `
      <span class="pp-k muted">Segment</span>
      
      <span class="pp-v">${many ? oneSeg : (() => {
                        const s = lo.segments[0];
                        const key = String(s).trim();
                        const rawExts = (lo.externalsBySegment && lo.externalsBySegment[key]) ? lo.externalsBySegment[key] : [];
                        const exts = Array.isArray(rawExts) ? rawExts.map(e => String(e).trim()).filter(Boolean) : [];
                        if (!exts.length) return `<code>${key}</code>`;
                        const extId = 'ppExtSingle';
                        return `<code>${key}</code> <button class="pp-link small pp-ext-tgl" data-ext="${extId}" type="button">Show External Segment</button>
      <div id="${extId}" class="pp-seg-ext" hidden>${exts.map(e => `<div class="row"><code>${e}</code></div>`).join('')}</div>`;
                    })()}</span>

    `;
                const rawKV = kvs.querySelector('.pp-kv-raw');
                if (rawKV) kvs.insertBefore(segKV, rawKV);
                else kvs.appendChild(segKV);


                const btnAll = detEl.querySelector('#ppSegShowBtn');
                const listEl = detEl.querySelector('#' + segListId);
                if (btnAll && listEl) {
                    btnAll.addEventListener('click', () => {
                        const hidden = listEl.hasAttribute('hidden');
                        if (hidden) { listEl.removeAttribute('hidden'); btnAll.textContent = 'Hide'; }
                        else { listEl.setAttribute('hidden', ''); btnAll.textContent = 'Show all'; }
                    });
                }
                detEl.addEventListener('click', (e) => {
                    const tgl = e.target.closest('.pp-ext-tgl');
                    if (!tgl) return;
                    const id = tgl.dataset.ext;
                    const box = id && detEl.querySelector('#' + CSS.escape(id));
                    if (!box) return;
                    const hidden = box.hasAttribute('hidden');
                    if (hidden) { box.removeAttribute('hidden'); tgl.textContent = 'Hide External Segment'; }
                    else { box.setAttribute('hidden', ''); tgl.textContent = 'Show External Segment'; }
                });
            })();

            // [SEGMENTS] вставляем KV-блок «Сегмент»
            (function renderSegmentsKV() {
                const kvs = detEl.querySelector('.pp-kvs');
                if (!kvs || !lo.segments || !lo.segments.length) return;

                const segKV = document.createElement('div');
                segKV.className = 'pp-kv';
                const many = lo.segments.length > 1;

                const segListId = 'ppSegList';
                const oneSeg = !many ? `<code>${lo.segments[0]}</code>` : `
      <button id="ppSegShowBtn" class="pp-link" type="button">Show all</button>
      <div id="${segListId}" class="pp-seg-list" hidden>
       
      ${lo.segments.map((s, i) => {
                    const key = String(s).trim();
                    const rawExts = (lo.externalsBySegment && lo.externalsBySegment[key]) ? lo.externalsBySegment[key] : [];
                    const exts = Array.isArray(rawExts) ? rawExts.map(e => String(e).trim()).filter(Boolean) : [];
                    const extId = `ppExtList-${i}`;
                    const extBtn = exts.length
                        ? `<button class="pp-link small pp-ext-tgl" data-ext="${extId}" type="button">Show External Segment</button>`
                        : '';
                    const extList = exts.length
                        ? `<div id="${extId}" class="pp-seg-ext" hidden>${exts.map(e => `<div class="row"><code>${e}</code></div>`).join('')}</div>`
                        : '';
                    return `<div class="seg-item"><code>${key}</code> ${extBtn}${extList}</div>`;
                }).join('')}

      </div>`;

                segKV.innerHTML = `
      <span class="pp-k muted">Segment</span>
      
      <span class="pp-v">${many ? oneSeg : (() => {
                        const s = lo.segments[0];
                        const key = String(s).trim();
                        const rawExts = (lo.externalsBySegment && lo.externalsBySegment[key]) ? lo.externalsBySegment[key] : [];
                        const exts = Array.isArray(rawExts) ? rawExts.map(e => String(e).trim()).filter(Boolean) : [];
                        if (!exts.length) return `<code>${key}</code>`;
                        const extId = 'ppExtSingle';
                        return `<code>${key}</code> <button class="pp-link small pp-ext-tgl" data-ext="${extId}" type="button">Show External Segment</button>
      <div id="${extId}" class="pp-seg-ext" hidden>${exts.map(e => `<div class="row"><code>${e}</code></div>`).join('')}</div>`;
                    })()}</span>

    `;
                kvs.appendChild(segKV);

                const btnAll = detEl.querySelector('#ppSegShowBtn');
                const listEl = detEl.querySelector('#' + segListId);
                if (btnAll && listEl) {
                    btnAll.addEventListener('click', () => {
                        const hidden = listEl.hasAttribute('hidden');
                        if (hidden) { listEl.removeAttribute('hidden'); btnAll.textContent = 'Hide'; }
                        else { listEl.setAttribute('hidden', ''); btnAll.textContent = 'Show all'; }
                    });
                }
                detEl.addEventListener('click', (e) => {
                    const tgl = e.target.closest('.pp-ext-tgl');
                    if (!tgl) return;
                    const id = tgl.dataset.ext;
                    const box = id && detEl.querySelector('#' + CSS.escape(id));
                    if (!box) return;
                    const hidden = box.hasAttribute('hidden');
                    if (hidden) { box.removeAttribute('hidden'); tgl.textContent = 'Hide External Segment'; }
                    else { box.setAttribute('hidden', ''); tgl.textContent = 'Show External Segment'; }
                });
            })();

            // [RAW JSON] always LAST in the info panel (after Segments)
            (function renderRawJsonKV() {
                const kvs = detEl.querySelector('.pp-kvs');
                if (!kvs) return;

                const rawKV = document.createElement('div');
                rawKV.className = 'pp-kv pp-kv-raw pp-kv-raw-only';

                rawKV.innerHTML = `
      <span class="pp-v">
        <details class="pp-raw-details">
          <summary class="pp-raw-sum">
            <span class="pp-raw-title">
              <span class="pp-raw-text">Show full LiveOps event JSON</span>
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
    `;

                kvs.appendChild(rawKV);
            })();


            // Assets accordion toggle (single "Show assets")
            const assetsBtn = detEl.querySelector('.pp-asset-toggle-row[data-asset-panel]');
            if (assetsBtn) {
                const panelId = assetsBtn.getAttribute('data-asset-panel');
                const panel = panelId ? detEl.querySelector('#' + panelId) : null;
                const chev = assetsBtn.querySelector('.pp-asset-toggle-chev');

                assetsBtn.addEventListener('click', () => {
                    if (!panel) return;

                    const hidden = panel.hasAttribute('hidden');
                    if (hidden) {
                        panel.removeAttribute('hidden');
                        assetsBtn.setAttribute('aria-expanded', 'true');
                        if (chev) chev.textContent = '▾';
                    } else {
                        panel.setAttribute('hidden', '');
                        assetsBtn.setAttribute('aria-expanded', 'false');
                        if (chev) chev.textContent = '▸';
                    }
                });
            }


            // Copy full JSON (only when clicking the copy icon in Raw block)
            const rawCopyBtn = detEl.querySelector('[data-copy-raw="1"]');
            rawCopyBtn?.addEventListener('click', async (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                try {
                    await navigator.clipboard.writeText(rawText);
                    const prev = rawCopyBtn.getAttribute('data-hint');
                    rawCopyBtn.setAttribute('data-hint', 'Copied!');
                    setTimeout(() => rawCopyBtn.setAttribute('data-hint', prev || 'Copy JSON'), 900);
                } catch {
                    const ta = document.createElement('textarea');
                    ta.value = rawText;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                }
            });


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
            // Контролы правила могут отсутствовать в разметке Type-попапа.
            const rule = typeRuleBtn?.dataset?.val || 'contains';
            const needText = rule !== 'blank';

            if (typeQueryInput) {
                typeQueryInput.disabled = !needText;
                if (!needText) typeQueryInput.value = '';
            }

            // Кнопку подтверждения не блокируем: пользователь всегда может применить чекбоксы.
            if (typeApplyBtn) typeApplyBtn.disabled = false;
        }

        // открыть/закрыть и инициализировать черновики
        typeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = typePop.hidden;

            // 1) закрыть меню правил других фильтров и сами попапы
            wrap.querySelector('#ppNameRuleMenu')?.setAttribute('hidden', '');
            wrap.querySelector('#ppTypeRuleMenu')?.setAttribute('hidden', '');
            wrap.querySelector('#ppNamePop')?.setAttribute('hidden', '');
            wrap.querySelector('#ppStatePop')?.setAttribute('hidden', '');
            wrap.querySelector('#ppStartPop')?.setAttribute('hidden', '');
            wrap.querySelector('#ppEndPop')?.setAttribute('hidden', '');

            // 2) открыть/закрыть текущий
            typePop.hidden = !typePop.hidden;

            // 3) при открытии — подтянуть текущее «боевое» состояние в черновик и отрисовать
            if (willOpen) {
                typeDraft = new Set(typeFilter);
                // безопасная инициализация черновика текстового правила (может отсутствовать в UI)
                typeTextDraft = (typeTextFilter && typeof typeTextFilter === 'object')
                    ? { rule: typeTextFilter.rule || 'contains', query: typeTextFilter.query || '' }
                    : { rule: 'contains', query: '' };

                if (typeSearch) typeSearch.value = '';
                if (typeQueryInput) typeQueryInput.value = typeTextDraft.query || '';

                if (typeRuleBtn) {
                    typeRuleBtn.dataset.val = typeTextDraft.rule || 'contains';
                    typeRuleBtn.querySelector('.txt').textContent = ({
                        contains: 'Contains',
                        notcontains: 'Not contains',
                        starts: 'Starts with',
                        equals: 'Equals to',
                        blank: 'Blank'
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
        // function wireDateFilter(opts) {
        //     const { btnSel, popSel, ruleBtnSel, ruleMenuSel, fromSel, toSel, resetSel, applySel, get, set } = opts;
        //     const btn = wrap.querySelector(btnSel);
        //     const pop = wrap.querySelector(popSel);
        //     const ruleBtn = wrap.querySelector(ruleBtnSel);
        //     const ruleMenu = wrap.querySelector(ruleMenuSel);
        //     const fromInp = wrap.querySelector(fromSel);
        //     const toInp = wrap.querySelector(toSel);
        //     const resetBtn = wrap.querySelector(resetSel);
        //     const applyBtn = wrap.querySelector(applySel);
        //     const labels = { between: 'Between', before: 'Before', after: 'After' };

        //     function sync() {
        //         const rule = ruleBtn?.dataset.val || 'between';

        //         // 1) показать/спрятать второй инпут
        //         if (toInp) toInp.style.display = (rule === 'between') ? '' : 'none';

        //         // 2) сетка: 2 поля (Between) или 1 поле (Before/After)
        //         const row = ruleBtn ? ruleBtn.closest('.pp-filter-row') : null;
        //         if (row) {
        //             row.style.gridTemplateColumns = (rule === 'between')
        //                 ? '160px 1fr 1fr'
        //                 : '160px 1fr';
        //         }

        //         // 3) ширина поп-апа: по умолчанию 520px; узкий — 360px (через класс)
        //         if (pop) {
        //             if (rule === 'between') pop.classList.remove('single');
        //             else pop.classList.add('single');
        //         }

        //         // 4) состояние кнопки Apply
        //         if (applyBtn) {
        //             const hasA = !!(fromInp?.value);
        //             const hasB = !!(toInp?.value);
        //             applyBtn.disabled = (rule === 'between') ? (!hasA && !hasB) : !hasA;
        //         }
        //     }


        // btn?.addEventListener('click', (e) => {
        //     e.stopPropagation();

        //     // 1) Закрыть ВСЕ прочие попапы и меню правил
        //     wrap.querySelectorAll('.pp-filter-pop').forEach(p => { if (p !== pop) p.setAttribute('hidden', ''); });
        //     wrap.querySelectorAll('.pp-select-menu').forEach(m => m.setAttribute('hidden', ''));

        //     // 2) Тоггл текущего
        //     const willOpen = pop.hidden;
        //     pop.hidden = !pop.hidden;

        //     if (willOpen) {
        //         const cur = (typeof get === 'function') ? get() : { rule: 'between', from: '', to: '' };
        //         if (ruleBtn) {
        //             ruleBtn.dataset.val = cur.rule || 'between';
        //             ruleBtn.querySelector('.txt').textContent = labels[ruleBtn.dataset.val] || 'Between';
        //         }
        //         if (fromInp) fromInp.value = cur.from || '';
        //         if (toInp) toInp.value = cur.to || '';
        //         sync();
        //         fromInp?.focus();
        //     }
        // });


        // ruleBtn?.addEventListener('click', (e) => {
        //     e.stopPropagation();
        //     if (ruleMenu.hidden) openMenuBelow(ruleBtn, ruleMenu);
        //     else ruleMenu.hidden = true;
        // });
        // ruleMenu?.addEventListener('click', (e) => {
        //     const b = e.target.closest('button[data-val]');
        //     if (!b) return;
        //     ruleBtn.dataset.val = b.dataset.val;
        //     ruleBtn.querySelector('.txt').textContent = b.textContent;
        //     ruleMenu.hidden = true;
        //     sync();
        // });

        // fromInp?.addEventListener('input', sync);
        // toInp?.addEventListener('input', sync);

        // [fromInp, toInp].forEach((el) => {
        //     el?.addEventListener('focus', () => { if (ruleMenu) ruleMenu.hidden = true; }, true);
        //     el?.addEventListener('mousedown', () => { if (ruleMenu) ruleMenu.hidden = true; }, true);
        //     el?.addEventListener('click', () => { if (ruleMenu) ruleMenu.hidden = true; }, true);
        // });

        // // на всякий случай — любой клик внутри попапа по input[type="date"]
        // // тоже закрывает меню правил
        // pop?.addEventListener('mousedown', (e) => {
        //     if (e.target?.closest('input[type="date"]')) {
        //         if (ruleMenu) ruleMenu.hidden = true;
        //     }
        // }, true);

        // resetBtn?.addEventListener('click', () => {
        //     set({ rule: 'between', from: '', to: '' });
        //     if (fromInp) fromInp.value = '';
        //     if (toInp) toInp.value = '';
        //     pop.hidden = true;
        //     renderRows();
        // });

        // applyBtn?.addEventListener('click', () => {
        //     set({ rule: ruleBtn.dataset.val, from: fromInp?.value || '', to: toInp?.value || '' });
        //     pop.hidden = true;
        //     renderRows();
        // });

        //     // клик вне — закрыть попап (и меню правил).
        //     // Дополнительно: если кликнули ВНУТРИ попапа по полю даты — лишь прячем меню правил.
        //     document.addEventListener('click', (e) => {
        //         if (!document.body.contains(pop) || pop.hidden) return;

        //         // внутри самого попапа
        //         if (e.target.closest(popSel)) {
        //             // если попали в date-инпут — закрыть только меню правил
        //             if (e.target.closest('input[type="date"]')) {
        //                 if (ruleMenu) ruleMenu.hidden = true;
        //             }
        //             return; // сам попап не закрываем
        //         }

        //         // клик по кнопке открытия — игнор
        //         if (e.target.closest(btnSel)) return;

        //         // вне попапа — закрываем всё
        //         pop.hidden = true;
        //         if (ruleMenu) ruleMenu.hidden = true;
        //     });

        // }

        // ---------- Фильтры дат (Start/End) ----------

        // мини-движок композитного пикера календарь+время
        function buildDateTimePicker(root) {
            if (!root) return null;

            const cal = root.querySelector('.pp-mini-cal');
            const head = cal?.querySelector('.pp-cal-head');
            const title = cal?.querySelector('.pp-cal-title');
            const grid = cal?.querySelector('.pp-cal-grid');

            const colH = root.querySelector('.pp-time-col[data-part="h"]');
            const colM = root.querySelector('.pp-time-col[data-part="m"]');

            // bind: root[data-bind="#hiddenInputId"]
            const getBoundInput = () => {
                const sel = (root.getAttribute('data-bind') || '').trim();
                return sel ? document.querySelector(sel) : null;
            };

            const pad = (n) => String(n).padStart(2, '0');
            const daysIn = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
            const firstW = (y, m) => (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7; // Mon=0

            const now = new Date();
            let curY = now.getUTCFullYear();
            let curM = now.getUTCMonth();
            let selD = now.getUTCDate();
            let selH = now.getUTCHours();
            let selMin = now.getUTCMinutes();

            function writeToInput() {
                const inp = getBoundInput();
                if (!inp) return;

                const nextVal = `${curY}-${pad(curM + 1)}-${pad(selD)} ${pad(selH)}:${pad(selMin)}`;
                inp.value = nextVal;

                // важно: уведомляем слушателей (табличные фильтры синкают видимые поля по этому событию)
                try { inp.dispatchEvent(new Event('input', { bubbles: true })); } catch { }
            }


            function paintCalendar() {
                if (!title || !grid) return;
                title.textContent = new Date(Date.UTC(curY, curM, 1))
                    .toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

                grid.innerHTML = '';
                const blanks = firstW(curY, curM);
                for (let i = 0; i < blanks; i++) {
                    const d = document.createElement('button');
                    d.className = 'pp-cal-day blank';
                    d.disabled = true;
                    grid.appendChild(d);
                }

                const days = daysIn(curY, curM);
                for (let d = 1; d <= days; d++) {
                    const btn = document.createElement('button');
                    btn.className = 'pp-cal-day' + (d === selD ? ' selected' : '');
                    btn.textContent = d;
                    btn.addEventListener('click', () => {
                        selD = d;
                        writeToInput();
                        paintCalendar();
                    });
                    grid.appendChild(btn);
                }
            }

            function buildColumn(colEl, max, getSel, setSel) {
                if (!colEl) return;
                colEl.innerHTML = '';
                for (let v = 0; v <= max; v++) {
                    const b = document.createElement('div');
                    b.className = 'pp-time-item' + (v === getSel() ? ' selected' : '');
                    b.textContent = pad(v);
                    b.addEventListener('click', () => {
                        setSel(v);
                        writeToInput();
                        paintTime();
                    });
                    colEl.appendChild(b);
                }
                colEl.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    const dir = e.deltaY > 0 ? 1 : -1;
                    let nv = getSel() + dir;
                    if (nv < 0) nv = max;
                    if (nv > max) nv = 0;
                    setSel(nv);
                    writeToInput();
                    paintTime();
                }, { passive: false });
            }

            function paintTime() {
                if (!colH || !colM) return;
                colH.querySelectorAll('.pp-time-item').forEach((el, i) => el.classList.toggle('selected', i === selH));
                colM.querySelectorAll('.pp-time-item').forEach((el, i) => el.classList.toggle('selected', i === selMin));

                colH.querySelector('.pp-time-item.selected')?.scrollIntoView({ block: 'center', inline: 'nearest' });
                colM.querySelector('.pp-time-item.selected')?.scrollIntoView({ block: 'center', inline: 'nearest' });
            }

            head?.addEventListener('click', (e) => {
                const nav = e.target.closest('.pp-cal-nav');
                if (!nav) return;
                const dir = Number(nav.dataset.dir) || 0;
                const d = new Date(Date.UTC(curY, curM + dir, 1));
                curY = d.getUTCFullYear();
                curM = d.getUTCMonth();
                selD = Math.min(selD, daysIn(curY, curM));
                writeToInput();
                paintCalendar();
            });

            function setValue(val) {
                const v = String(val || '').trim();
                if (v && /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(v)) {
                    const [dd, tm] = v.split(/\s+/);
                    const [yy, mm, d] = dd.split('-').map(Number);
                    const [hh, mi] = tm.split(':').map(Number);
                    curY = yy; curM = mm - 1; selD = d; selH = hh; selMin = mi;
                }
                paintCalendar();
                paintTime();
            }

            // init
            buildColumn(colH, 23, () => selH, (v) => { selH = v; });
            buildColumn(colM, 59, () => selMin, (v) => { selMin = v; });
            paintCalendar();
            paintTime();

            return { setValue };
        }



        function wireDateFilter(opts) {
            const {
                btnSel, popSel,
                ruleBtnSel, ruleMenuSel,
                dateSel, timeSel,
                fromSel, toSel,
                okSel, cancelSel, resetSel,
                defaultRule = 'after',
                fallbackGet,
                get, set
            } = opts || {};

            const btn = wrap.querySelector(btnSel);
            const pop = wrap.querySelector(popSel);
            if (!btn || !pop) return;

            const ruleBtn = pop.querySelector(ruleBtnSel);
            const ruleMenu = pop.querySelector(ruleMenuSel);

            const dateInp = pop.querySelector(dateSel); // type="date"
            const timeInp = pop.querySelector(timeSel); // type="time"

            const fromInp = pop.querySelector(fromSel);
            const toInp = pop.querySelector(toSel);

            const okBtn = pop.querySelector(okSel);
            const cancelBtn = pop.querySelector(cancelSel);
            const resetBtn = pop.querySelector(resetSel);

            const labels = { after: 'After', before: 'Before' };

            const pad2 = (n) => String(n).padStart(2, '0');

            function nowUTCParts() {
                const d = new Date();
                const yyyy = d.getUTCFullYear();
                const mm = pad2(d.getUTCMonth() + 1);
                const dd = pad2(d.getUTCDate());
                const hh = pad2(d.getUTCHours());
                const mi = pad2(d.getUTCMinutes());
                return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` };
            }

            function splitVal(v) {
                const raw = String(v || '').trim();
                if (!raw) return { date: '', time: '' };
                const [date, time] = raw.split(/\s+/);
                return { date: date || '', time: (time && /^\d{2}:\d{2}$/.test(time)) ? time : '00:00' };
            }

            function buildVal(dateStr, timeStr) {
                const d = String(dateStr || '').trim();
                if (!d) return '';
                const t = String(timeStr || '').trim() || '00:00';
                return `${d} ${t}`;
            }

            function closeAllOtherPops() {
                wrap.querySelectorAll('.pp-filter-pop').forEach(p => { if (p !== pop) p.setAttribute('hidden', ''); });
                wrap.querySelectorAll('.pp-select-menu').forEach(m => m.setAttribute('hidden', ''));
            }

            function openMenuBelow(anchorBtn, menuEl) {
                const r = anchorBtn.getBoundingClientRect();
                menuEl.style.left = `${Math.round(r.left)}px`;
                menuEl.style.top = `${Math.round(r.bottom + 6)}px`;
                menuEl.hidden = false;
            }

            function loadFromState() {
                const stateObj = (typeof get === 'function' && get()) || (typeof fallbackGet === 'function' && fallbackGet()) || null;
                const rule = (stateObj && (stateObj.rule === 'before' || stateObj.rule === 'after')) ? stateObj.rule : defaultRule;

                if (ruleBtn) {
                    ruleBtn.dataset.val = rule;
                    const txt = ruleBtn.querySelector('.txt');
                    if (txt) txt.textContent = labels[rule] || labels[defaultRule] || 'After';
                }

                const val = (rule === 'after') ? (stateObj?.from || '') : (stateObj?.to || '');
                const { date, time } = splitVal(val);

                if (dateInp) dateInp.value = date || '';
                if (timeInp) timeInp.value = time || '';
            }

            // open/close popup
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeAllOtherPops();

                const willOpen = pop.hidden;
                pop.hidden = !pop.hidden;

                if (willOpen) {
                    loadFromState();

                    // если совсем пусто — подставим текущий UTC как удобный дефолт
                    if (dateInp && !dateInp.value) {
                        const n = nowUTCParts();
                        dateInp.value = n.date;
                        if (timeInp && !timeInp.value) timeInp.value = n.time;
                    }
                }
            });

            // rule dropdown open
            ruleBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!ruleMenu) return;
                if (ruleMenu.hidden) openMenuBelow(ruleBtn, ruleMenu);
                else ruleMenu.hidden = true;
            });

            // rule select
            ruleMenu?.addEventListener('click', (e) => {
                const b = e.target.closest('button[data-val]');
                if (!b) return;

                ruleBtn.dataset.val = b.dataset.val;
                ruleBtn.querySelector('.txt').textContent = b.textContent;
                ruleMenu.hidden = true;
            });

            okBtn?.addEventListener('click', () => {
                const rule = (ruleBtn?.dataset?.val === 'before') ? 'before' : 'after';
                const val = buildVal(dateInp?.value, timeInp?.value);

                if (typeof set === 'function') {
                    if (rule === 'before') set({ rule: 'before', from: '', to: val });
                    else set({ rule: 'after', from: val, to: '' });
                }

                if (fromInp) fromInp.value = (rule === 'after') ? val : '';
                if (toInp) toInp.value = (rule === 'before') ? val : '';

                pop.hidden = true;
                renderRows();
            });

            cancelBtn?.addEventListener('click', () => {
                pop.hidden = true;
            });

            resetBtn?.addEventListener('click', () => {
                if (typeof set === 'function') set({ rule: defaultRule, from: '', to: '' });

                if (dateInp) dateInp.value = '';
                if (timeInp) timeInp.value = '';

                if (fromInp) fromInp.value = '';
                if (toInp) toInp.value = '';

                pop.hidden = true;
                renderRows();
            });

            // click outside closes
            document.addEventListener('click', (e) => {
                if (!document.body.contains(pop) || pop.hidden) return;
                if (e.target.closest(popSel) || e.target.closest(btnSel)) return;
                pop.hidden = true;
                if (ruleMenu) ruleMenu.hidden = true;
            });
        }





        wireDateFilter({
            btnSel: '#ppStartBtn', popSel: '#ppStartPop',
            ruleBtnSel: '#ppStartRuleBtn', ruleMenuSel: '#ppStartRuleMenu',
            dateSel: '#ppStartDate', timeSel: '#ppStartTime',
            fromSel: '#ppStartFrom', toSel: '#ppStartTo',
            okSel: '#ppStartOk', cancelSel: '#ppStartCancel', resetSel: '#ppStartReset',
            defaultRule: 'after',
            get: () => startFilter,
            set: (v) => { startFilter = v; }
        });

        wireDateFilter({
            btnSel: '#ppEndBtn', popSel: '#ppEndPop',
            ruleBtnSel: '#ppEndRuleBtn', ruleMenuSel: '#ppEndRuleMenu',
            dateSel: '#ppEndDate', timeSel: '#ppEndTime',
            fromSel: '#ppEndFrom', toSel: '#ppEndTo',
            okSel: '#ppEndOk', cancelSel: '#ppEndCancel', resetSel: '#ppEndReset',
            defaultRule: 'before',
            fallbackGet: () => startFilter,
            get: () => endFilter,
            set: (v) => { endFilter = v; }
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


        // APPLY: применить выбранные типы (и, если есть, текстовое правило)
        typeApplyBtn?.addEventListener('click', () => {
            // 1) чекбоксы → боевое состояние
            typeFilter = new Set(typeDraft);

            // 2) текстовое правило: в текущей разметке его может не быть (только список типов).
            // Не ломаемся, аккуратно читаем, если элементы существуют.
            const rule = (typeRuleBtn?.dataset?.val) || 'contains';
            const query = (typeQueryInput?.value || '').trim();

            // Если контролов правила нет — просто отключаем текстовый фильтр,
            // чтобы работал только набор чекбоксов.
            typeTextFilter = (typeRuleBtn || typeQueryInput)
                ? { rule, query }
                : null;

            // 3) закрыть попап и перерисовать таблицу
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

        // [TIMELINE] инициализация нового самописного календаря
        initTimelineCalendar(items);

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
                const rawItems = extractLiveOps(json);
                const items = aggregateByNameWithSegments(rawItems); // ← ДЕДУП ПО NAME+ВРЕМЯ

                if (!items.length) {
                    appendKVResult('LiveOps', [['Status', 'No items found']]);
                } else {
                    appendLiveOpsTable(items);
                }


            }


            // 3. Promotions
            // 3. Promotions
            // 3. Promotions
            // 3. Promotions
            {
                const t = await fetchJsonText(buildUrl('promos', name));

                // Самый безопасный вариант А:
                // если Promotions-модуль не подгрузился (путь/порядок скриптов) — подгружаем его на лету.
                // Это НЕ влияет на LiveOps, т.к. работает только внутри Promotions-блока.
                await __ppEnsureGlobal('PP_Promotions', [
                    'ProfilePromotions.js',
                    './ProfilePromotions.js',
                    'ProfileParser/ProfilePromotions.js',
                    './ProfileParser/ProfilePromotions.js',
                ]);

                // Если модуль подгрузился — рендерим календарь+таблицу.
                // Иначе — честный fallback (мета-строка), чтобы ничего не ломать.
                if (window.PP_Promotions && typeof window.PP_Promotions.extract === 'function' && typeof window.PP_Promotions.appendPromotionsUI === 'function') {
                    const json = JSON.parse(t);
                    const promoItems = window.PP_Promotions.extract(json);

                    if (!promoItems.length) {
                        appendKVResult('Promotions', [['Status', 'No items found']]);
                    } else {
                        window.PP_Promotions.appendPromotionsUI(promoItems);
                    }
                } else {
                    appendPromotionsSection(first10(t), t.length);
                }
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

    // ===================== [TIMELINE] Pure JS =====================
    function initTimelineCalendar(items, ids = {}) {
        const ID = {
            title: ids.title || 'tlTitle',
            header: ids.header || 'tlHeader',
            body: ids.body || 'tlBody',
            res: ids.res || 'tlResList',
            grid: ids.grid || 'tlGrid',
            toolbar: ids.toolbar || 'tlToolbar',
            dateInput: ids.dateInput || 'tlDateInput',
        };

        // allow different 'Open in table' behavior for different calendars (LiveOps vs Promotions)
        const OPEN_IN_TABLE_EVENT = ids.openEvent || 'pp:applyNameFilter';


        const elTitle = document.getElementById(ID.title);
        const elHeader = document.getElementById(ID.header);
        const elBody = document.getElementById(ID.body);
        const elRes = document.getElementById(ID.res);
        const elGrid = document.getElementById(ID.grid);
        const elToolbar = document.getElementById(ID.toolbar);
        const elDateInput = document.getElementById(ID.dateInput);

        if (!elTitle || !elHeader || !elBody || !elRes || !elGrid) return;

        // [ANCHOR TL-WHEEL-SYNC] — колесо над левой колонкой двигает правое тело
        elRes.addEventListener('wheel', (e) => {
            // чтобы не прокручивалась страница и не было рассинхрона
            e.preventDefault();
            elBody.scrollTop += e.deltaY;
        }, { passive: false });


        // ---- state
        // ---- state
        const state = {
            view: 'day',
            anchor: startOfUTCDay(new Date()), // начало суток по UTC — без смещений
            colMs: 3600_000,
            rangeMs: 24 * 3600_000,
            colCount: 24,
            rowH: 44,
            colW: 80,
            pickedMs: null,
            _preventInfoOpen: false
        };

        const DAY_SPAN = 50;

        // Было 2 (и из-за этого центрирование шпильки иногда упиралось в границу полотна,
        // после чего включался «рефрейм» и ты видел скачок на дни/недели вперёд).
        // Делаем широкий буфер: 11 диапазонов (5 назад | текущий | 5 вперёд).
        // Это даёт возможность тянуть шпильку много дней без перескоков.
        const VISIBLE_DAY_SPAN = 11;

        // окно типов = 24 часа: 12 назад + 12 вперёд от текущего центра
        const WINDOW_HALF_HOURS = 18

        // вычисляем UTC-момент в центре текущей видимой области таймлайна
        function getViewportCenterDate(start3) {
            try {
                const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
                const pxMid = (elBody.scrollLeft || 0) + (elBody.clientWidth || 0) / 2;
                const colsFromStart = pxMid / colW;
                return addMs(start3, colsFromStart * state.colMs);
            } catch {
                // запасной вариант — середина суток вокруг anchor
                return addMs(state.anchor, state.rangeMs / 2);
            }
        }


        // Блокируем «шов» до первичного центрирования
        let allowSeamShift = false;

        // Debounce для пост-скроллового рендера (убирает «мерцание» при X-скролле)
        let _scrollRenderTimer = 0;
        const RENDER_IDLE_MS = 120; // пауза (мс), после которой можно безопасно пересчитать окно


        function normType(s) {
            // схлопываем пробелы и обрезаем
            return String(s ?? '—').replace(/\s+/g, ' ').trim();
        }
        function humanTypeLabel(s) {
            // превращаем MegaOrderExtraReward → "Mega Order Extra Reward"
            return String(s ?? '')
                .replace(/[_-]+/g, ' ')                      // подчёркивания/дефисы → пробел
                .replace(/([a-z\d])([A-Z])/g, '$1 $2')       // aB → a B
                .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')   // ABCd → AB Cd
                .trim();
        }

        // [FIX TL-LIST] — функции для построения ресурсов и левой колонки синхронно с полотном
        function buildResourcesFromEvents(eventsArr) {
            return Array.from(new Set(eventsArr.map(e => e.type || '—')));
        }


        function drawResList(resourcesArr) {
            elRes.innerHTML = resourcesArr
                .map(r => {
                    const label = humanTypeLabel(r);
                    const color = gradientForType(r);
                    return `<div class="tl-res-item" data-res="${escapeHtml(r)}">
  <span class="tl-dot" style="background:${color}"></span>${escapeHtml(label)}
</div>`;

                })
                .join('');
        }

        // Сравнение массивов строк по длине и поэлементно (важен порядок ALL_TYPES)
        function arraysEqual(a, b) {
            if (a === b) return true;
            if (!Array.isArray(a) || !Array.isArray(b)) return false;
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
                if (a[i] !== b[i]) return false;
            }
            return true;
        }



        const events = items
            .filter(x => Number.isFinite(x.startTS) && Number.isFinite(x.endTS))
            .map(x => ({
                title: x.name || '',
                type: normType(x.type),
                start: new Date(x.startTS),
                end: new Date(x.endTS),
                segments: Array.isArray(x.segments) ? x.segments : [],
                externalsBySegment: x.externalsBySegment || {},
                conditions: Array.isArray(x.conditions) ? x.conditions : [] // ← добавили
            }));

        // Глобальный неизменный порядок типов (по всему списку событий)
        const ALL_TYPES = buildResourcesFromEvents(events);



        const toolbar = elToolbar;

        const dateInput = elDateInput;

        // [TL-TOOLBAR-TOOLTIPS] — всплывающие подсказки для кнопок верхней панели
        if (toolbar) {
            const hintEl = document.createElement('div');
            hintEl.className = 'tl-toolbar-tooltip';
            document.body.appendChild(hintEl);

            const hintButtons = toolbar.querySelectorAll('.tl-btn[data-hint]');
            let currentHintBtn = null;

            const updateHintPosition = (btn) => {
                const rect = btn.getBoundingClientRect();
                const top = rect.bottom + 6; // чуть ниже кнопки
                const left = rect.left + rect.width / 2;
                hintEl.style.top = `${top}px`;
                hintEl.style.left = `${left}px`;
            };


            const showHint = (btn) => {
                const text = btn.getAttribute('data-hint');
                if (!text) return;
                currentHintBtn = btn;
                hintEl.textContent = text;
                updateHintPosition(btn);
                hintEl.setAttribute('data-show', '1');
            };

            const hideHint = () => {
                currentHintBtn = null;
                hintEl.removeAttribute('data-show');
            };

            hintButtons.forEach((btn) => {
                btn.addEventListener('mouseenter', () => showHint(btn));
                btn.addEventListener('mouseleave', hideHint);
                btn.addEventListener('focus', () => showHint(btn));
                btn.addEventListener('blur', hideHint);
            });

            // при скролле страницы/контента обновляем позицию подсказки
            window.addEventListener('scroll', () => {
                if (!currentHintBtn || !hintEl.hasAttribute('data-show')) return;
                updateHintPosition(currentHintBtn);
            }, { passive: true });
        }



        function isoDateUTC(d) {
            const pad = n => String(n).padStart(2, '0');
            return `${d.getUTCFullYear()}-${pad(
                d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
        }

        // [TL-GRID-HOVER-PICK] — подсказка + выбор времени по клику по сетке таймлайна
        const GRID_HOVER_DELAY = 1500; // 3 секунды
        let gridHintEl = null;
        let gridHoverTimer = null;
        let gridHoverX = 0;
        let gridHoverY = 0;

        function ensureGridHint() {
            if (!gridHintEl) {
                gridHintEl = document.createElement('div');
                gridHintEl.className = 'tl-grid-tooltip';
                // более естественный текст для подсказки
                gridHintEl.textContent = 'Pick this time';
                document.body.appendChild(gridHintEl);
            }
            return gridHintEl;
        }


        function hideGridHint() {
            if (gridHoverTimer) {
                clearTimeout(gridHoverTimer);
                gridHoverTimer = null;
            }
            if (gridHintEl) {
                gridHintEl.removeAttribute('data-show');
            }
        }

        function scheduleGridHint(ev) {
            // НЕ показываем "Pick this time" при наведении на верхнюю кнопку/шпильку (и её элементы)
            const t = ev?.target;
            if (t?.closest?.('.pp-picked-btn, .pp-picked-badge, .tl-picked')) return;

            gridHoverX = ev.clientX;
            gridHoverY = ev.clientY;
            if (gridHoverTimer) clearTimeout(gridHoverTimer);

            gridHoverTimer = setTimeout(() => {
                const tip = ensureGridHint();
                tip.style.left = `${gridHoverX}px`;
                tip.style.top = `${gridHoverY + 16}px`; // чуть ниже курсора
                tip.setAttribute('data-show', '1');
            }, GRID_HOVER_DELAY);
        }


        // Преобразуем X-координату клика в UTC-время и ставим «picked»-линию
        function pickTimeFromClientX(clientX) {
            if (!elBody) return;

            const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
            if (!colW || colW <= 0) return;

            const rect = elBody.getBoundingClientRect();
            const contentX = (clientX - rect.left) + elBody.scrollLeft;

            // start3 мы сохраняем в render() как state._start3
            const start3 = (state && state._start3 instanceof Date) ? state._start3 : state.anchor;
            if (!(start3 instanceof Date)) return;

            const pickedMs = start3.getTime() + (contentX / colW) * state.colMs;
            const picked = new Date(pickedMs);

            // 1) якорь — полночь выбранного дня по UTC
            state.anchor = startOfUTCDay(picked);
            // 2) запоминаем момент времени для линии «Picked»
            state.pickedMs = picked.getTime();

            render();

            // 3) центрируем выбранное время по центру тройного холста
            const colW2 = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
            const halfVisible = Math.floor(VISIBLE_DAY_SPAN / 2);
            const dayW = state.colCount * colW2;
            const extra = halfVisible * dayW;
            const xPicked = extra + ((picked - state.anchor) / state.colMs) * colW2;

            const desired = xPicked - elBody.clientWidth / 2;
            const maxScroll = Math.max(0, elBody.scrollWidth - elBody.clientWidth);
            const target = Math.max(0, Math.min(desired, maxScroll));

            const prev = allowSeamShift;
            allowSeamShift = false;
            elBody.scrollLeft = target;
            positionDayTags();
            elBody.dispatchEvent(new Event('scroll'));
            allowSeamShift = prev;
        }

        // === [PICKED DRAG] — перетаскивание синей шпильки =========================

        function updatePickedLineAndBadge() {
            if (!Number.isFinite(state.pickedMs)) return;
            if (!elBody) return;

            const start3 = (state && state._start3 instanceof Date) ? state._start3 : state.anchor;
            if (!(start3 instanceof Date)) return;

            const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
            if (!colW || colW <= 0) return;

            const x = ((state.pickedMs - start3.getTime()) / state.colMs) * colW;

            const pickEl = elBody.querySelector('.tl-picked');
            if (pickEl) pickEl.style.left = `${x}px`;

            const topScale = elHeader?.querySelector('.pp-cal-scale.top') || elHeader;
            const badgeEl = topScale?.querySelector('.pp-picked-badge');
            if (badgeEl) badgeEl.style.left = `${x}px`;

            const btnEl = topScale?.querySelector('.pp-picked-btn');
            if (btnEl) btnEl.style.left = `${x}px`;

            // обновляем текст времени на бейдже
            if (badgeEl) {
                const d = new Date(state.pickedMs);
                const hh = String(d.getUTCHours()).padStart(2, '0');
                const mm = String(d.getUTCMinutes()).padStart(2, '0');
                badgeEl.textContent = `${hh}:${mm} UTC`;
            }
        }

        function centerPickedMs(ms, smooth = true) {
            if (!Number.isFinite(ms)) return;
            if (!elBody) return;

            const start3 = (state && state._start3 instanceof Date) ? state._start3 : state.anchor;
            if (!(start3 instanceof Date)) return;

            const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
            if (!colW || colW <= 0) return;

            const xPicked = ((ms - start3.getTime()) / state.colMs) * colW;

            const desired = xPicked - elBody.clientWidth / 2;
            const maxScroll = Math.max(0, elBody.scrollWidth - elBody.clientWidth);
            const target = Math.max(0, Math.min(desired, maxScroll));

            const prev = allowSeamShift;
            allowSeamShift = false;

            if (smooth && typeof elBody.scrollTo === 'function') {
                elBody.scrollTo({ left: target, behavior: 'smooth' });
            } else {
                elBody.scrollLeft = target;
            }

            positionDayTags();
            elBody.dispatchEvent(new Event('scroll'));
            allowSeamShift = prev;
        }

        // function beginPickedDrag(ev, ui) {
        //     // ui: { pickEl, btnEl, badgeEl, start3, xPick }
        //     if (!ui || !ui.start3) return;
        //     if (!Number.isFinite(state.pickedMs)) return;

        //     ev.preventDefault();
        //     ev.stopPropagation();

        //     const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
        //     if (!colW || colW <= 0) return;

        //     const startX = ev.clientX;
        //     const startPickedMs = state.pickedMs;

        //     // текущая “левая” позиция шпильки (в px) на момент старта
        //     let startLeftPx = ui.xPick;
        //     if (!Number.isFinite(startLeftPx)) {
        //         startLeftPx = ((startPickedMs - ui.start3.getTime()) / state.colMs) * colW;
        //     }

        //     let moved = false;
        //     let lastMs = startPickedMs;

        //     // чтобы клик по кнопке не срабатывал после drag
        //     if (ui.btnEl) ui.btnEl._suppressClick = false;

        //     try { ev.target.setPointerCapture?.(ev.pointerId); } catch { }

        // const onMove = (e) => {
        //     const dx = (e.clientX - startX);
        //     if (!moved && Math.abs(dx) > 3) moved = true;

        //     const newLeft = startLeftPx + dx;

        //     // пересчёт px -> ms (через start3)
        //     const ms = ui.start3.getTime() + (newLeft / colW) * state.colMs;

        //     lastMs = ms;
        //     state.pickedMs = ms;

        //     // живое движение без render()
        //     if (ui.pickEl) ui.pickEl.style.left = `${newLeft}px`;
        //     if (ui.btnEl) ui.btnEl.style.left = `${newLeft}px`;
        //     if (ui.badgeEl) ui.badgeEl.style.left = `${newLeft}px`;

        //     if (ui.badgeEl) {
        //         const d = new Date(ms);
        //         const hh = String(d.getUTCHours()).padStart(2, '0');
        //         const mm = String(d.getUTCMinutes()).padStart(2, '0');
        //         ui.badgeEl.textContent = `${hh}:${mm} UTC`;
        //     }
        // };

        // const onUp = () => {
        //     document.removeEventListener('pointermove', onMove, true);
        //     document.removeEventListener('pointerup', onUp, true);
        //     document.removeEventListener('pointercancel', onUp, true);

        //     // если реально тянули — подавляем click по кнопке
        //     if (ui.btnEl && moved) ui.btnEl._suppressClick = true;

        //     // если это был “клик” без движения — откатываем pickedMs и выходим
        //     if (!moved) {
        //         state.pickedMs = startPickedMs;
        //         return;
        //     }

        //         // финализация: якорь суток = день, в который попали (UTC), затем render и центрирование
        //         const finalMs = lastMs;
        //         state.pickedMs = finalMs;

        //         const d = new Date(finalMs);
        //         state.anchor = startOfUTCDay(d);

        //         render();

        //         requestAnimationFrame(() => {
        //             centerPickedMs(finalMs, true);
        //         });
        //     };

        //     document.addEventListener('pointermove', onMove, true);
        //     document.addEventListener('pointerup', onUp, true);
        //     document.addEventListener('pointercancel', onUp, true);
        // }

        function beginPickedDrag(ev, ui) {
            // ui: { pickEl, btnEl, badgeEl, start3, xPick }
            if (!ui || !ui.start3) return;
            if (!Number.isFinite(state.pickedMs)) return;

            ev.preventDefault();
            ev.stopPropagation();

            const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
            if (!colW || colW <= 0) return;

            const startPickedMs = state.pickedMs;

            // текущая “левая” позиция шпильки (в px) на момент старта (координаты контента)
            let startLeftPx = ui.xPick;
            if (!Number.isFinite(startLeftPx)) {
                startLeftPx = ((startPickedMs - ui.start3.getTime()) / state.colMs) * colW;
            }

            // --- [AUTO-SCROLL + CORRECT DRAG] ---
            // Считаем позицию курсора в координатах контента (scrollLeft + x внутри вьюпорта),
            // чтобы drag не ломался, когда контейнер сам скроллится.
            const EDGE_PX = 20;     // последние 20px у края — включаем авто-скролл
            const MAX_STEP = 24;    // максимум px за один pointermove (подбирается по ощущениям)

            const bodyRect0 = elBody.getBoundingClientRect();
            const startContentX = elBody.scrollLeft + (ev.clientX - bodyRect0.left);
            const grabOffset = startContentX - startLeftPx; // где внутри шпильки мы её "схватили"

            let moved = false;
            let lastMs = startPickedMs;

            // чтобы клик по кнопке не срабатывал после drag
            if (ui.btnEl) ui.btnEl._suppressClick = false;

            try { ev.target.setPointerCapture?.(ev.pointerId); } catch { }

            const onMove = (e) => {
                // позиция курсора внутри видимого окна elBody
                const r = elBody.getBoundingClientRect();
                const localX = (e.clientX - r.left);

                // 1) авто-скролл, если упёрлись в края
                let scrollDelta = 0;
                if (localX < EDGE_PX) {
                    const k = (EDGE_PX - localX) / EDGE_PX;               // 0..1
                    scrollDelta = -Math.ceil(MAX_STEP * Math.min(1, k));
                } else if (localX > (r.width - EDGE_PX)) {
                    const k = (localX - (r.width - EDGE_PX)) / EDGE_PX;   // 0..1
                    scrollDelta = Math.ceil(MAX_STEP * Math.min(1, k));
                }

                if (scrollDelta) {
                    const maxScroll = Math.max(0, elBody.scrollWidth - elBody.clientWidth);
                    const next = clamp(elBody.scrollLeft + scrollDelta, 0, maxScroll);
                    if (next !== elBody.scrollLeft) {
                        elBody.scrollLeft = next;

                        // синхронизация шапки/дней/сеток через существующий scroll-обработчик
                        elBody.dispatchEvent(new Event('scroll'));
                    }
                }

                // 2) позиция курсора в координатах контента после возможного скролла
                const r2 = elBody.getBoundingClientRect();
                const contentX = elBody.scrollLeft + (e.clientX - r2.left);

                // 3) новая позиция шпильки в координатах контента
                const newLeft = contentX - grabOffset;

                // детект движения (чтобы отличить click от drag)
                if (!moved && Math.abs(newLeft - startLeftPx) > 3) moved = true;

                // px -> ms (через start3)
                const ms = ui.start3.getTime() + (newLeft / colW) * state.colMs;

                lastMs = ms;
                state.pickedMs = ms;

                // живое движение без render()
                if (ui.pickEl) ui.pickEl.style.left = `${newLeft}px`;
                if (ui.btnEl) ui.btnEl.style.left = `${newLeft}px`;
                if (ui.badgeEl) ui.badgeEl.style.left = `${newLeft}px`;

                if (ui.badgeEl) {
                    const d = new Date(ms);
                    const hh = String(d.getUTCHours()).padStart(2, '0');
                    const mm = String(d.getUTCMinutes()).padStart(2, '0');
                    ui.badgeEl.textContent = `${hh}:${mm} UTC`;
                }
            };

            const onUp = () => {
                document.removeEventListener('pointermove', onMove, true);
                document.removeEventListener('pointerup', onUp, true);
                document.removeEventListener('pointercancel', onUp, true);

                // если реально тянули — подавляем click по кнопке
                if (ui.btnEl && moved) ui.btnEl._suppressClick = true;

                // если это был “клик” без движения — откатываем pickedMs и выходим
                if (!moved) {
                    state.pickedMs = startPickedMs;
                    return;
                }

                // финализация: якорь суток = день, в который попали (UTC), затем render и центрирование
                const finalMs = lastMs;
                state.pickedMs = finalMs;

                const d = new Date(finalMs);
                state.anchor = startOfUTCDay(d);

                render();

                requestAnimationFrame(() => {
                    centerPickedMs(finalMs, true);
                });
            };

            document.addEventListener('pointermove', onMove, true);
            document.addEventListener('pointerup', onUp, true);
            document.addEventListener('pointercancel', onUp, true);
        }


        // === [PICKED DRAG] перетаскивание синей шпильки + плавное центрирование ===
        function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

        // function smoothScrollLeftTo(targetLeft, ms = 220) {
        //     if (!elBody) return;
        //     const start = elBody.scrollLeft;
        //     const diff = targetLeft - start;
        //     if (Math.abs(diff) < 1) return;

        //     const t0 = performance.now();
        //     const prev = allowSeamShift;
        //     allowSeamShift = false;

        //     const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

        //     function step(now) {
        //         const p = clamp((now - t0) / ms, 0, 1);
        //         const v = start + diff * easeOutCubic(p);
        //         elBody.scrollLeft = v;

        //         // синхронизируем шапку/дни/сетку как обычно
        //         positionDayTags();
        //         elBody.dispatchEvent(new Event('scroll'));

        //         if (p < 1) requestAnimationFrame(step);
        //         else allowSeamShift = prev;
        //     }
        //     requestAnimationFrame(step);
        // }

        // function centerPickedMs(pickedMs, smooth = true) {
        //     if (!elBody || !Number.isFinite(pickedMs)) return;

        //     const picked = new Date(pickedMs);

        //     const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
        //     const halfVisible = Math.floor(VISIBLE_DAY_SPAN / 2);
        //     const dayW = state.colCount * colW;
        //     const extra = halfVisible * dayW;

        //     const xPicked = extra + ((picked - state.anchor) / state.colMs) * colW;

        //     const desired = xPicked - elBody.clientWidth / 2;
        //     const maxScroll = Math.max(0, elBody.scrollWidth - elBody.clientWidth);
        //     const target = Math.max(0, Math.min(desired, maxScroll));

        //     if (smooth) smoothScrollLeftTo(target, 240);
        //     else {
        //         const prev = allowSeamShift;
        //         allowSeamShift = false;
        //         elBody.scrollLeft = target;
        //         positionDayTags();
        //         elBody.dispatchEvent(new Event('scroll'));
        //         allowSeamShift = prev;
        //     }
        // }

        function smoothScrollLeftTo(targetLeft, ms = 220) {
            if (!elBody) return;

            const start = elBody.scrollLeft;
            const diff = targetLeft - start;
            if (Math.abs(diff) < 1) return;

            const t0 = performance.now();

            // ВАЖНО:
            // allowSeamShift НЕ выключаем, иначе у края не сработает “бесконечный” подшов (re-render + смещение anchor)
            // и ты упираешься в край 3-дневного полотна.
            const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

            function step(now) {
                const p = clamp((now - t0) / ms, 0, 1);
                const v = start + diff * easeOutCubic(p);
                elBody.scrollLeft = v;

                // синхронизируем шапку/дни/сетку как обычно
                positionDayTags();
                elBody.dispatchEvent(new Event('scroll'));

                if (p < 1) requestAnimationFrame(step);
            }

            requestAnimationFrame(step);
        }

        function centerPickedMs(pickedMs, smooth = true) {
            if (!elBody || !Number.isFinite(pickedMs)) return;

            // Подстраховка: если после drag/click шпилька оказалась “слишком у края” и центрирование
            // упирается в maxScroll, мы “перешиваем” anchor на +range/-range и делаем render(),
            // чтобы шпилька снова могла стать по центру (и чтобы подхватились следующие сутки).
            const tryRebaseToMakeCenterPossible = () => {
                const picked = new Date(pickedMs);

                const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
                if (!colW || colW <= 0) return { ok: false, target: 0 };

                const halfVisible = Math.floor(VISIBLE_DAY_SPAN / 2);
                const dayW = state.colCount * colW;
                const extra = halfVisible * dayW;

                const xPicked = extra + ((picked - state.anchor) / state.colMs) * colW;

                const desired = xPicked - elBody.clientWidth / 2;
                const maxScroll = Math.max(0, elBody.scrollWidth - elBody.clientWidth);

                // если desired выходит за границы — это и есть “упёрлись в край полотна”
                if (desired > maxScroll + 1) return { ok: false, dir: +1, desired, maxScroll };
                if (desired < -1) return { ok: false, dir: -1, desired, maxScroll };

                // уже можно центрировать без ребейза
                const target = Math.max(0, Math.min(desired, maxScroll));
                return { ok: true, target };
            };

            // максимум несколько шагов ребейза, чтобы не зациклиться
            for (let i = 0; i < 4; i++) {
                const r = tryRebaseToMakeCenterPossible();
                if (r.ok) {
                    if (smooth) smoothScrollLeftTo(r.target, 240);
                    else {
                        elBody.scrollLeft = r.target;
                        positionDayTags();
                        elBody.dispatchEvent(new Event('scroll'));
                    }
                    return;
                }

                // сдвигаем anchor на один базовый диапазон (сутки) в сторону нехватки скролла
                // и перерисовываем полотно — это “подгрузит” нужные сутки в тройном окне.
                state.anchor = addMs(state.anchor, (r.dir || 0) * state.rangeMs);
                render();
            }

            // если вдруг не удалось (крайний случай) — просто дернём рендер
            render();
        }

        // function beginPickedDrag(ev, ui) {
        //     // ВАЖНО: если это клик по кнопке на шпильке — НЕ запускаем drag,
        //     // иначе браузер часто не генерит click и кнопка "не работает".
        //     if (ev?.target?.closest?.('.pp-picked-btn')) return;

        //     // Не гасим click лишний раз. Дадим драг включаться только при реальном движении.
        //     let moved = false;

        //     const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;

        //     const startClientX = ev.clientX;
        //     const startScrollLeft = elBody.scrollLeft;

        //     const startPickedMs = state.pickedMs;
        //     let lastMs = startPickedMs;

        // // Чтобы не было текст-селекшена при реальном перетягивании
        // // (но только когда мы уже реально «поехали»)
        // const DRAG_THRESHOLD_PX = 3;

        // const onMove = (e) => {
        //     const dx = e.clientX - startClientX;

        //     if (!moved && Math.abs(dx) >= DRAG_THRESHOLD_PX) {
        //         moved = true;
        //         try { e.preventDefault(); } catch { }
        //     }
        //     if (!moved) return;

        //     // визуально двигаем шпильку: считаем смещение по px → ms
        //     const px = (startScrollLeft - dx);
        //     const start3 = state._start3 || addMs(state.anchor, -Math.floor(VISIBLE_DAY_SPAN / 2) * state.rangeMs);
        //     const ms = start3.getTime() + (px / colW) * state.colMs;

        //     lastMs = ms;
        //     state.pickedMs = ms;

        //     // обновляем только позицию (без полного рендера)
        //     updatePickedLineAndBadge();
        // };

        // const onUp = (e) => {
        //     document.removeEventListener('pointermove', onMove, true);
        //     document.removeEventListener('pointerup', onUp, true);

        //     // Если движения почти не было — это был обычный клик по линии (не ломаем ничего)
        //     if (!moved) {
        //         state.pickedMs = startPickedMs;
        //         return;
        //     }

        //         // Фиксируем шпильку в новый день (UTC)
        //         const finalMs = lastMs;
        //         state.pickedMs = finalMs;

        //         const d = new Date(finalMs);
        //         state.anchor = startOfUTCDay(d);

        //         // Перерисовываем полотно уже вокруг нового anchor (с большим буфером),
        //         // а центрирование делаем В СЛЕДУЮЩЕМ кадре, чтобы scrollWidth/границы успели обновиться.
        //         render();

        //         requestAnimationFrame(() => {
        //             centerPickedMs(finalMs, true);
        //         });
        //     };

        //     document.addEventListener('pointermove', onMove, true);
        //     document.addEventListener('pointerup', onUp, true);
        // }

        function beginPickedDrag(ev, ui) {
            if (!ui || !ui.pickEl) return;
            if (!Number.isFinite(state.pickedMs)) return;

            // Стартовали с кнопки или с линии — разрешаем drag в обоих случаях.
            const startedOnBtn = !!ev?.target?.closest?.('.pp-picked-btn');

            // Drag включаем только после небольшого движения (чтобы click по кнопке/линии не ломать)
            let moved = false;
            const DRAG_THRESHOLD_PX = 3;

            const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
            if (!colW || colW <= 0) return;

            const startClientX = ev.clientX;

            // Текущая позиция линии (важно: xPick из ui может быть устаревшим после updatePickedLineAndBadge)
            const startLeftPx =
                (ui.pickEl.style.left ? parseFloat(ui.pickEl.style.left) : NaN);
            const startLeft = Number.isFinite(startLeftPx) ? startLeftPx : (ui.xPick || 0);

            // Важно: берем start3 “сейчас” один раз, чтобы во время drag не было дерганий
            const start3 = state._start3 || addMs(state.anchor, -Math.floor(VISIBLE_DAY_SPAN / 2) * state.rangeMs);
            const start3ms = start3.getTime();

            const startPickedMs = state.pickedMs;
            let lastMs = startPickedMs;

            // pointer capture, чтобы не терять drag
            try { ev.target?.setPointerCapture?.(ev.pointerId); } catch { }

            const onMove = (e) => {
                const dx = e.clientX - startClientX;

                if (!moved && Math.abs(dx) >= DRAG_THRESHOLD_PX) {
                    moved = true;
                    // Только когда реально поехали — гасим дефолт (иначе click будет стабильнее)
                    try { e.preventDefault(); } catch { }
                }
                if (!moved) return;

                const newLeft = startLeft + dx;

                // px -> ms (правильная математика: от start3 + (left/colW)*colMs)
                const ms = start3ms + (newLeft / colW) * state.colMs;

                lastMs = ms;
                state.pickedMs = ms;

                // обновляем только позицию (без полного render)
                updatePickedLineAndBadge();
            };

            const onUp = () => {
                document.removeEventListener('pointermove', onMove, true);
                document.removeEventListener('pointerup', onUp, true);

                // Не двигали — оставляем как было (клик по линии/кнопке)
                if (!moved) {
                    state.pickedMs = startPickedMs;
                    return;
                }

                // Если драг начался на кнопке — следующий click надо “поглотить” (иначе он сработает после drag)
                if (startedOnBtn && ui.btnEl) {
                    ui.btnEl._ppSuppressClickOnce = true;
                }

                const finalMs = lastMs;
                state.pickedMs = finalMs;

                // якорим по дню выбранного момента
                state.anchor = startOfUTCDay(new Date(finalMs));

                // перерисовать и мягко вернуть шпильку в центр
                render();
                requestAnimationFrame(() => centerPickedMs(finalMs, true));
            };

            document.addEventListener('pointermove', onMove, true);
            document.addEventListener('pointerup', onUp, true);
        }


        // Ховеры и клики по сетке таймлайна (тело + верхняя шкала часов)
        // Ховеры и клики по сетке таймлайна (ТОЛЬКО линейка часов)
        const gridHoverTargets = [];

        // целимся именно в «линейку часов», где курсор = pointer
        const hoursRulerEl =
            elHeader?.querySelector?.('.pp-cal-scale.top') ||
            elHeader?.querySelector?.('.tl-grid-header') ||
            elHeader;

        if (hoursRulerEl) gridHoverTargets.push(hoursRulerEl);

        if (gridHoverTargets.length) {
            gridHoverTargets.forEach((target) => {
                // запуск таймера тултипа при заходе курсора
                target.addEventListener('mouseenter', (ev) => {
                    scheduleGridHint(ev);
                });

                // если курсор сдвинулся — сбрасываем таймер; покажем снова только после "зависания"
                target.addEventListener('mousemove', (ev) => {
                    const dx = Math.abs(ev.clientX - gridHoverX);
                    const dy = Math.abs(ev.clientY - gridHoverY);
                    if (dx > 4 || dy > 4) {
                        hideGridHint();
                        scheduleGridHint(ev);
                    }
                });

                target.addEventListener('mouseleave', () => {
                    hideGridHint();
                });
            });


            // при скролле сетки — прячем тултип (только тело)
            if (elBody) {
                elBody.addEventListener('scroll', () => {
                    hideGridHint();
                }, { passive: true });

                // клик по пустой сетке тела — ставим шпильку «picked»
                elBody.addEventListener('click', (ev) => {
                    // Не трогаем клики по барам событий — там отдельный поповер
                    if (ev.target && ev.target.closest('.tl-event')) {
                        hideGridHint();
                        return;
                    }

                    const rect = elBody.getBoundingClientRect();
                    if (ev.clientX < rect.left || ev.clientX > rect.right) return;
                    if (ev.clientY < rect.top || ev.clientY > rect.bottom) return;

                    hideGridHint();
                    pickTimeFromClientX(ev.clientX);
                });
            }

            // клик по верхней шкале часов — то же самое: выбираем время под курсором
            if (elHeader) {
                elHeader.addEventListener('click', (ev) => {
                    const rect = elHeader.getBoundingClientRect();
                    if (ev.clientX < rect.left || ev.clientX > rect.right) return;
                    if (ev.clientY < rect.top || ev.clientY > rect.bottom) return;

                    hideGridHint();
                    pickTimeFromClientX(ev.clientX);
                });
            }
        }


        function isoDateUTC(d) {
            const pad = n => String(n).padStart(2, '0');
            return `${d.getUTCFullYear()}-${pad(
                d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
        }


        function centerOnMidday() {
            const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
            const halfVisible = Math.floor(VISIBLE_DAY_SPAN / 2);
            const dayW = state.colCount * colW;
            const xMid = halfVisible * dayW + 12 * colW;

            const desired = xMid - elBody.clientWidth / 2;
            const maxScroll = Math.max(0, elBody.scrollWidth - elBody.clientWidth);
            const target = Math.max(0, Math.min(desired, maxScroll));

            const prev = allowSeamShift;
            allowSeamShift = false;
            elBody.scrollLeft = target;
            positionDayTags();
            elBody.dispatchEvent(new Event('scroll'));
            allowSeamShift = prev;
        }


        toolbar.addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b) return;

            if (b.dataset.nav === 'calendar') {
                // ——— наш мини-поповер «дата + время + OK» рядом с кнопкой
                const wrap = toolbar.querySelector('.tl-cal-wrap') || toolbar;
                let pop = wrap.querySelector('#tlDateTimePop');
                if (!pop) {
                    pop = document.createElement('div');
                    pop.id = 'tlDateTimePop';
                    pop.className = 'tl-dtp';
                    pop.innerHTML = `
          <div class="tl-dtp-row">
            <label class="tl-dtp-col">
              <span class="lbl">Date (UTC)</span>
              <input id="tlDtDate" type="date" class="fld"/>
            </label>
            <label class="tl-dtp-col">
              <span class="lbl">Time (UTC)</span>
              <input id="tlDtTime" type="time" step="60" class="fld"/>
            </label>
          </div>
          <div class="tl-dtp-actions">
            <button class="ok">OK</button>
            <button class="cancel">Cancel</button>
          </div>
        `;
                    wrap.appendChild(pop);

                    /* клик по ЛЮБОЙ области карточек Date/Time открывает нативный пикер */
                    pop.querySelectorAll('.tl-dtp-col').forEach(col => {
                        col.addEventListener('click', (ev) => {
                            const inp = col.querySelector('input');
                            if (!inp) return;
                            ev.stopPropagation();                      // чтобы не закрывался поп-ап
                            inp.focus({ preventScroll: true });        // сначала фокус
                            if (typeof inp.showPicker === 'function') {
                                try { inp.showPicker(); } catch { }
                            } else {
                                // fallback для браузеров без showPicker
                                const evt = new MouseEvent('mousedown', { bubbles: true });
                                inp.dispatchEvent(evt);
                            }
                        });
                    });


                    // Закрытие по клику вне
                    document.addEventListener('click', (ev) => {
                        if (!pop.hasAttribute('hidden') && !pop.contains(ev.target) && !b.contains(ev.target)) {
                            pop.setAttribute('hidden', '');
                        }
                    }, true);

                    // OK / Cancel
                    // pop.querySelector('.ok')?.addEventListener('click', () => {
                    //     const dStr = pop.querySelector('#tlDtDate')?.value || '';
                    //     const tStr = pop.querySelector('#tlDtTime')?.value || '00:00';
                    //     if (!dStr) return; // нет даты — ничего не делаем

                    //     // Собираем UTC-дату вида YYYY-MM-DDTHH:mm:00Z
                    //     const picked = new Date(`${dStr}T${tStr}:00Z`);

                    //     // 1) якорь = полночь выбранного дня (UTC) → перерисуем
                    //     state.anchor = startOfUTCDay(picked);
                    //     // 2) запомним сам выбранный момент (UTC ms) для линии «Picked»
                    //     state.pickedMs = picked.getTime();

                    //     render();

                    //     // 3) отцентрируем выбранное время по центру тройного холста

                    //     // 3) отцентрируем выбранное время по центру тройного холста
                    //     const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
                    //     const halfVisible = Math.floor(VISIBLE_DAY_SPAN / 2);
                    //     const dayW = state.colCount * colW;
                    //     const extra = halfVisible * dayW;
                    //     const xPicked = extra + ((picked - state.anchor) / state.colMs) * colW;

                    //     const desired = xPicked - elBody.clientWidth / 2;
                    //     const maxScroll = Math.max(0, elBody.scrollWidth - elBody.clientWidth);
                    //     const target = Math.max(0, Math.min(desired, maxScroll));

                    //         const prev = allowSeamShift;
                    //         allowSeamShift = false;
                    //         elBody.scrollLeft = target;
                    //         positionDayTags();
                    //         elBody.dispatchEvent(new Event('scroll'));
                    //         allowSeamShift = prev;


                    //         pop.setAttribute('hidden', '');
                    //     });

                    //     pop.querySelector('.cancel')?.addEventListener('click', () => {
                    //         pop.setAttribute('hidden', '');
                    //     });
                    // }

                    // // Заполним текущими значениями и покажем
                    // // Дата: фактический день, который сейчас виден в центре таймлайна (UTC)
                    // const now = new Date();
                    // const pad = n => String(n).padStart(2, '0');

                    // let baseDate;

                    //     try {
                    //         // start3 мы сохраняем в render() как state._start3
                    //         const start3 = (state && state._start3 instanceof Date) ? state._start3 : state.anchor;
                    //         if (start3 instanceof Date) {
                    //             // вычисляем дату, которая находится по центру текущего viewport
                    //             baseDate = getViewportCenterDate(start3);
                    //         }
                    //     } catch {
                    //         // если что-то пошло не так — уйдём в запасной сценарий ниже
                    //     }

                    //     // запасной вариант: опираемся на anchor / текущий день по UTC
                    //     if (!(baseDate instanceof Date)) {
                    //         baseDate = (state && state.anchor instanceof Date)
                    //             ? state.anchor
                    //             : startOfUTCDay(new Date());
                    //     }

                    //     // нам нужна именно полночь суток по UTC
                    //     const anchorUtc = startOfUTCDay(baseDate);

                    //     pop.querySelector('#tlDtDate').value = isoDateUTC(anchorUtc);
                    //     pop.querySelector('#tlDtTime').value = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
                    //     pop.removeAttribute('hidden');
                    //     return;


                    // }

                    // OK / Cancel
                    pop.querySelector('.ok')?.addEventListener('click', () => {
                        const dStr = pop.querySelector('#tlDtDate')?.value || '';
                        const tStr = pop.querySelector('#tlDtTime')?.value || '00:00';
                        if (!dStr) return; // нет даты — ничего не делаем

                        // Собираем UTC-дату вида YYYY-MM-DDTHH:mm:00Z
                        const picked = new Date(`${dStr}T${tStr}:00Z`);

                        // 1) якорь = полночь выбранного дня (UTC) → перерисуем
                        state.anchor = startOfUTCDay(picked);
                        // 2) запомним сам выбранный момент (UTC ms) для линии «Picked»
                        state.pickedMs = picked.getTime();

                        render();

                        // 3) отцентрируем выбранное время по центру тройного холста
                        const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
                        const halfVisible = Math.floor(VISIBLE_DAY_SPAN / 2);
                        const dayW = state.colCount * colW;
                        const extra = halfVisible * dayW;
                        const xPicked = extra + ((picked - state.anchor) / state.colMs) * colW;

                        const desired = xPicked - elBody.clientWidth / 2;
                        const maxScroll = Math.max(0, elBody.scrollWidth - elBody.clientWidth);
                        const target = Math.max(0, Math.min(desired, maxScroll));

                        const prev = allowSeamShift;
                        allowSeamShift = false;
                        elBody.scrollLeft = target;
                        positionDayTags();
                        elBody.dispatchEvent(new Event('scroll'));
                        allowSeamShift = prev;

                        pop.setAttribute('hidden', '');
                    });

                    pop.querySelector('.cancel')?.addEventListener('click', () => {
                        pop.setAttribute('hidden', '');
                    });
                }

                // Заполним текущими значениями и покажем
                // Дата: фактический день, который сейчас виден в центре таймлайна (UTC)
                const now = new Date();
                const pad = n => String(n).padStart(2, '0');

                let baseDate;

                try {
                    // start3 мы сохраняем в render() как state._start3
                    const start3 = (state && state._start3 instanceof Date) ? state._start3 : state.anchor;
                    if (start3 instanceof Date) {
                        // вычисляем дату, которая находится по центру текущего viewport
                        baseDate = getViewportCenterDate(start3);
                    }
                } catch {
                    // если что-то пошло не так — уйдём в запасной сценарий ниже
                }

                // запасной вариант: опираемся на anchor / текущий день по UTC
                if (!(baseDate instanceof Date)) {
                    baseDate = (state && state.anchor instanceof Date)
                        ? state.anchor
                        : startOfUTCDay(new Date());
                }

                // нам нужна именно полночь суток по UTC
                const anchorUtc = startOfUTCDay(baseDate);

                const dateInp = pop.querySelector('#tlDtDate');
                const timeInp = pop.querySelector('#tlDtTime');

                if (dateInp) {
                    dateInp.value = isoDateUTC(anchorUtc);
                }
                if (timeInp) {
                    timeInp.value = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
                }

                // --- Позиционирование поп-апа во вьюпорте ---
                // берём геометрию кнопки Calendar
                const btnRect = b.getBoundingClientRect();
                const viewportW = window.innerWidth || document.documentElement.clientWidth;
                const margin = 12;
                // ширину попапа можно оценить по offsetWidth, либо взять дефолт 280
                const popupWidth = pop.offsetWidth || 280;

                // выравниваем по правому краю кнопки, но не даём уйти за левый край экрана
                let left = btnRect.right - popupWidth;
                if (left < margin) left = margin;
                // топ — сразу под кнопкой
                const top = btnRect.bottom + 6;

                pop.style.position = 'fixed';
                pop.style.left = `${Math.round(left)}px`;
                pop.style.top = `${Math.round(top)}px`;
                pop.style.right = 'auto';

                pop.removeAttribute('hidden');
                return;

            }


            if (b.dataset.nav === 'today') {
                state.anchor = startOfUTCDay(new Date());
                render();

                const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
                const halfVisible = Math.floor(VISIBLE_DAY_SPAN / 2);
                const dayW = state.colCount * colW;
                const extra = (state.view === 'day') ? halfVisible * dayW : 0;
                const now = new Date();
                const xNow = ((now - state.anchor) / state.colMs) * colW + extra;

                const desired = xNow - elBody.clientWidth / 2;
                const maxScroll = Math.max(0, elBody.scrollWidth - elBody.clientWidth);
                const target = Math.max(0, Math.min(desired, maxScroll));

                const prev = allowSeamShift;
                allowSeamShift = false;
                elBody.scrollLeft = target;
                positionDayTags();
                elBody.dispatchEvent(new Event('scroll'));
                allowSeamShift = prev;
            }



            if (b.dataset.nav === 'prev') { state.anchor = addMs(state.anchor, -state.rangeMs); render(); }
            if (b.dataset.nav === 'next') { state.anchor = addMs(state.anchor, state.rangeMs); render(); }
        });

        // Изменение даты — прыжок к выбранному дню
        if (dateInput) {
            dateInput.addEventListener('change', () => {
                if (!dateInput.value) return;
                // Преобразуем выбранную дату (локальную) к началу суток в UTC для якоря
                const picked = new Date(`${dateInput.value}T00:00:00Z`);
                state.anchor = startOfUTCDay(picked);
                render();
                centerOnMidday();

            });
        }


        function setView() {
            // Жестко держим единственный режим — day (24 часа по 1 часу в колонке)
            state.view = 'day';
            state.colMs = 3600_000;
            state.colCount = 24;
            state.rangeMs = state.colMs * state.colCount;
        }




        function render() {
            // [ANCHOR TL-TRIPLE-RANGE] — 3-секционный холст для бесшовного day-скролла
            const start = state.anchor;
            const end = addMs(start, state.rangeMs);
            const HALF = Math.floor(VISIBLE_DAY_SPAN / 2);

            // окно 3 диапазонов (prev | current | next) для ЛЮБОГО view
            const start3 = addMs(start, -HALF * state.rangeMs);
            const end3 = addMs(start, (VISIBLE_DAY_SPAN - HALF) * state.rangeMs);

            // сохраняем для scroll-listener
            state._start3 = start3;

            elTitle.textContent = (state.view === 'day') ? '' : formatTitle(start, state.view);

            // === [ОКНО ТИПОВ: ±12ч от центра видимой области] ========================
            const centerDate = getViewportCenterDate(start3);
            const windowStart = addMs(centerDate, -WINDOW_HALF_HOURS * state.colMs);
            const windowEnd = addMs(centerDate, +WINDOW_HALF_HOURS * state.colMs);

            // Берём только события, пересекающие окно 24 часа
            const windowEvents = events.filter(ev => ev.end > windowStart && ev.start < windowEnd);

            // типы слева: показываем ТОЛЬКО те, что есть в окне, но в ГЛОБАЛЬНО фиксированном порядке
            const windowSet = new Set(buildResourcesFromEvents(windowEvents));
            const resources = ALL_TYPES.filter(t => windowSet.has(t));

            // Рисуем список слева только если он реально изменился
            if (!arraysEqual(state._resList || [], resources)) {
                drawResList(resources);
                state._resList = resources.slice();
            }



            // быстрый доступ «тип → события» в рамках 24ч окна
            const byType = new Map();
            for (const ev of windowEvents) {
                const k = ev.type;
                if (!byType.has(k)) byType.set(k, []);
                byType.get(k).push(ev);
            }


            // колонки заголовка
            elHeader.innerHTML = '';
            const visibleCols = state.colCount * VISIBLE_DAY_SPAN; // тройной буфер для любого режима

            for (let i = 0; i < visibleCols; i++) {
                const t0 = addMs(start3, i * state.colMs);
                const label = (state.view === 'day')
                    ? t0.toLocaleTimeString([], { hour: 'numeric', hour12: false, timeZone: 'UTC' })
                    : t0.toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });

                const div = document.createElement('div');
                div.className = 'tl-col';
                div.style.width = `var(--tl-col-w)`;
                div.textContent = label;
                elHeader.appendChild(div);
            }

            //  elHeader.style.width = 'auto';




            // [ANCHOR TL-DAYBAR] — строка дня (prev|current|next) поверх часов
            let daybar = elHeader.querySelector('.tl-daybar');
            if (!daybar) {
                daybar = document.createElement('div');
                daybar.className = 'tl-daybar';
                elHeader.prepend(daybar); // кладём выше часов
            }
            daybar.innerHTML = '';

            if (state.view === 'day') {
                const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
                const dayW = state.colCount * colW;

                // три дня: вчера | сегодня | завтра
                const mid = Math.floor(VISIBLE_DAY_SPAN / 2);

                // генерируем массив начал суток: …, D-2, D-1, D0(сегодня), D+1, D+2, …
                const starts = Array.from({ length: VISIBLE_DAY_SPAN }, (_, i) =>
                    addMs(start, (i - mid) * state.rangeMs)
                );



                // EN: "October 1, 2025"
                const fmtEnLong = d =>
                    d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

                // рамки суток (по ширине dayW)
                starts.forEach(() => {
                    const box = document.createElement('div');
                    box.className = 'tl-daybox';
                    box.style.width = `${dayW - 2}px`; // -2, чтобы бордер попадал в сетку
                    daybar.appendChild(box);
                });

                // подписи (липнем в positionDayTags)
                starts.forEach(d => {
                    const t = document.createElement('div');
                    t.className = 'tl-daytag';
                    t.textContent = fmtEnLong(d);
                    daybar.appendChild(t);
                });

                // сразу выставить позиции
                positionDayTags();
            } else {
                daybar.innerHTML = '';
            }

            // строки сетки
            elBody.innerHTML = '';
            resources.forEach((r, ri) => {
                const row = document.createElement('div');   // ← создать строку
                row.className = 'tl-row';
                const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
                const colsForRow = state.colCount * VISIBLE_DAY_SPAN; // тройной буфер для любого режима


                for (let i = 0; i < colsForRow; i++) {
                    const cell = document.createElement('div');
                    cell.className = 'tl-cell';
                    row.appendChild(cell);
                }

                const rowEvents = byType.get(r) || [];

                // [ANCHOR TL-LANES] — раскладка пересечений по «дорожкам»
                // Сортируем по старту, укладываем в первую свободную «дорогу» (где end <= start)
                const evs = rowEvents
                    .map((ev, i) => ({ ...ev, _i: i }))
                    .sort((a, b) => a.start - b.start);

                const laneEnds = []; // lane -> lastEnd
                const placed = [];   // {ev, lane}

                for (const ev of evs) {
                    let lane = 0;
                    while (lane < laneEnds.length && laneEnds[lane] > ev.start) lane++;
                    laneEnds[lane] = ev.end;
                    placed.push({ ev, lane });
                }

                // Высота «дорожки»: 21px бар + 2px зазор = 23px
                const LANE_H = 23;

                // Между разными типами делаем чуть больший зазор (сумма: верх+низ)
                const V_PAD = 14;

                const lanesUsed = laneEnds.length || 1;
                const rowPx = V_PAD + lanesUsed * LANE_H;
                // Жёстко задаём высоту конкретной .tl-row (у тебя разные строки могут иметь разную высоту)
                row.style.height = rowPx + 'px';

                // Синхронизируем высоту левой ячейки этого типа:
                const resItem = elRes.querySelector(`.tl-res-item[data-res="${CSS.escape(r)}"]`);
                if (resItem) resItem.style.height = rowPx + 'px';

                placed.forEach(({ ev, lane }) => {
                    const a = clamp(ev.start, start3, end3);
                    const b = clamp(ev.end, start3, end3);
                    const leftPx = ((a - start3) / state.colMs) * colW;
                    const width = Math.max(8, ((b - a) / state.colMs) * colW);

                    const badge = document.createElement('div');
                    badge.className = 'tl-event';
                    badge.style.left = `${leftPx}px`;
                    badge.style.width = `${width}px`;

                    // фиксированный цвет из типа
                    const bg = colorForType(ev.type);
                    badge.style.background = bg;
                    badge.style.color = '#fff';
                    // передаём lane в CSS
                    badge.style.setProperty('--lane', lane);

                    const hasSegs = Array.isArray(ev.segments) && ev.segments.length;
                    const segHtml = hasSegs ? `
      <button class="pp-seg-btn" type="button" aria-label="Segments">▾</button>
      <div class="pp-seg-pop" hidden>
        ${ev.segments.map(s => {
                        const exts = (ev.externalsBySegment && ev.externalsBySegment[s]) ? ev.externalsBySegment[s] : [];
                        return `<div class="seg"><code>${s}</code>${exts.length ? `<div class="ext">${exts.map(e => `<div><code>${e}</code></div>`).join('')}</div>` : ''
                            }</div>`;
                    }).join('')}
      </div>` : '';

                    badge.innerHTML = `<span class="txt">${escapeHtml(ev.title || '')}</span>${segHtml}`;
                    row.appendChild(badge);

                    const txtEl = badge.querySelector('.txt');
                    // текст должен уметь сжиматься внутри flex-контейнера бара
                    if (txtEl) {
                        txtEl.style.minWidth = '0';

                        // [PROMO/LIVEOPS TITLE SAFETY]
                        // В Promotions по багу иногда "исчезает" текст в баре,
                        // хотя dataset.title и поповер показывают его корректно.
                        // Жёстко восстанавливаем текст и делаем его видимым инлайном.
                        txtEl.textContent = (ev.title || '').toString();
                        txtEl.style.display = 'block';
                        txtEl.style.opacity = '1';
                        txtEl.style.visibility = 'visible';
                        txtEl.style.color = '#fff';
                        txtEl.style.webkitTextFillColor = '#fff';
                        txtEl.style.position = 'sticky';
                        txtEl.style.left = '0';
                        txtEl.style.zIndex = '2';
                        txtEl.style.whiteSpace = 'nowrap';
                        txtEl.style.overflow = 'hidden';
                        txtEl.style.textOverflow = 'ellipsis';
                    }



                    // ⬇️ прокинем данные для поповера (UTC)
                    badge.dataset.title = ev.title || '';
                    badge.dataset.type = ev.type || 'none';
                    badge.dataset.startUtc = fmtUTC(ev.start);
                    badge.dataset.endUtc = fmtUTC(ev.end);

                    // NEW: условия и сегменты в dataset для попапа
                    try {
                        badge.dataset.conditions = JSON.stringify(Array.isArray(ev.conditions) ? ev.conditions : []);
                    } catch { badge.dataset.conditions = '[]'; }

                    try {
                        badge.dataset.segments = JSON.stringify(Array.isArray(ev.segments) ? ev.segments : []);
                    } catch { badge.dataset.segments = '[]'; }




                    if (hasSegs) {
                        const btn = badge.querySelector('.pp-seg-btn');
                        const pop = badge.querySelector('.pp-seg-pop');
                        btn?.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const hidden = pop.hasAttribute('hidden');
                            if (hidden) pop.removeAttribute('hidden'); else pop.setAttribute('hidden', '');
                        });
                    }
                });



                elBody.appendChild(row);
            });

            // индикатор «сейчас» (day/week) + липкий бейдж времени в верхней шкале
            // убираем предыдущую линию и бейдж
            elBody.querySelector('.tl-now')?.remove();

            // ищем верхнюю шкалу часов (липкий хедер внутри .pp-cal-main)
            // elHeader уже есть выше по коду и указывает на заголовок/шапку грида
            // в нём находится .pp-cal-scale.top
            const topScale = elHeader?.querySelector('.pp-cal-scale.top') || elHeader;

            // чистим старый бейдж в шапке, если был
            topScale?.querySelector('.pp-now-badge')?.remove();

            const now = new Date();

            const pad2 = n => String(n).padStart(2, '0');
            // теперь показываем часы:минуты:секунды + суффикс UTC
            const utcHHmm = (d) => {
                const hh = pad2(d.getUTCHours());
                const mm = pad2(d.getUTCMinutes());
                const ss = pad2(d.getUTCSeconds());
                return `${hh}:${mm}:${ss} UTC`;
            };

            if (state.view !== 'month' && now >= start3 && now <= end3) {
                const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
                const x = ((now - start3) / state.colMs) * colW;

                // вертикальная красная линия — остаётся в теле полотна
                const nowEl = document.createElement('div');
                nowEl.className = 'tl-now pp-cal-now';
                nowEl.style.left = `${x}px`;
                // высоту линии равняем высоте полотна (учтёт верх/низ шкал)
                nowEl.style.setProperty('--pp-now-h', elBody.scrollHeight + 'px');
                // прокидываем текст на случай, если где-то ещё используется ::before
                nowEl.setAttribute('data-time', utcHHmm(now));
                elBody.appendChild(nowEl);

                // новый липкий бейдж в верхней шкале
                if (topScale) {
                    const badge = document.createElement('div');
                    badge.className = 'pp-now-badge';
                    badge.textContent = utcHHmm(now);
                    // позиционируем по той же X-координате, что и линия
                    badge.style.left = `${x}px`;
                    topScale.appendChild(badge);
                }
            }


            elRes.style.height = 'auto';
            elRes.style.transform = '';

            // === Выбранное пользователем время (Picked) =========================
            // Удалим прошлые элементы, если есть
            elBody.querySelector('.tl-picked')?.remove();
            topScale?.querySelector('.pp-picked-badge')?.remove();
            topScale?.querySelector('.pp-picked-btn')?.remove();

            if (Number.isFinite(state.pickedMs)) {
                const picked = new Date(state.pickedMs);
                // окно 3-диапазона в этом рендере уже посчитано выше:
                // start3 / end3 — левая и правая границы тройного холста
                if (picked >= start3 && picked <= end3) {
                    const colW2 = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
                    const xPick = ((picked - start3) / state.colMs) * colW2;

                    // вертикальная голубая линия во всём теле таймлайна
                    // const pickEl = document.createElement('div');
                    // pickEl.className = 'tl-picked';
                    // pickEl.style.left = `${xPick}px`;
                    // // высота линии = вся прокручиваемая высота тела
                    // pickEl.style.setProperty('--pp-pick-h', elBody.scrollHeight + 'px');
                    // elBody.appendChild(pickEl);

                    // // липкий бейдж в верхней шкале
                    // if (topScale) {
                    //     const hh = String(picked.getUTCHours()).padStart(2, '0');
                    //     const mm = String(picked.getUTCMinutes()).padStart(2, '0');

                    //     const badge = document.createElement('div');
                    //     badge.className = 'pp-picked-badge';
                    //     badge.textContent = `${hh}:${mm} UTC`;
                    //     badge.style.left = `${xPick}px`;
                    //     topScale.appendChild(badge);

                    //     // круглая синяя кнопка «табличка» над выбранной линией
                    //     const btn = document.createElement('button');
                    //     btn.type = 'button';
                    //     btn.className = 'pp-picked-btn';
                    //     // используем data-hint вместо title, чтобы подсказка показывалась мгновенно
                    //     btn.setAttribute('data-hint', 'Show active events in the table');
                    //     btn.setAttribute('aria-label', 'Show active events in the table');
                    //     btn.style.left = `${xPick}px`;

                    //     // --- DRAG: тянем и линию, и кнопку (визуально двигаем; потом центрируем) ---
                    //     const ui = { pickEl, btnEl: btn, badgeEl: badge, start3, xPick };
                    //     btn.addEventListener('pointerdown', (ev) => beginPickedDrag(ev, ui));
                    //     pickEl.addEventListener('pointerdown', (ev) => beginPickedDrag(ev, ui));

                    //     // кликом по кнопке фильтруем таблицу по выбранному моменту
                    //     btn.addEventListener('click', (ev) => {
                    //         // если это “эхо-клик” после drag — гасим один раз
                    //         if (btn._ppSuppressClickOnce) {
                    //             btn._ppSuppressClickOnce = false;
                    //             ev.preventDefault();
                    //             ev.stopPropagation();
                    //             return;
                    //         }

                    //         ev.preventDefault();
                    //         ev.stopPropagation();

                    //         const ts = state.pickedMs;
                    //         if (!Number.isFinite(ts)) return;

                    //         document.dispatchEvent(new CustomEvent('pp:filterByTime', { detail: { ts } }));
                    //     });


                    //     topScale.appendChild(btn);
                    // }


                    // вертикальная голубая линия во всём теле таймлайна
                    const pickEl = document.createElement('div');
                    pickEl.className = 'tl-picked';
                    pickEl.style.left = `${xPick}px`;
                    // высота линии = вся прокручиваемая высота тела
                    pickEl.style.setProperty('--pp-pick-h', elBody.scrollHeight + 'px');
                    elBody.appendChild(pickEl);

                    // липкий бейдж в верхней шкале
                    if (topScale) {
                        const hh = String(picked.getUTCHours()).padStart(2, '0');
                        const mm = String(picked.getUTCMinutes()).padStart(2, '0');

                        const badge = document.createElement('div');
                        badge.className = 'pp-picked-badge';
                        badge.textContent = `${hh}:${mm} UTC`;
                        badge.style.left = `${xPick}px`;
                        topScale.appendChild(badge);

                        // круглая синяя кнопка «табличка» над выбранной линией
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'pp-picked-btn';
                        // используем data-hint вместо title, чтобы подсказка показывалась мгновенно
                        btn.setAttribute('data-hint', 'Show active promotions in the table');
                        btn.setAttribute('aria-label', 'Show active promotions in the table');
                        btn.style.left = `${xPick}px`;

                        // общий контекст для drag
                        const ui = { pickEl, btnEl: btn, badgeEl: badge, start3, xPick };

                        // drag по кнопке
                        btn.addEventListener('pointerdown', (ev) => beginPickedDrag(ev, ui), true);

                        // drag по линии
                        pickEl.addEventListener('pointerdown', (ev) => beginPickedDrag(ev, ui), true);

                        // кликом по кнопке фильтруем таблицу по выбранному моменту
                        btn.addEventListener('click', (ev) => {
                            // если это “клик” после drag — игнорируем один раз
                            if (btn._suppressClick) { btn._suppressClick = false; return; }

                            ev.preventDefault();
                            ev.stopPropagation();
                            const ts = state.pickedMs;
                            if (!Number.isFinite(ts)) return;

                            document.dispatchEvent(new CustomEvent('pp:filterByTime', {
                                detail: { ts }
                            }));
                        });

                        topScale.appendChild(btn);
                    }

                }
            }


            // [ANCHOR TL-HEADER-WIDTH:SYNC] — шапку делаем ровно ширине фактического полотна
            elHeader.style.width = elBody.scrollWidth + 'px';


            // высота верхней шкалы — для позиционирования бейджа (см. CSS var(--pp-scale-h))
            elBody.style.setProperty('--pp-scale-h', (elHeader?.clientHeight || 32) + 'px');


            // [FIX-HEADER-ALIGN:RENDER] — сдвинуть шапку сразу, без ожидания первого scroll
            elHeader.style.transform = `translateX(${-elBody.scrollLeft}px)`;


            // --- [ANCHOR TL-STICKY-FIX] страхуем "липкость" заголовков на горизонтальном скролле
            const syncStickyTitles = () => {
                const body = elBody; // тот же #ppCal .tl-grid-body
                const sx = body.scrollLeft;

                body.querySelectorAll('.tl-event').forEach(bar => {
                    const txt = bar.querySelector('.txt');
                    if (!txt) return;
                    // Без «липкости»: всегда показываем текст там, где он отрендерен
                    txt.style.transform = '';
                });
            };

            // при скролле и после рендера
            elBody.addEventListener('scroll', syncStickyTitles);
            syncStickyTitles();


            // окно слева той же высоты, что видимое полотно
            elRes.style.height = `${elBody.clientHeight}px`;

            // смещаем содержимое списка на тот же scrollTop полотна
            //elRes.style.transform = `translateY(${-elBody.scrollTop}px)`;

            const dpr = window.devicePixelRatio || 1;
            const y0 = Math.round(elBody.scrollTop * dpr) / dpr;
            elRes.style.transform = `translate3d(0, ${-y0}px, 0)`;

            // [ANCHOR TL-GRID-OFFSET:RENDER]
            updateGridOffset();
        }

        setView(state.view);
        render();
        positionDayTags();
        updateGridOffset();

        /* --- [FIX INITIAL FIRST-PAINT] — гарантируем, что шапка (часы/дни) появится при первом входе --- */
        (function ensureHeaderIsPainted() {
            const body = elBody;
            const header = elHeader;

            function syncHeaderNow() {
                // ширина шапки = фактическая ширина полотна
                header.style.width = body.scrollWidth + 'px';
                // сдвигаем шапку сразу, чтобы не ждать первого scroll
                header.style.transform = `translateX(${-body.scrollLeft}px)`;
                // смещения тайловой сетки + подписи дней
                updateGridOffset();
                positionDayTags();

                // маленький «пинок» отрисовке: реальное изменение scrollLeft на 1px туда-обратно
                const sx = body.scrollLeft;
                body.scrollLeft = sx + 1;
                body.scrollLeft = sx;

                // и на всякий случай уведомим слушателей
                body.dispatchEvent(new Event('scroll'));
            }

            // Если элемент уже имеет ширину и содержимое — синхронизируем немедленно.
            // Иначе — ждём первого кадра / появления размеров.
            if (body.clientWidth > 0 && body.scrollWidth > 0) {
                requestAnimationFrame(syncHeaderNow);
                return;
            }

            // 1) Первый кадр после вставки в DOM
            requestAnimationFrame(() => {
                if (body.clientWidth > 0 && body.scrollWidth > 0) {
                    syncHeaderNow();
                    return;
                }

                // 2) Если всё ещё 0 (например, контейнер скрыт во вкладке), подключаем ResizeObserver один раз
                const ro = new ResizeObserver(() => {
                    if (body.clientWidth > 0 && body.scrollWidth > 0) {
                        syncHeaderNow();
                        ro.disconnect();
                    }
                });
                ro.observe(body);
            });
        })();

        /* [FIX INITIAL-HEADER-SYNC] — гарантируем прорисовку шапки и daybar на первом кадре */
        requestAnimationFrame(() => {
            // 1) ширина шапки = фактическая ширина полотна
            elHeader.style.width = elBody.scrollWidth + 'px';

            // 2) сразу синхронизируем смещение шапки со scrollLeft
            elHeader.style.transform = `translateX(${-elBody.scrollLeft}px)`;

            // 3) сетка + подписи
            updateGridOffset();
            positionDayTags();

            // 4) реальное изменение scrollLeft на 1px туда-обратно (заставляет sticky-слой отрисоваться)
            const _sx = elBody.scrollLeft;
            elBody.scrollLeft = _sx + 1;
            elBody.scrollLeft = _sx;

            // 5) резервный «пинок» слушателям
            elBody.dispatchEvent(new Event('scroll'));
        });


        // [ANCHOR TL-CENTER-DAY] — центрируем «сейчас» (UTC) при первом входе (надёжно, после лейаута)
        // [ANCHOR TL-CENTER-DAY] — центрируем «сейчас» (UTC) при первом входе (надёжно, после лейаута)
        if (!state._centeredOnce && state.view === 'day') {
            const doCenter = () => {
                const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
                if (colW <= 0 || elBody.clientWidth === 0) return false;

                const now = new Date();
                const xFromStart = ((now - state.anchor) / state.colMs) * colW;

                const halfVisible = Math.floor(VISIBLE_DAY_SPAN / 2);
                const dayW = state.colCount * colW;
                const offsetToMiddle = halfVisible * dayW;

                // целевой scrollLeft, ЗАКЛЕМПЛЕННЫЙ в [0 .. maxScroll]
                const desired = offsetToMiddle + xFromStart - elBody.clientWidth / 2;
                const maxScroll = Math.max(0, elBody.scrollWidth - elBody.clientWidth);
                const xTarget = Math.max(0, Math.min(desired, maxScroll));

                const prev = allowSeamShift;
                allowSeamShift = false;
                elBody.scrollLeft = xTarget;
                state._centeredOnce = true;

                elHeader.style.width = elBody.scrollWidth + 'px';
                elHeader.style.transform = `translateX(${-elBody.scrollLeft}px)`;
                updateGridOffset();
                positionDayTags();

                allowSeamShift = prev;
                elBody.dispatchEvent(new Event('scroll'));
                allowSeamShift = true;

                return true;
            };
            // 1) Пытаемся сразу...
            if (!doCenter()) {
                requestAnimationFrame(() => {
                    if (!doCenter()) {
                        const ro = new ResizeObserver(() => { if (doCenter()) ro.disconnect(); });
                        ro.observe(elBody);
                    }
                });
            }
        }






        // подстроить высоту левой колонки под высоту тела при ресайзе
        window.addEventListener('resize', () => {
            elRes.style.height = `${elBody.clientHeight}px`;
        });

        // [ANCHOR TL-NOW-TICK] — поддержка «сейчас» без полного ререндера (UTC, секунды в рантайме)
        (function wireNowTick() {
            // заменяем минутный/RAF тик на строгий секундный
            let secTimer = null;
            let alignTO = null;

            // Создаём/получаем липкий бейдж в верхней шкале
            function ensureTopBadge() {
                const topScale = elHeader?.querySelector('.pp-cal-scale.top') || elHeader;
                if (!topScale) return null;
                let b = topScale.querySelector('.pp-now-badge');
                if (!b) {
                    b = document.createElement('div');
                    b.className = 'pp-now-badge';
                    topScale.appendChild(b);
                }
                return b;
            }
            function removeTopBadge() {
                const topScale = elHeader?.querySelector('.pp-cal-scale.top') || elHeader;
                topScale?.querySelector('.pp-now-badge')?.remove();
            }

            const pad2 = n => String(n).padStart(2, '0');
            // часы:минуты:секунды + суффикс UTC
            const utcHHmm = (d) => {
                const hh = pad2(d.getUTCHours());
                const mm = pad2(d.getUTCMinutes());
                const ss = pad2(d.getUTCSeconds());
                return `${hh}:${mm}:${ss} UTC`;
            };

            function updateNow() {
                const now = Date.now();

                // подготовим границы текущего видимого интервала
                // подготовим границы текущего видимого интервала (берём ГЛОБАЛЬНЫЙ буфер)
                const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
                const halfVisible = Math.floor(VISIBLE_DAY_SPAN / 2);

                // Мы реально рендерим start3..end3 длиной state.rangeMs * VISIBLE_DAY_SPAN
                const startBase = (state.view === 'day')
                    ? addMs(state.anchor, -halfVisible * state.rangeMs)
                    : state.anchor;

                const totalMs = (state.view === 'day')
                    ? state.rangeMs * VISIBLE_DAY_SPAN
                    : state.rangeMs;

                const endBase = addMs(startBase, totalMs);


                let nowEl = elBody.querySelector('.tl-now');
                if (!(now >= startBase && now <= endBase) || state.view === 'month') {
                    if (nowEl) nowEl.remove();
                    removeTopBadge();
                    return;
                }
                if (!nowEl) {
                    nowEl = document.createElement('div');
                    nowEl.className = 'tl-now pp-cal-now';
                    elBody.appendChild(nowEl);
                }

                // X-позиция линии
                const x = ((now - startBase) / state.colMs) * colW;
                nowEl.style.left = `${x}px`;

                // Высота — на весь контент
                nowEl.style.top = '0px';
                nowEl.style.bottom = '';
                nowEl.style.height = elBody.scrollHeight + 'px';

                // Обновляем подписи (UTC с секундами)
                const label = utcHHmm(new Date(now));
                nowEl.setAttribute('data-time', label);

                const badge = ensureTopBadge();
                if (badge) {
                    badge.textContent = label;
                    badge.style.left = `${x}px`;
                }
            }

            function startSecTick() {
                // очистка предыдущих таймеров
                if (secTimer) { clearInterval(secTimer); secTimer = null; }
                if (alignTO) { clearTimeout(alignTO); alignTO = null; }

                // первичный апдейт
                updateNow();

                // выравниваемся к следующей границе секунды, затем тикаем каждую секунду
                const now = new Date();
                const delay = 1000 - now.getUTCMilliseconds();
                alignTO = setTimeout(() => {
                    updateNow();
                    secTimer = setInterval(updateNow, 1000);
                }, Math.max(0, delay));
            }

            // Запускаем, когда лэйаут готов (есть ширины и шаг по времени)
            (function runWhenReady() {
                const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW || 0;
                const ready = colW > 0 && (state && typeof state.colMs === 'number' && state.colMs > 0) && elBody.scrollWidth > 0;
                if (!ready) { requestAnimationFrame(runWhenReady); return; }
                startSecTick();
            })();

            // Возвращаемся во вкладку — пересинхронизируемся по секундам
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') startSecTick();
            });

            // Поддержка высоты линии при ресайзе
            window.addEventListener('resize', () => {
                const n = elBody.querySelector('.tl-now');
                if (n) n.style.height = elBody.scrollHeight + 'px';
            });
        })();

        function updateGridOffset() {
            // Сетка привязана к контенту, смещений относительно вьюпорта больше нет
            (elGrid || elBody).style.setProperty('--tl-grid-off', '0px');
        }


        // [ANCHOR TL-HEADER-SYNC]
        elBody.addEventListener('scroll', () => {
            // горизонтальный parallax шапки часов
            elHeader.style.transform = `translateX(${-elBody.scrollLeft}px)`;

            // [FIX SNAP TO PIXEL] — убираем дрожь по Y и синхронизируем левую колонку
            const dpr = window.devicePixelRatio || 1;
            const y = Math.round(elBody.scrollTop * dpr) / dpr;
            elRes.style.transform = `translateY(${-y}px)`;

            positionDayTags();
            updateGridOffset();

            // === [SEAM SHIFT] бесконечный горизонтальный скролл для любого view ===
            // Подходя к краю тройного окна, сдвигаем anchor на ширину БАЗОВОГО диапазона (day|week|month)
            // и компенсируем scrollLeft, чтобы мировая позиция сохранилась.
            if (allowSeamShift) {
                const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;

                // ширина ОДНОГО базового диапазона в px:
                // day: 24 колонки; week: 7 колонок; month: 6 «недельных» колонок (по 7 дней)
                const spanW = state.colCount * colW;

                const maxLeft = Math.max(0, elBody.scrollWidth - elBody.clientWidth);
                const thresh = Math.min(spanW * 0.15, 200); // «зона шва»: 15% или не более 200px

                // Левый край — уходим на один базовый диапазон назад
                if (elBody.scrollLeft <= thresh) {
                    const oldLeft = elBody.scrollLeft;
                    const prev = allowSeamShift;
                    allowSeamShift = false; // не триггерим себя же
                    state.anchor = addMs(state.anchor, -state.rangeMs);
                    render();
                    elBody.scrollLeft = oldLeft + spanW; // восстановить мировую позицию
                    allowSeamShift = prev;
                }
                // Правый край — уходим на один базовый диапазон вперёд
                else if ((maxLeft - elBody.scrollLeft) <= thresh) {
                    const oldLeft = elBody.scrollLeft;
                    const prev = allowSeamShift;
                    allowSeamShift = false;
                    state.anchor = addMs(state.anchor, +state.rangeMs);
                    render();
                    elBody.scrollLeft = Math.max(0, oldLeft - spanW);
                    allowSeamShift = prev;
                }
            }



            // ЛЁГКИЙ РЕЖИМ: во время прокрутки НЕ делаем полный render(),
            // чтобы не мигали события и список типов слева.
            // Делаем его отложенно, если пользователь перестал крутить.
            if (_scrollRenderTimer) clearTimeout(_scrollRenderTimer);
            _scrollRenderTimer = setTimeout(() => {
                render(); // один раз после паузы
            }, RENDER_IDLE_MS);
        }, { passive: true });



        /* === [ANCHOR TL-INFO-DELEGATE] поповер по клику по бару =================== */
        function fmtUTC(d) {
            if (!(d instanceof Date)) return '—';
            const pad = n => String(n).padStart(2, '0');
            return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
        }


        function closeInfoPops() {
            // было: elBody.querySelectorAll('.tl-info-pop').forEach(n => n.remove());
            document.querySelectorAll('.tl-info-pop').forEach(n => n.remove());
        }


        /**
         * ЖЁСТКИЙ перехват кликов: capture + stopImmediatePropagation.
         * Любой клик по .tl-event (в любой точке бара) открывает поповер в месте клика.
         * Старые хендлеры и «правая кромка» игнорируются.
         */
        function onBarClickCapture(e) {
            const bar = e.target.closest('.tl-event');
            if (!bar) return;

            // Перехват — никого дальше не пускаем
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();

            // Если этот клик пришёл сразу после закрытия попапа — НЕ открываем заново
            if (state._preventInfoOpen) {
                state._preventInfoOpen = false; // «съедаем» одноразовый флаг
                return;
            }

            // Если попап уже открыт — этот клик должен ТОЛЬКО закрыть его (без открытия нового)
            if (document.querySelector('.tl-info-pop')) {
                state._preventInfoOpen = true;
                closeInfoPops();
                setTimeout(() => { state._preventInfoOpen = false; }, 0);
                return;
            }

            // Данные
            const title = bar.dataset.title || (bar.querySelector('.txt')?.textContent?.trim()) || '—';
            // Берём тип с самого бара, а если по какой-то причине его нет — с контейнера строки.
            // Никакого toLowerCase: хотим как в инфопанели — с заглавными буквами.
            const type = (bar.dataset.type || bar.closest('.pp-cal-row')?.dataset.type || '—');
            const startU = bar.dataset.startUtc || '—';
            const endU = bar.dataset.endUtc || '—';


            // Поповер
            const pop = document.createElement('div');
            pop.className = 'tl-info-pop';
            /* позиционируем относительно контейнера таймлайна */
            pop.style.position = 'fixed';
            pop.style.minWidth = '240px';
            pop.style.maxWidth = '420px';
            pop.style.padding = '10px 12px';
            pop.style.border = '1px solid var(--border, #334155)';
            pop.style.borderRadius = '10px';
            pop.style.background = 'var(--btn-n-field-bg, rgba(20,20,20,.92))';
            pop.style.boxShadow = '0 10px 28px rgba(0,0,0,.35)';
            pop.style.zIndex = '5000';
            pop.style.pointerEvents = 'auto';
            pop.style.visibility = 'hidden';

            let conds = [];
            try { conds = JSON.parse(bar.dataset.conditions || '[]'); } catch { conds = []; }
            const condHtml = conds.length
                ? conds.map(c => `<div><code>${escapeHtml(String(c))}</code></div>`).join('')
                : '—';

            pop.innerHTML = `
  <div class="pop-head" style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:700;margin-bottom:6px;word-break:break-word;">
    <span class="txt" style="flex:1 1 auto;min-width:0;">${escapeHtml(title)}</span>
    <span class="pp-title-actions" style="display:inline-flex;gap:6px;">
      <button class="pp-ico js-open-in-table" type="button" data-hint="Open in table" aria-label="Open in table"
        style="position:relative;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;border:1px solid var(--border,#d1d5db);background:var(--btn-n-field-bg,#fff);cursor:pointer;">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" ry="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <path d="M3 10h18M3 14h18" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <path d="M9 4v16M15 4v16" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
      </button>
      <button class="pp-ico js-copy-title" type="button" data-hint="Copy" aria-label="Copy name"
        style="position:relative;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;border:1px solid var(--border,#d1d5db);background:var(--btn-n-field-bg,#fff);cursor:pointer;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 9h11v11H9V9zm-5 5V4h11" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>
    </span>
  </div>

 <div style="display:grid;grid-template-columns:110px 1fr;gap:8px;font-size:12px;line-height:1.25;">
    <span class="k" style="color:var(--muted,#9aa0a6)">type:</span><span class="v">${escapeHtml(type)}</span>
    <span class="k" style="color:var(--muted,#9aa0a6)">start (UTC):</span><span class="v">${escapeHtml(startU)}</span>
    <span class="k" style="color:var(--muted,#9aa0a6)">end (UTC):</span><span class="v">${escapeHtml(endU)}</span>
    <span class="k" style="color:var(--muted,#9aa0a6)">conditions:</span><span class="v">${condHtml}</span>
  </div>
`;


            // Монтируем в body и считаем позицию относительно БАРА,
            // зажимая попап в границы видимой части календаря

            // Монтируем в тело таймлайна и считаем позицию относительно БАРА,
            // зажимая попап в границы видимой части календаря
            // Монтируем во <body> и ставим ПО КООРДИНАТАМ КЛИКА
            // Монтируем в body и ставим ПО КООРДИНАТАМ СТРАНИЦЫ,
            // чтобы попап оставался в том же месте при скролле
            document.body.appendChild(pop);

            const GAP = 12;

            requestAnimationFrame(() => {
                // габариты попапа
                const r = pop.getBoundingClientRect();

                // текущие границы видимого вьюпорта в координатах страницы
                const vpLeft = window.pageXOffset;
                const vpTop = window.pageYOffset;
                const vpRight = vpLeft + window.innerWidth;
                const vpBottom = vpTop + window.innerHeight;

                // базовые координаты — от точки клика в КООРДИНАТАХ СТРАНИЦЫ
                let left = e.pageX + GAP;
                let top = e.pageY + GAP;

                // при открытии — не вылезать за край текущего вьюпорта
                if (left + r.width > vpRight - 8) left = Math.max(vpLeft + 8, vpRight - r.width - 8);
                if (top + r.height > vpBottom - 8) top = Math.max(vpTop + 8, vpBottom - r.height - 8);

                // минимальные отступы от левого/верхнего краёв видимой области
                left = Math.max(vpLeft + 8, left);
                top = Math.max(vpTop + 8, top);

                pop.style.left = Math.round(left) + 'px'; // абсолютные координаты документа
                pop.style.top = Math.round(top) + 'px';
                pop.style.visibility = 'visible';
            });




            // --- actions ---
            // --- actions ---
            const openBtn = pop.querySelector('.js-open-in-table');
            const copyBtn = pop.querySelector('.js-copy-title');
            // открыть в таблице (через централизованный обработчик таблицы)
            openBtn?.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                document.dispatchEvent(new CustomEvent(OPEN_IN_TABLE_EVENT, { detail: { title: title || '' } }));
                closeInfoPops();
            });

            copyBtn?.addEventListener('click', async (ev) => {
                ev.preventDefault(); ev.stopPropagation();
                const text = title || '';
                try {
                    await navigator.clipboard.writeText(text);
                    const prev = copyBtn.getAttribute('data-hint');
                    copyBtn.setAttribute('data-hint', 'Copied!');
                    setTimeout(() => copyBtn.setAttribute('data-hint', prev || 'Copy'), 900);
                } catch {
                    const ta = document.createElement('textarea');
                    ta.value = text; document.body.appendChild(ta); ta.select();
                    document.execCommand('copy'); document.body.removeChild(ta);
                }
            });


        }

        // 1) Вешаем ПЕРЕХВАТ на elBody (capture: true)
        elBody.addEventListener('click', onBarClickCapture, true);

        // 2) Закрытие по клику вне попапа/бара (capture: true, чтобы сработало раньше любых других)
        document.addEventListener('click', (e) => {
            const insideBar = e.target.closest('.tl-event');
            const insidePop = e.target.closest('.tl-info-pop');
            if (!insideBar && !insidePop) closeInfoPops();
        }, true);

        // 3) Закрываем поповер при скролле таймлайна (чтобы не «висел»)
        elBody.addEventListener('scroll', closeInfoPops, { passive: true });


        // утилиты
        function addMs(d, ms) { return new Date(d.getTime() + ms); }
        function clamp(d, min, max) { return (d < min) ? min : (d > max) ? max : d; }
        function startOfDayUTC_Date(d) { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); return x; }
        function escapeHtml(s) { return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

        // локальная полночь (текущего пользователя), приведённая к UTC-инстанту
        function startOfLocalDayAsUTC(now = new Date()) {
            const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            return new Date(localMidnight.getTime() + now.getTimezoneOffset() * 60000);
        }

        // НАЧАЛО СУТОК ПО UTC (правильный якорь для календаря)
        function startOfUTCDay(d = new Date()) {
            return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        }


        function formatTitle(d, view) {
            const tz = { timeZone: 'UTC' };
            if (view === 'day') {
                return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', ...tz });
            }
            if (view === 'week') {
                // теперь это «3 days»: d..d+2
                const e = addMs(d, 2 * 24 * 3600_000);
                const a = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...tz });
                const b = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...tz });
                return `${a} – ${b}`;
            }
            if (view === 'month') {
                // теперь это «week»: показываем диапазон недели d..d+6
                const e = addMs(d, 6 * 24 * 3600_000);
                const a = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', ...tz });
                const b = e.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', ...tz });
                return `${a} – ${b}`;
            }
            return '';
        }



        // позиция заголовков дня: центр пока вписывается в границы дня
        function positionDayTags() {
            const daybar = elHeader.querySelector('.tl-daybar');
            if (!daybar || state.view !== 'day') return;

            // ширина колонки и суток
            const colW = parseFloat(getComputedStyle(elBody).getPropertyValue('--tl-col-w')) || state.colW;
            const dayW = state.colCount * colW;

            // видимая ширина календаря и текущий скролл
            const viewW = elBody.clientWidth;
            const scrollX = elBody.scrollLeft;

            // три непрерывных дня, которые мы отрисовываем в шапке (координаты КОНТЕНТА!)
            const blocksLeft = Array.from({ length: VISIBLE_DAY_SPAN }, (_, i) => i * dayW);


            const EDGE = 6; // небольшой внутренний отступ от рамки

            const boxes = Array.from(daybar.querySelectorAll('.tl-daybox'));
            const tags = Array.from(daybar.querySelectorAll('.tl-daytag'));

            // рамки «пришиваем» к своим суткам — координаты контента, НИЧЕГО не вычитаем
            boxes.forEach((box, i) => {
                const L = blocksLeft[i];
                box.style.left = `${L + 1}px`;       // +1, чтобы бордер лег внутрь
                box.style.width = `${dayW - 2}px`;
            });

            // подпись дня: «впереди слева → залипла по центру экрана → прибита к правому краю своего дня»
            tags.forEach((tag, i) => {
                const tagW = tag.offsetWidth || 0;

                // границы СВОЕГО дня (контент)
                const L = blocksLeft[i];
                const R = L + dayW;

                // желаемый X в координатах КОНТЕНТА, чтобы визуально стоять в центре экрана
                // (учитываем, что вся шапка сдвинута на -scrollX transform-ом)
                const desiredCenterContent = scrollX + (viewW - tagW) / 2;

                // клэмпим по своему блоку + внутренний отступ
                const x = Math.max(L + EDGE, Math.min(R - tagW - EDGE, desiredCenterContent));
                tag.style.left = `${x}px`;
            });
        }


    }

    // Promotions календарь (ProfilePromotions.js) пытается вызвать window.initTimelineCalendar(...).
    // В LiveOps он есть как функция в скоупе ProfileParser.js, но без экспорта на window — поэтому Promotions остаётся пустым.
    window.initTimelineCalendar = initTimelineCalendar;

    // =================== [/TIMELINE] ===================


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

        // --- [PROMOTIONS MODULES] load JS+CSS once (since ProfileParser.html is cloned, scripts inside won't auto-run)
        await (async function ensurePromotionsModules() {
            // CSS
            const cssHref = 'ProfilePromotions.css';
            const cssHrefAlt = 'ProfileParser/ProfilePromotions.css';

            const hasCss = [...document.styleSheets].some(ss => (ss.href || '').includes('ProfilePromotions.css'));
            if (!hasCss) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = cssHref;
                link.onerror = () => { link.href = cssHrefAlt; };
                document.head.appendChild(link);
            }

            // JS
            if (window.PP_Promotions && typeof window.PP_Promotions.appendPromotionsUI === 'function') return;

            await new Promise((resolve) => {
                const s = document.createElement('script');
                s.src = 'ProfilePromotions.js';
                s.async = true;
                s.onload = resolve;
                s.onerror = () => {
                    // fallback path
                    s.remove();
                    const s2 = document.createElement('script');
                    s2.src = 'ProfileParser/ProfilePromotions.js';
                    s2.async = true;
                    s2.onload = resolve;
                    s2.onerror = resolve; // не падаем — просто промо-секция останется метой
                    document.head.appendChild(s2);
                };
                document.head.appendChild(s);
            });
        })();

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
