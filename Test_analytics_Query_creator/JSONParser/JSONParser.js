(() => {
    window.Tools = window.Tools || {};

    const state = {
        mounted: false,
        view: null,

        input: null,
        output: null,
        status: null,

        parseBtn: null,
        clearBtn: null,

        searchInput: null,
        searchBtn: null,
        clearSearchBtn: null,

        expandAllBtn: null,
        collapseAllBtn: null,

        // parsed data (kept in memory; DOM is rendered lazily)
        data: null,

        // search index (built lazily on first search)
        index: [],
        indexBuilt: false,
        indexBuilding: false,
        indexMaxItems: 60000, // perf guard
        hitPaths: [],
        hitIndex: -1,
        lastQuery: '',

        // DOM maps
        rootEl: null,                 // <details> root
        pathToEl: new Map(),          // path -> element (details / leaf row)
        currentEl: null,

        // async tasks
        expandJob: null,

        // line numbers
        renumberRaf: 0,

        // full expanded line numbers
        openLine: null,   // Map(path -> line)
        closeLine: null,  // Map(path -> line)

        // global "full expanded" line numbers (like JSON.stringify with indent)
        lineMap: new Map(),

    };

    // ===== Utilities =====

    function escapeHtml(s) {
        return String(s)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function setStatus(text, kind = 'info') {
        if (!state.status) return;
        state.status.textContent = text || '';
        state.status.dataset.kind = kind; // info | ok | err
    }

    function isObject(v) {
        return v !== null && typeof v === 'object' && !Array.isArray(v);
    }

    function typeLabel(v) {
        if (Array.isArray(v)) return `LIST[${v.length}]`;
        if (isObject(v)) return 'MAP';
        if (v === null) return 'NULL';
        if (typeof v === 'string') return 'STRING';
        if (typeof v === 'number') return 'NUMBER';
        if (typeof v === 'boolean') return 'BOOLEAN';
        return String(typeof v).toUpperCase();
    }

    function previewValue(v) {
        if (Array.isArray(v)) return '';
        if (isObject(v)) return '';
        if (v === null) return 'null';
        if (typeof v === 'string') return `"${v}"`;
        return String(v);
    }

    function valueClass(v) {
        if (v === null) return 'jp-null';
        if (Array.isArray(v)) return 'jp-arr';
        if (isObject(v)) return 'jp-obj';
        if (typeof v === 'string') return 'jp-string';
        if (typeof v === 'number') return 'jp-number';
        if (typeof v === 'boolean') return 'jp-boolean';
        return 'jp-other';
    }

    function schedule(fn) {
        // keep UI responsive
        if (typeof requestIdleCallback === 'function') {
            return requestIdleCallback(fn, { timeout: 120 });
        }
        return setTimeout(() => fn({ timeRemaining: () => 0, didTimeout: true }), 0);
    }

    function cancelSchedule(id) {
        if (typeof cancelIdleCallback === 'function') cancelIdleCallback(id);
        else clearTimeout(id);
    }

    // ===== Line numbers =====

    function requestRenumber() {
        if (!state.output) return;
        if (state.renumberRaf) return;
        state.renumberRaf = requestAnimationFrame(() => {
            state.renumberRaf = 0;
            renumberVisibleLines();
        });
    }

    function renumberVisibleLines() {
        if (!state.output) return;

        // only rendered rows (lazy tree => limited DOM)
        // IMPORTANT: line numbers must reflect the original JSON pretty-printing
        // (as if everything was expanded), NOT the currently visible DOM.
        const rows = state.output.querySelectorAll('.jp-row');
        rows.forEach((row) => {
            let ln = row.querySelector(':scope > .jp-ln');
            if (!ln) {
                ln = document.createElement('span');
                ln.className = 'jp-ln';
                row.prepend(ln);
            }
            const n = row.dataset.jpLine;
            ln.textContent = n ? String(n) : '';
        });
    }


    // ===== Parsing =====

    function tryParseJson(text) {
        // 1) strict JSON.parse
        try {
            const v = JSON.parse(text);

            // if v is a string that itself contains JSON -> parse again
            if (typeof v === 'string') {
                const t = v.trim();
                if (
                    (t.startsWith('{') && t.endsWith('}')) ||
                    (t.startsWith('[') && t.endsWith(']'))
                ) {
                    try { return JSON.parse(t); } catch (_) { }
                }
            }
            return v;
        } catch (_) { }

        // 2) wrapped JSON in quotes
        const trimmed = text.trim();
        if (
            (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
            (trimmed.startsWith('"') && trimmed.endsWith('"'))
        ) {
            const unwrapped = trimmed.slice(1, -1);
            try { return JSON.parse(unwrapped); } catch (_) { }
        }

        throw new Error('Invalid JSON. Please paste a valid JSON string/object/array.');
    }

    function buildIndex(data, maxItems) {
        const index = [];
        const stack = [{ path: '$', key: '(root)', value: data }];

        while (stack.length) {
            const { path, key, value } = stack.pop();

            // keep it short to reduce memory pressure
            let txt = `${key} ${previewValue(value)}`.trim();

            if (txt.length > 220) txt = txt.slice(0, 220);
            index.push({ path, textLower: txt.toLowerCase() });

            if (index.length >= maxItems) break;

            if (Array.isArray(value)) {
                for (let i = value.length - 1; i >= 0; i--) {
                    const p = `${path}[${i}]`;
                    stack.push({ path: p, key: `[${i}]`, value: value[i] });
                }
            } else if (isObject(value)) {
                const keys = Object.keys(value);
                for (let i = keys.length - 1; i >= 0; i--) {
                    const k = keys[i];
                    const safe = k.includes('.') ? `["${k.replaceAll('"', '\\"')}"]` : `.${k}`;
                    const p = `${path}${safe}`;
                    stack.push({ path: p, key: k, value: value[k] });
                }
            }
        }

        return index;
    }

    function ensureIndexBuilt(cb) {
        if (!state.data) return;
        if (state.indexBuilt) { cb?.(); return; }
        if (state.indexBuilding) { return; }

        state.indexBuilding = true;
        setStatus('Indexing for search…', 'info');

        // build in idle to avoid blocking
        const maxItems = state.indexMaxItems;
        schedule(() => {
            try {
                state.index = buildIndex(state.data, maxItems);
                state.indexBuilt = true;
                setStatus(
                    state.index.length >= maxItems
                        ? `Search index ready (limited to ${maxItems} nodes).`
                        : 'Search index ready.',
                    'ok'
                );
            } finally {
                state.indexBuilding = false;
                cb?.();
            }
        });
    }

    // ===== DOM Rendering (LAZY) =====

    function clearOutput() {
        if (state.output) state.output.innerHTML = '';
        state.data = null;
        setExpandButtonsDisabled(true);


        state.index = [];
        state.indexBuilt = false;
        state.indexBuilding = false;

        state.hitPaths = [];
        state.hitIndex = -1;
        state.lastQuery = '';

        state.currentEl = null;
        state.rootEl = null;
        state.pathToEl.clear();

        stopExpandJob();
        requestRenumber();
    }

    function registerPath(path, el) {
        state.pathToEl.set(path, el);
        el.dataset.jpPath = path;
    }

    // ===== JSON-ish rendering (with punctuation) + "full expanded" line numbers =====

    function quoteKey(key) {
        // Use JSON.stringify to escape quotes/backslashes correctly
        try { return JSON.stringify(String(key)); } catch (_) { return `"${String(key)}"`; }
    }

    function isEmptyContainer(v) {
        if (Array.isArray(v)) return v.length === 0;
        if (isObject(v)) return Object.keys(v).length === 0;
        return false;
    }

    /**
     * Computes line numbers as if JSON was fully expanded with indent=2 (VSCode-like):
     * - opening brace/bracket is its own line
     * - each property/element is its own line
     * - closing brace/bracket is its own line (except empty {} / [])
     *
     * Returns:
     *   openLine: Map(path -> lineNumber)
     *   closeLine: Map(path -> lineNumber)  // only for non-empty containers
     */
    function computeLineMaps(data) {
        const openLine = new Map();
        const closeLine = new Map();
        let line = 1;

        const walk = (value, path) => {
            const isArr = Array.isArray(value);
            const isObj = isObject(value);
            const isContainer = isArr || isObj;

            if (!isContainer) {
                openLine.set(path, line++);
                return;
            }

            // empty container => single line: {} or []
            if (isEmptyContainer(value)) {
                openLine.set(path, line++);
                return;
            }

            // opening line
            openLine.set(path, line++);

            if (isArr) {
                for (let i = 0; i < value.length; i++) {
                    walk(value[i], `${path}[${i}]`);
                }
            } else {
                for (const k of Object.keys(value)) {
                    const safe = k.includes('.') ? `["${k.replaceAll('"', '\\"')}"]` : `.${k}`;
                    walk(value[k], `${path}${safe}`);
                }
            }

            // closing line
            closeLine.set(path, line++);
        };

        walk(data, '$');
        return { openLine, closeLine };
    }

    function setRowMeta(rowEl, depth, lineNo) {
        rowEl.dataset.jpLine = lineNo ? String(lineNo) : '';
        rowEl.style.setProperty('--jp-depth', String(depth || 0));
    }

    function makeTextSpan(className, text) {
        const s = document.createElement('span');
        s.className = className;
        s.textContent = text;


        return s;
    }

    function containerTokenText(value, isOpen) {
        if (Array.isArray(value)) {
            // Reference behavior:
            // - collapsed: show count with both brackets => [N]
            // - expanded: show opening bracket only      => [
            return isOpen ? '[' : `[${value.length}]`;
        }
        // Object: open => "{", closed => "{…}"
        return isOpen ? '{' : '{…}';
    }




    function applyToggleVisual(btn, isOpen) {
        btn.textContent = isOpen ? '−' : '+';
        btn.classList.toggle('is-open', !!isOpen);
        btn.setAttribute('aria-label', isOpen ? 'Collapse' : 'Expand');
        btn.title = isOpen ? 'Collapse' : 'Expand';
    }


    /**
     * One visual line in Output.
     * We keep .jp-ln as separate gutter item (CSS aligns it to the left),
     * and everything else goes into .jp-line (so indentation doesn't affect gutter).
     */
    function makeLineRow({ depth, lineNo, searchableText }) {
        const row = document.createElement('div');
        row.className = 'jp-row jp-searchable';

        const ln = document.createElement('span');
        ln.className = 'jp-ln';
        ln.textContent = ''; // filled by renumberVisibleLines()
        row.appendChild(ln);

        const line = document.createElement('span');
        line.className = 'jp-line';
        row.appendChild(line);

        if (searchableText) row.dataset.jpText = searchableText;

        setRowMeta(row, depth, lineNo);
        return { row, line };
    }

    function appendComma(lineEl, needComma) {
        if (!needComma) return;
        lineEl.appendChild(makeTextSpan('jp-sep', ','));
    }

    function renderPrimitiveLine({
        parentKind,          // 'object' | 'array' | null
        key,                 // string | null
        value,
        depth,
        path,
        isLast,
        isRoot
    }) {
        const lineNo = state.openLine?.get(path) || '';
        const { row, line } = makeLineRow({
            depth,
            lineNo,
            searchableText: `${key ? key : ''} ${previewValue(value)}`.trim()
        });

        const buildUtcHintIfNeeded = () => {
            if (typeof value !== 'number' || !Number.isFinite(value)) return null;
            const hint = unixToUtcHint(value);
            if (!hint) return null;

            const s = document.createElement('span');
            s.className = 'jp-utcHint jp-noCopy';
            s.dataset.noCopy = '1';
            s.textContent = hint; // includes parentheses
            return s;
        };

        const appendValueAndMaybeHint = (needComma) => {
            // value itself
            line.appendChild(makeTextSpan(`jp-val ${valueClass(value)}`, previewValue(value)));

            // comma must be right after the value (to keep JSON-looking output consistent)
            appendComma(line, needComma);

            // UTC hint must appear AFTER comma (annotation, not part of JSON)
            const hintEl = buildUtcHintIfNeeded();
            if (hintEl) line.appendChild(hintEl);
        };

        if (parentKind === 'object' && key != null) {
            line.appendChild(makeTextSpan('jp-key', quoteKey(key)));
            line.appendChild(makeTextSpan('jp-sep', ': '));

            appendValueAndMaybeHint(!isLast);
        } else if (parentKind === 'array') {
            appendValueAndMaybeHint(!isLast);
        } else if (isRoot) {
            // root primitive has no trailing comma
            appendValueAndMaybeHint(false);
        }

        registerPath(path, row);
        return row;
    }

    /**
     * Detects unix timestamps in seconds/ms and returns a readable UTC annotation.
     * Month is written as a word (Sep/Oct...), e.g. "(UTC: 20 Sep 2025 17:47:00Z)"
     * Returns null if value doesn't look like a timestamp.
     */
    function unixToUtcHint(num) {
        let ms = null;

        // milliseconds: 1e12.. (2001+)
        if (num >= 1e12) ms = num;
        // seconds: 1e9.. (2001+) => convert
        else if (num >= 1e9) ms = num * 1000;

        if (ms == null) return null;

        // sanity window: 1970-01-01 .. 2100-01-01 (in ms)
        if (ms < 0 || ms > 4102444800000) return null;

        const d = new Date(ms);
        if (Number.isNaN(d.getTime())) return null;

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const dd = String(d.getUTCDate()).padStart(2, '0');
        const mon = months[d.getUTCMonth()];
        const yyyy = String(d.getUTCFullYear());

        const hh = String(d.getUTCHours()).padStart(2, '0');
        const mm = String(d.getUTCMinutes()).padStart(2, '0');
        const ss = String(d.getUTCSeconds()).padStart(2, '0');

        // Example: "20 Sep 2025 17:47:00Z"
        const pretty = `${dd} ${mon} ${yyyy} ${hh}:${mm}:${ss}Z`;

        return ` (UTC: ${pretty})`;
    }


    /**
     * Detects unix timestamps in seconds/ms and returns a readable UTC annotation.
     * Returns null if value doesn't look like a timestamp.
     */
    function unixToUtcHint(num) {
        // Support seconds and milliseconds
        let ms = null;

        // milliseconds: 1e12.. (2001+)
        if (num >= 1e12) ms = num;
        // seconds: 1e9.. (2001+) => convert
        else if (num >= 1e9) ms = num * 1000;

        if (ms == null) return null;

        // sanity window: 1970-01-01 .. 2100-01-01 (in ms)
        if (ms < 0 || ms > 4102444800000) return null;

        const d = new Date(ms);
        if (Number.isNaN(d.getTime())) return null;

        // "2025-09-20 17:47:00Z"
        const iso = d.toISOString(); // 2025-09-20T17:47:00.000Z
        const pretty = iso.replace('T', ' ').replace('.000Z', 'Z');

        return ` (UTC: ${pretty})`;
    }




    function renderClosingLine({ depth, path, closeChar, needComma }) {
        const lineNo = state.closeLine?.get(path) || '';
        const { row, line } = makeLineRow({
            depth,
            lineNo,
            searchableText: closeChar
        });

        // IMPORTANT:
        // Opening bracket/brace is rendered via `.jp-token` (see makeBranch token),
        // but closing bracket/brace used `.jp-sep` only -> looked thinner.
        // Make closing bracket/brace use the same token styling as opening.
        line.appendChild(makeTextSpan('jp-token jp-sep', closeChar));
        appendComma(line, needComma);

        return row;
    }


    function makeBranch({
        parentKind,          // 'object' | 'array' | null
        key,                 // string | null (for object props), null for array elements/root
        value,
        path,
        depth,
        isLast,
        open
    }) {
        const isArr = Array.isArray(value);
        const openChar = isArr ? '[' : '{';
        const closeChar = isArr ? ']' : '}';

        // Empty containers are rendered as one line: {} / []
        if (isEmptyContainer(value)) {
            const lineNo = state.openLine?.get(path) || '';
            const { row, line } = makeLineRow({
                depth,
                lineNo,
                searchableText: `${key ? key : ''} ${openChar}${closeChar}`.trim()
            });

            if (parentKind === 'object' && key != null) {
                line.appendChild(makeTextSpan('jp-key', quoteKey(key)));
                line.appendChild(makeTextSpan('jp-sep', ': '));
                line.appendChild(makeTextSpan('jp-sep', `${openChar}${closeChar}`));
                appendComma(line, !isLast);
            } else if (parentKind === 'array') {
                line.appendChild(makeTextSpan('jp-sep', `${openChar}${closeChar}`));
                appendComma(line, !isLast);
            } else {
                // root empty container
                line.appendChild(makeTextSpan('jp-sep', `${openChar}${closeChar}`));
            }

            row.classList.add('jp-leaf');
            registerPath(path, row);
            return row;
        }

        const details = document.createElement('details');
        details.className = 'jp-branch';
        details.open = !!open;

        // важно для ensureChildrenRendered()
        details.dataset.jpRendered = '0';
        details.dataset.jpCloseChar = closeChar;
        details.dataset.jpNeedCommaOnClose = (!isLast ? '1' : '0');

        const summary = document.createElement('summary');
        summary.className = 'jp-row jp-summary jp-searchable';

        // summary row structure: gutter + content span
        const ln = document.createElement('span');
        ln.className = 'jp-ln';
        ln.textContent = '';
        summary.appendChild(ln);

        const line = document.createElement('span');
        line.className = 'jp-line';
        summary.appendChild(line);

        // line number and depth for summary row
        const lineNo = state.openLine?.get(path) || '';
        setRowMeta(summary, depth, lineNo);

        // search text (минимально полезное)
        summary.dataset.jpText = `${key ? key : ''} ${openChar}`.trim();

        // content for opening line: key + ": " + toggle + token
        if (parentKind === 'object' && key != null) {
            line.appendChild(makeTextSpan('jp-key', quoteKey(key)));
            line.appendChild(makeTextSpan('jp-sep', ': '));
        }

        const btn = document.createElement('span');
        btn.className = 'jp-toggle';
        applyToggleVisual(btn, details.open);
        line.appendChild(btn);

        const token = document.createElement('span');
        token.className = 'jp-token jp-sep';
        token.textContent = containerTokenText(value, details.open);
        line.appendChild(token);

        // toggle only on button
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            details.open = !details.open;
        });

        // clicking the row does NOT toggle
        summary.addEventListener('click', (e) => {
            if (!e.target.closest('.jp-toggle')) {
                e.preventDefault();
                e.stopPropagation();
            }
        });

        details.addEventListener('toggle', () => {
            token.textContent = containerTokenText(value, details.open);
            applyToggleVisual(btn, details.open);

            if (details.open) ensureChildrenRendered(details, value, path, depth);
            requestRenumber();
        });

        // ✅ КЛЮЧЕВОЕ: раньше этого не было — из-за этого браузер показывал дефолтный "Details"
        details.appendChild(summary);

        const children = document.createElement('div');
        children.className = 'jp-children';
        details.appendChild(children);

        // регистрируем path именно на details (ветка)
        registerPath(path, details);

        return details;
    }


    function ensureChildrenRendered(details, value, path, parentDepth) {
        if (details.dataset.jpRendered === '1') return;
        details.dataset.jpRendered = '1';

        const children = details.querySelector('.jp-children');
        if (!children) return;

        const frag = document.createDocumentFragment();
        const depth = (parentDepth || 0) + 1;

        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                const childPath = `${path}[${i}]`;
                const isLast = i === value.length - 1;
                frag.appendChild(renderNode({
                    parentKind: 'array',
                    key: null,
                    value: value[i],
                    path: childPath,
                    depth,
                    isLast
                }));
            }
        } else if (isObject(value)) {
            const keys = Object.keys(value);
            for (let i = 0; i < keys.length; i++) {
                const k = keys[i];
                const safe = k.includes('.') ? `["${k.replaceAll('"', '\\"')}"]` : `.${k}`;
                const childPath = `${path}${safe}`;
                const isLast = i === keys.length - 1;

                frag.appendChild(renderNode({
                    parentKind: 'object',
                    key: k,
                    value: value[k],
                    path: childPath,
                    depth,
                    isLast
                }));
            }
        }

        // Closing line for this container
        const needCommaOnClose = details.dataset.jpNeedCommaOnClose === '1';
        const closeChar = details.dataset.jpCloseChar || (Array.isArray(value) ? ']' : '}');
        frag.appendChild(renderClosingLine({
            depth: parentDepth || 0,
            path,
            closeChar,
            needComma: needCommaOnClose
        }));

        children.appendChild(frag);
        requestRenumber();
    }

    function renderNode({ parentKind, key, value, path, depth, isLast, isRoot = false }) {
        if (Array.isArray(value) || isObject(value)) {
            const shouldOpen = isRoot ? true : false;
            return makeBranch({
                parentKind,
                key,
                value,
                path,
                depth,
                isLast,
                open: shouldOpen
            });
        }
        return renderPrimitiveLine({
            parentKind,
            key,
            value,
            depth,
            path,
            isLast,
            isRoot
        });
    }





    function parseAndRender() {
        const raw = (state.input?.value || '').trim();
        if (!raw) {
            clearOutput();
            setStatus('Paste JSON into the input and click Parse.', 'info');
            return;
        }

        stopExpandJob();

        try {
            const data = tryParseJson(raw);

            clearOutput();
            state.data = data;

            // IMPORTANT: do NOT build the search index here (perf).
            // We'll build it lazily on first search.
            setStatus('Parsed successfully.', 'ok');

            setExpandButtonsDisabled(false);

            // compute "full expanded" line numbers
            const maps = computeLineMaps(data);
            state.openLine = maps.openLine;
            state.closeLine = maps.closeLine;

            const tree = document.createElement('div');
            tree.className = 'jp-tree';

            const root = renderNode({
                parentKind: null,
                key: null,
                value: data,
                path: '$',
                depth: 0,
                isLast: true,
                isRoot: true
            });

            tree.appendChild(root);
            state.output.appendChild(tree);

            state.rootEl = root && root.tagName === 'DETAILS' ? root : null;

            // render first level only (root is open by default)
            if (state.rootEl && state.rootEl.open) {
                ensureChildrenRendered(state.rootEl, data, '$', 0);
            }

            clearSearchVisuals();
            requestRenumber();


        } catch (e) {
            clearOutput();
            setStatus(e?.message || 'Parse error', 'err');
        }
    }

    // ===== Search (index-based) =====

    function clearSearchVisuals() {
        state.hitPaths = [];
        state.hitIndex = -1;
        state.currentEl = null;

        if (!state.view) return;
        state.view.querySelectorAll('.jp-hit').forEach(el => el.classList.remove('jp-hit'));
        state.view.querySelectorAll('.jp-current').forEach(el => el.classList.remove('jp-current'));
    }

    function openAncestors(el) {
        let p = el?.parentElement;
        while (p) {
            if (p.tagName === 'DETAILS') {
                p.open = true;
                const path = p.dataset.jpPath;
                const v = getValueByPath(path);
                // depth for children indentation
                const depth = Number(p.querySelector(':scope > summary.jp-row')?.style.getPropertyValue('--jp-depth') || 0);
                if (v !== undefined) ensureChildrenRendered(p, v, path, depth);


            }
            p = p.parentElement;
        }
    }

    function activateEl(el) {
        if (!el) return;

        if (state.currentEl) state.currentEl.classList.remove('jp-current');
        state.currentEl = el;
        el.classList.add('jp-current');

        openAncestors(el);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function getValueByPath(path) {
        if (path === '$') return state.data;
        if (!state.data) return undefined;

        let cur = state.data;
        let i = 1; // skip $
        while (i < path.length) {
            const ch = path[i];

            if (ch === '.') {
                i++;
                let key = '';
                while (i < path.length) {
                    const c = path[i];
                    if (c === '.' || c === '[') break;
                    key += c;
                    i++;
                }
                if (!isObject(cur)) return undefined;
                cur = cur[key];
                continue;
            }

            if (ch === '[') {
                i++;
                if (path[i] === '"') {
                    i++;
                    let key = '';
                    while (i < path.length) {
                        const c = path[i];
                        if (c === '"' && path[i - 1] !== '\\') break;
                        key += c;
                        i++;
                    }
                    while (i < path.length && path[i] !== ']') i++;
                    i++;
                    key = key.replaceAll('\\"', '"');
                    if (!isObject(cur)) return undefined;
                    cur = cur[key];
                } else {
                    let num = '';
                    while (i < path.length && path[i] !== ']') {
                        num += path[i];
                        i++;
                    }
                    i++;
                    const idx = Number(num);
                    if (!Array.isArray(cur)) return undefined;
                    cur = cur[idx];
                }
                continue;
            }

            return undefined;
        }
        return cur;
    }

    function ensurePathRendered(path) {
        const existing = state.pathToEl.get(path);
        if (existing) return existing;
        if (!state.rootEl) return null;

        const parts = [];
        let cur = '$';
        parts.push(cur);

        let i = 1;
        while (i < path.length) {
            const ch = path[i];
            if (ch === '.') {
                i++;
                let key = '';
                while (i < path.length) {
                    const c = path[i];
                    if (c === '.' || c === '[') break;
                    key += c;
                    i++;
                }
                cur += `.${key}`;
                parts.push(cur);
                continue;
            }
            if (ch === '[') {
                let seg = '[';
                i++;
                while (i < path.length) {
                    seg += path[i];
                    if (path[i] === ']') { i++; break; }
                    i++;
                }
                cur += seg;
                parts.push(cur);
                continue;
            }
            i++;
        }

        for (const p of parts) {
            const el = state.pathToEl.get(p);
            const v = getValueByPath(p);

            if (el && el.tagName === 'DETAILS') {
                el.open = true;
                if (v !== undefined) ensureChildrenRendered(el, v, p);
            }
        }

        requestRenumber();
        return state.pathToEl.get(path) || null;
    }

    function runSearch(query, silent = false) {
        const q = (query || '').trim();
        state.lastQuery = q;

        clearSearchVisuals();

        if (!q) {
            if (!silent) setStatus('Search cleared.', 'info');
            return;
        }
        if (!state.data) {
            setStatus('Nothing to search. Parse JSON first.', 'info');
            return;
        }

        ensureIndexBuilt(() => {
            const qLower = q.toLowerCase();
            const hitPaths = [];

            for (let i = 0; i < state.index.length; i++) {
                if (state.index[i].textLower.includes(qLower)) {
                    hitPaths.push(state.index[i].path);
                    if (hitPaths.length >= 5000) break;
                }
            }

            state.hitPaths = hitPaths;

            if (!hitPaths.length) {
                setStatus(`No matches for: "${q}"`, 'info');
                return;
            }

            state.hitIndex = 0;
            setStatus(`Found ${hitPaths.length} match(es).`, 'ok');
            jumpToHit(0);
        });
    }

    function jumpToHit(idx) {
        if (!state.hitPaths.length) return;
        const path = state.hitPaths[idx];

        const el = ensurePathRendered(path);

        if (el) el.classList.add('jp-hit');

        if (el) {
            // highlight summary row if branch
            if (el.tagName === 'DETAILS') {
                const sum = el.querySelector(':scope > summary.jp-row');
                if (sum) activateEl(sum);
                else activateEl(el);
            } else {
                activateEl(el);
            }
        } else {
            const maybe = state.view?.querySelector(`[data-jp-path="${CSS.escape(path)}"]`);
            if (maybe) activateEl(maybe);
        }
    }

    function nextHit() {
        if (!state.hitPaths.length) {
            runSearch(state.searchInput?.value || '');
            return;
        }
        state.hitIndex = (state.hitIndex + 1) % state.hitPaths.length;
        setStatus(`Match ${state.hitIndex + 1} / ${state.hitPaths.length}`, 'ok');
        jumpToHit(state.hitIndex);
    }

    // ===== Expand/Collapse all (chunked) =====

    function stopExpandJob() {
        if (state.expandJob?.id) cancelSchedule(state.expandJob.id);
        state.expandJob = null;
    }

    function setExpandButtonsDisabled(disabled) {
        if (state.expandAllBtn) state.expandAllBtn.disabled = !!disabled;
        if (state.collapseAllBtn) state.collapseAllBtn.disabled = !!disabled;
    }

    function expandAllChunked() {
        if (!state.data || !state.rootEl) return;

        stopExpandJob();
        setExpandButtonsDisabled(true);
        setStatus('Expanding…', 'info');

        const queue = [state.rootEl];

        const job = { id: null };

        const step = (deadline) => {
            const timeBudget = typeof deadline?.timeRemaining === 'function'
                ? deadline.timeRemaining()
                : 0;

            let iterations = 0;
            while (queue.length) {
                const d = queue.shift();
                if (!d || d.tagName !== 'DETAILS') continue;

                const path = d.dataset.jpPath;
                const v = getValueByPath(path);

                d.open = true;
                const depth = Number(d.querySelector(':scope > summary.jp-row')?.style.getPropertyValue('--jp-depth') || 0);
                if (v !== undefined) ensureChildrenRendered(d, v, path, depth);

                const kids = d.querySelectorAll(':scope > .jp-children > details.jp-branch');
                kids.forEach(k => queue.push(k));

                iterations++;
                if (iterations >= 120) break;
                if (timeBudget && timeBudget < 8) break;
            }

            requestRenumber();

            if (queue.length) {
                job.id = schedule(step);
            } else {
                setExpandButtonsDisabled(false);
                setStatus('All expanded.', 'ok');
                state.expandJob = null;
            }
        };

        job.id = schedule(step);
        state.expandJob = job;
    }

    function collapseAll() {
        if (!state.rootEl) return;
        stopExpandJob();

        const all = state.output.querySelectorAll('details.jp-branch');
        all.forEach(d => {
            d.open = false;

            // strong prune for perf: keep only first-level rendered, drop deeper DOM
            if (d !== state.rootEl) {
                const children = d.querySelector('.jp-children');
                if (children) children.innerHTML = '';
                d.dataset.jpRendered = '0';
            }
        });



        clearSearchVisuals();
        setStatus('All collapsed.', 'ok');
        requestRenumber();
    }

    // ===== UI =====

    function buildUi(container) {
        const view = document.createElement('section');
        view.id = 'tab3View';
        view.className = 'hidden jp-wrap';

        view.innerHTML = `
                       <div class="jp-head">
                <div>
                    <div class="jp-title">JSON Parser</div>
                    <div class="jp-sub">Paste JSON → Parse → expand nodes. Search jumps to matches and opens nested blocks.</div>
                </div>
            </div>

            <div class="jp-inputBlock">
                <label class="jp-label" for="jpInput">Input</label>
                <textarea id="jpInput" class="jp-input" spellcheck="false"
                    placeholder="Paste JSON here (object or array). Tip: Ctrl+Enter to parse."></textarea>

                <div class="jp-inputActions">
                    <button class="jp-btn jp-primary" type="button" data-act="parse">Parse</button>
                    <button class="jp-btn jp-warn" type="button" data-act="clear">Clear</button>
                </div>

                <div class="jp-status" data-kind="info"></div>
            </div>


            

            <div class="jp-outputBlock">
                
                <div class="jp-outputTop">
                    <div class="jp-label">Output</div>

                    <div class="jp-outputTools">
                        <button class="jp-btn jp-small" type="button" data-act="expandAll">Expand all</button>
                        <button class="jp-btn jp-small" type="button" data-act="collapseAll">Collapse all</button>

                        <input id="jpSearch" class="jp-search" type="text" placeholder="Search in JSON..." />
                        <button class="jp-btn jp-primary jp-small" type="button" data-act="searchNext">Search</button>
                        <button class="jp-btn jp-small" type="button" data-act="searchClear">Reset</button>
                    </div>

                    <div class="jp-hint">Enter = next match • Shift+Enter = run search from start (index builds on first search)</div>
                </div>


                <div class="jp-output jp-outputCode" tabindex="0"></div>
            </div>
        `;

        container.appendChild(view);

        state.view = view;

        state.input = view.querySelector('#jpInput');
        state.output = view.querySelector('.jp-output');
        state.status = view.querySelector('.jp-status');

        // Strip non-copy annotations from clipboard (UTC hints, etc.)
        state.output.addEventListener('copy', (e) => {
            try {
                const sel = window.getSelection?.();
                if (!sel || sel.rangeCount === 0) return;

                // only handle selections inside output
                const range = sel.getRangeAt(0);
                const common = range.commonAncestorContainer;
                const root = state.output;

                const isInside =
                    (common === root) ||
                    (common.nodeType === 1 && root.contains(common)) ||
                    (common.nodeType === 3 && root.contains(common.parentElement));

                if (!isInside) return;

                const frag = range.cloneContents();
                frag.querySelectorAll?.('[data-no-copy="1"], .jp-noCopy').forEach(n => n.remove());

                const tmp = document.createElement('div');
                tmp.appendChild(frag);

                const text = tmp.textContent || '';
                e.clipboardData?.setData('text/plain', text);
                e.preventDefault();
            } catch (_) {
                // if anything fails, fall back to default copy behavior
            }
        });


        state.parseBtn = view.querySelector('[data-act="parse"]');
        state.clearBtn = view.querySelector('[data-act="clear"]');

        state.searchInput = view.querySelector('#jpSearch');
        state.searchBtn = view.querySelector('[data-act="searchNext"]');
        state.clearSearchBtn = view.querySelector('[data-act="searchClear"]');

        state.expandAllBtn = view.querySelector('[data-act="expandAll"]');
        state.collapseAllBtn = view.querySelector('[data-act="collapseAll"]');

        state.parseBtn.addEventListener('click', parseAndRender);

        state.clearBtn.addEventListener('click', () => {
            state.input.value = '';
            state.searchInput.value = '';
            clearOutput();
            setStatus('Cleared.', 'info');
            state.input.focus();
        });

        state.searchBtn.addEventListener('click', () => {
            const q = state.searchInput.value || '';
            if (q.trim() !== state.lastQuery) runSearch(q);
            else nextHit();
        });

        state.clearSearchBtn.addEventListener('click', () => {
            state.searchInput.value = '';
            state.lastQuery = '';
            clearSearchVisuals();
            setStatus('Search cleared.', 'info');
            state.searchInput.focus();
        });

        state.expandAllBtn.addEventListener('click', expandAllChunked);
        state.collapseAllBtn.addEventListener('click', collapseAll);

        state.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                parseAndRender();
            }
        });

        state.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const q = state.searchInput.value || '';
                if (e.shiftKey) runSearch(q);
                else {
                    if (q.trim() !== state.lastQuery) runSearch(q);
                    else nextHit();
                }
            }
        });

        setStatus('Paste JSON into the input and click Parse.', 'info');
    }

    function init(container) {
        if (state.mounted) return;
        if (!container) container = document.getElementById('tool-root') || document.body;

        buildUi(container);
        state.mounted = true;
    }

    function onActivate() {
        const hasOutput = !!state.output && state.output.textContent.trim().length > 0;
        if (hasOutput) state.searchInput?.focus();
        else state.input?.focus();
    }

    window.Tools.jsonParser = { init, onActivate };
})();
