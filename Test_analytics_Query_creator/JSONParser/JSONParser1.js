(() => {
    window.Tools = window.Tools || {};

    const state = {
        mounted: false,
        view: null,
        guidesLayer: null,
        guidesRaf: 0,

        input: null,
        output: null,
        status: null,

        parseBtn: null,
        clearBtn: null,

        // Search UI
        searchInput: null,
        searchClearX: null,
        searchCounter: null,
        searchUpBtn: null,
        searchDownBtn: null,

        expandAllBtn: null,
        collapseAllBtn: null,

        // parsed data
        data: null,

        // search index (built lazily)
        index: [],
        indexBuilt: false,
        indexBuilding: false,
        indexMaxItems: 60000,

        // hits
        hitPaths: [],
        hitIndex: -1,
        lastQuery: '',

        // DOM maps
        rootEl: null,
        pathToEl: new Map(),
        currentEl: null,

        // async tasks
        expandJob: null,
        highlightJob: null,

        // line numbers
        renumberRaf: 0,

        // full expanded line numbers
        openLine: null,
        closeLine: null,

        // live-search debounce
        searchDebounceT: 0,
        lastInlineMarkedEl: null,
    };

    // ===== Utilities =====

    function setStatus(text, kind = 'info') {
        if (!state.status) return;
        state.status.textContent = text || '';
        state.status.dataset.kind = kind;
    }

    function isObject(v) {
        return v !== null && typeof v === 'object' && !Array.isArray(v);
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
        if (typeof requestIdleCallback === 'function') {
            return requestIdleCallback(fn, { timeout: 120 });
        }
        return setTimeout(() => fn({ timeRemaining: () => 0, didTimeout: true }), 0);
    }

    function cancelSchedule(id) {
        if (typeof cancelIdleCallback === 'function') cancelIdleCallback(id);
        else clearTimeout(id);
    }

    // ===== VSCode-like indent guides (only for OPEN blocks) =====

    function clearGuides() {
        if (!state.guidesLayer) return;
        state.guidesLayer.innerHTML = '';
    }

    function scheduleGuidesUpdate() {
        if (!state.output || !state.guidesLayer) return;
        if (state.guidesRaf) return;

        state.guidesRaf = requestAnimationFrame(() => {
            state.guidesRaf = 0;
            updateGuides();
        });
    }

    function updateGuides() {
        if (!state.output || !state.guidesLayer) return;

        // clear old lines
        state.guidesLayer.innerHTML = '';

        // We draw a line for each open details block that has a visible closing line rendered.
        // Line goes from summary row to closing row (last child row inside .jp-children).
        const outRect = state.output.getBoundingClientRect();

        const openBranches = state.output.querySelectorAll('details.jp-branch[open]');
        openBranches.forEach((detailsEl) => {
            // Must have children rendered, otherwise there is no closing row yet
            if (detailsEl.dataset.jpRendered !== '1') return;

            const summaryRow = detailsEl.querySelector(':scope > summary.jp-row');
            const closeRow = detailsEl.querySelector(':scope > .jp-children > .jp-row:last-child');
            if (!summaryRow || !closeRow) return;

            // If closing row is not visible (shouldn't happen when [open], but guard anyway)
            const sumRect = summaryRow.getBoundingClientRect();
            const closeRect = closeRow.getBoundingClientRect();

            if (sumRect.height === 0 || closeRect.height === 0) return;

            // top: align to the first text baseline area of summary
            const top = sumRect.top - outRect.top + state.output.scrollTop + 2;
            // bottom: to the bottom of closing line
            const bottom = closeRect.bottom - outRect.top + state.output.scrollTop - 2;

            if (bottom <= top + 6) return;

            // X position: at the "start of the line content" (like VSCode guide at block start)
            const sumLine = summaryRow.querySelector(':scope > .jp-line') || summaryRow.querySelector('.jp-line');
            if (!sumLine) return;

            const lineRect = sumLine.getBoundingClientRect();

            // Place guide near the left edge of line content (this naturally shifts with depth)
            const x = (lineRect.left - outRect.left) + 3;

            const v = document.createElement('div');
            v.className = 'jp-guideLine';
            v.style.left = `${x}px`;
            v.style.top = `${top}px`;
            v.style.height = `${Math.max(6, bottom - top)}px`;

            state.guidesLayer.appendChild(v);
        });
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
        try {
            const v = JSON.parse(text);

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
        if (state.indexBuilding) return;

        state.indexBuilding = true;
        setStatus('Indexing for search…', 'info');

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
        if (state.output) {
            state.output.innerHTML = '';

            // re-create guides layer after full clear
            const guides = document.createElement('div');
            guides.className = 'jp-guides';
            state.output.appendChild(guides);
            state.guidesLayer = guides;
        }

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
        clearSearchVisuals();
        updateSearchUi();

        clearGuides();
        requestRenumber();
    }


    function registerPath(path, el) {
        state.pathToEl.set(path, el);
        el.dataset.jpPath = path;
    }

    // ===== JSON-ish rendering + "full expanded" line numbers =====

    function quoteKey(key) {
        try { return JSON.stringify(String(key)); } catch (_) { return `"${String(key)}"`; }
    }

    function isEmptyContainer(v) {
        if (Array.isArray(v)) return v.length === 0;
        if (isObject(v)) return Object.keys(v).length === 0;
        return false;
    }

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

            if (isEmptyContainer(value)) {
                openLine.set(path, line++);
                return;
            }

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

    /**
     * Bracket color by nesting depth (VSCode-like).
     * Open + close of the same container must have the same color => use the SAME depth.
     */
    function bracketLevel(depth) {
        const d = Number(depth) || 0;
        const mod = 6; // how many colors in palette
        return ((d % mod) + mod) % mod;
    }

    function makeBracketSpan(text, depth) {
        const s = document.createElement('span');
        s.className = 'jp-bracket';
        s.textContent = text;

        // Use CSS vars: --jp-bracket-0..5
        const lvl = bracketLevel(depth);
        s.style.color = `var(--jp-bracket-${lvl})`;
        return s;
    }


    function containerTokenText(value, isOpen) {
        if (Array.isArray(value)) return isOpen ? '[' : `[${value.length}]`;
        return isOpen ? '{' : '{…}';
    }

    function applyToggleVisual(btn, isOpen) {
        btn.textContent = isOpen ? '−' : '+';
        btn.classList.toggle('is-open', !!isOpen);
        btn.setAttribute('aria-label', isOpen ? 'Collapse' : 'Expand');
        btn.title = isOpen ? 'Collapse' : 'Expand';
    }

    function makeLineRow({ depth, lineNo, searchableText }) {
        const row = document.createElement('div');
        row.className = 'jp-row jp-searchable';

        const ln = document.createElement('span');
        ln.className = 'jp-ln';
        ln.textContent = '';
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

    function unixToUtcHint(num) {
        let ms = null;

        if (num >= 1e12) ms = num;
        else if (num >= 1e9) ms = num * 1000;

        if (ms == null) return null;
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

        const pretty = `${dd} ${mon} ${yyyy} ${hh}:${mm}:${ss}Z`;
        return ` (UTC: ${pretty})`;
    }

    function renderPrimitiveLine({
        parentKind,
        key,
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
            s.textContent = hint;
            return s;
        };

        const appendValueAndMaybeHint = (needComma) => {
            line.appendChild(makeTextSpan(`jp-val ${valueClass(value)}`, previewValue(value)));
            appendComma(line, needComma);

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
            appendValueAndMaybeHint(false);
        }

        registerPath(path, row);
        return row;
    }

    function renderClosingLine({ depth, path, closeChar, needComma }) {
        const lineNo = state.closeLine?.get(path) || '';
        const { row, line } = makeLineRow({
            depth,
            lineNo,
            searchableText: closeChar
        });

        // Color close bracket by the SAME depth as opener summary line
        line.appendChild(makeBracketSpan(closeChar, depth));
        appendComma(line, needComma);

        return row;
    }


    function makeBranch({
        parentKind,
        key,
        value,
        path,
        depth,
        isLast,
        open
    }) {
        const isArr = Array.isArray(value);
        const openChar = isArr ? '[' : '{';
        const closeChar = isArr ? ']' : '}';

        if (isEmptyContainer(value)) {
            const lineNo = state.openLine?.get(path) || '';
            const { row, line } = makeLineRow({
                depth,
                lineNo,
                searchableText: `${key ? key : ''} ${openChar}${closeChar}`.trim()
            });

            const appendEmptyBrackets = () => {
                // Open + close must share same depth color
                line.appendChild(makeBracketSpan(openChar, depth));
                line.appendChild(makeBracketSpan(closeChar, depth));
            };

            if (parentKind === 'object' && key != null) {
                line.appendChild(makeTextSpan('jp-key', quoteKey(key)));
                line.appendChild(makeTextSpan('jp-sep', ': '));
                appendEmptyBrackets();
                appendComma(line, !isLast);
            } else if (parentKind === 'array') {
                appendEmptyBrackets();
                appendComma(line, !isLast);
            } else {
                appendEmptyBrackets();
            }

            row.classList.add('jp-leaf');
            registerPath(path, row);
            return row;
        }


        const details = document.createElement('details');
        details.className = 'jp-branch';
        details.open = !!open;

        details.dataset.jpRendered = '0';
        details.dataset.jpCloseChar = closeChar;
        details.dataset.jpNeedCommaOnClose = (!isLast ? '1' : '0');

        const summary = document.createElement('summary');
        summary.className = 'jp-row jp-summary jp-searchable';

        const ln = document.createElement('span');
        ln.className = 'jp-ln';
        ln.textContent = '';
        summary.appendChild(ln);

        const line = document.createElement('span');
        line.className = 'jp-line';
        summary.appendChild(line);

        const lineNo = state.openLine?.get(path) || '';
        setRowMeta(summary, depth, lineNo);

        summary.dataset.jpText = `${key ? key : ''} ${openChar}`.trim();

        if (parentKind === 'object' && key != null) {
            line.appendChild(makeTextSpan('jp-key', quoteKey(key)));
            line.appendChild(makeTextSpan('jp-sep', ': '));
        }

        const btn = document.createElement('span');
        btn.className = 'jp-toggle';
        applyToggleVisual(btn, details.open);
        line.appendChild(btn);

        // Colored container token (like VSCode bracket pairs)
        const token = document.createElement('span');
        token.className = 'jp-token jp-sep jp-bracket';
        token.textContent = containerTokenText(value, details.open);
        token.style.color = `var(--jp-bracket-${bracketLevel(depth)})`;
        line.appendChild(token);

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            details.open = !details.open;
        });

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
            scheduleGuidesUpdate();
        });


        details.appendChild(summary);

        const children = document.createElement('div');
        children.className = 'jp-children';
        details.appendChild(children);

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
        scheduleGuidesUpdate();
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

            setStatus('Parsed successfully.', 'ok');
            setExpandButtonsDisabled(false);

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

            if (state.rootEl && state.rootEl.open) {
                ensureChildrenRendered(state.rootEl, data, '$', 0);
            }

            clearSearchVisuals(); requestRenumber();
            updateSearchUi();
            requestRenumber();
            scheduleGuidesUpdate();

            // if there is an active query in the search input (user typed before parse)
            const q = (state.searchInput?.value || '').trim();
            if (q) runSearch(q, { silentStatus: true, autoJump: true });

        } catch (e) {
            clearOutput();
            setStatus(e?.message || 'Parse error', 'err');
        }
    }

    // ===== Search visuals + “VSCode-like” inline highlight =====

    function unwrapInlineMarks(root) {
        if (!root) return;

        // We actually create spans with class "jp-hitText"
        // (both in markInlineMatch and markInlineMatchInEl).
        // Keep ".jp-inlineMatch" too — just in case legacy code ever appears.
        const marks = root.querySelectorAll?.('.jp-hitText, .jp-inlineMatch');
        if (!marks || marks.length === 0) return;

        marks.forEach(m => {
            const txt = document.createTextNode(m.textContent || '');
            m.replaceWith(txt);
        });

        // Merge adjacent Text nodes back together.
        // Without this, multi-letter searches can fail after previous highlighting.
        if (typeof root.normalize === 'function') {
            root.normalize();
        }
    }




    function clearSearchVisuals() {
        state.hitPaths = [];
        state.hitIndex = -1;

        if (state.currentEl) state.currentEl.classList.remove('jp-current');
        state.currentEl = null;

        if (!state.view) return;

        state.view.querySelectorAll('.jp-hit').forEach(el => el.classList.remove('jp-hit'));
        state.view.querySelectorAll('.jp-current').forEach(el => el.classList.remove('jp-current'));

        // stop any in-progress “highlight all hits” job
        if (state.highlightJob?.id) cancelSchedule(state.highlightJob.id);
        state.highlightJob = null;

        // remove “bright” text marks everywhere (important when query changes)
        state.view.querySelectorAll('.jp-searchable').forEach(el => unwrapInlineMarks(el));
        state.lastInlineMarkedEl = null;

    }

    function markInlineMatch(el, query) {
        if (!el || !query) return;

        // clear previous inline marks (only on previously active element for perf)
        if (state.lastInlineMarkedEl && state.lastInlineMarkedEl !== el) {
            unwrapInlineMarks(state.lastInlineMarkedEl);
        }

        const line = el.querySelector?.(':scope > .jp-line') || el.querySelector?.('.jp-line');
        if (!line) return;

        unwrapInlineMarks(line);
        if (typeof line.normalize === 'function') line.normalize();

        const q = String(query);
        const qLower = q.toLowerCase();
        if (!qLower) return;

        const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const txt = node.nodeValue || '';
                if (!txt.trim()) return NodeFilter.FILTER_REJECT;
                if (txt.toLowerCase().includes(qLower)) return NodeFilter.FILTER_ACCEPT;
                return NodeFilter.FILTER_REJECT;
            }
        });

        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        textNodes.forEach((node) => {
            const txt = node.nodeValue || '';
            const lower = txt.toLowerCase();

            let idx = 0;
            let from = 0;

            const frag = document.createDocumentFragment();

            while (true) {
                idx = lower.indexOf(qLower, from);
                if (idx === -1) break;

                const before = txt.slice(from, idx);
                if (before) frag.appendChild(document.createTextNode(before));

                const hit = txt.slice(idx, idx + q.length);
                const span = document.createElement('span');
                span.className = 'jp-hitText';
                span.textContent = hit;
                frag.appendChild(span);

                from = idx + q.length;
            }

            const after = txt.slice(from);
            if (after) frag.appendChild(document.createTextNode(after));

            node.replaceWith(frag);
        });

        state.lastInlineMarkedEl = line;
    }
    function getDetailsDepth(detailsEl) {
        if (!detailsEl) return 0;
        const sum = detailsEl.querySelector(':scope > summary.jp-row');
        const d = Number(sum?.style.getPropertyValue('--jp-depth') || 0);
        return Number.isFinite(d) ? d : 0;
    }

    /**
     * Ensure details children are rendered using the CORRECT depth.
     * (This is the fix for “closing braces shifting left / broken indentation”.)
     */
    function ensureDetailsRendered(detailsEl) {
        if (!detailsEl || detailsEl.tagName !== 'DETAILS') return;
        const path = detailsEl.dataset.jpPath;
        if (!path) return;
        const v = getValueByPath(path);
        const depth = getDetailsDepth(detailsEl);
        if (v !== undefined) ensureChildrenRendered(detailsEl, v, path, depth);
    }

    function openAncestors(el) {
        let p = el?.parentElement;
        while (p) {
            if (p.tagName === 'DETAILS') {
                p.open = true;
                ensureDetailsRendered(p);
            }
            p = p.parentElement;
        }
    }

    /**
     * Highlight text inside one row (does NOT clear previous marks).
     * Used to highlight ALL matches, not only the current one.
     */
    function markInlineMatchInEl(el, query) {
        if (!el || !query) return;

        const line = el.querySelector?.(':scope > .jp-line') || el.querySelector?.('.jp-line');
        if (!line) return;

        // remove old marks inside this line only
        unwrapInlineMarks(line);
        if (typeof line.normalize === 'function') line.normalize();

        const q = String(query);
        const qLower = q.toLowerCase();
        if (!qLower) return;

        const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const txt = node.nodeValue || '';
                if (!txt.trim()) return NodeFilter.FILTER_REJECT;
                if (txt.toLowerCase().includes(qLower)) return NodeFilter.FILTER_ACCEPT;
                return NodeFilter.FILTER_REJECT;
            }
        });

        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        textNodes.forEach((node) => {
            const txt = node.nodeValue || '';
            const lower = txt.toLowerCase();

            let from = 0;
            const frag = document.createDocumentFragment();

            while (true) {
                const idx = lower.indexOf(qLower, from);
                if (idx === -1) break;

                const before = txt.slice(from, idx);
                if (before) frag.appendChild(document.createTextNode(before));

                const hit = txt.slice(idx, idx + q.length);
                const span = document.createElement('span');
                span.className = 'jp-hitText';
                span.textContent = hit;
                frag.appendChild(span);

                from = idx + q.length;
            }

            const after = txt.slice(from);
            if (after) frag.appendChild(document.createTextNode(after));

            node.replaceWith(frag);
        });
    }


    function activateEl(el, queryForInlineMark = '') {
        if (!el) return;

        if (state.currentEl) state.currentEl.classList.remove('jp-current');
        state.currentEl = el;
        el.classList.add('jp-current');

        openAncestors(el);

        // bright mark inside the line (VSCode-like)
        if (queryForInlineMark) markInlineMatch(el, queryForInlineMark);

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

                // IMPORTANT: pass correct parent depth to avoid broken indentation / braces
                const depth = getDetailsDepth(el);
                if (v !== undefined) ensureChildrenRendered(el, v, p, depth);
            }
        }

        requestRenumber();
        return state.pathToEl.get(path) || null;

    }

    function updateSearchUi() {
        const q = String(state.searchInput?.value || '');
        const hasText = q.length > 0;

        if (state.searchClearX) {
            state.searchClearX.style.display = hasText ? 'inline-flex' : 'none';
        }

        const total = state.hitPaths.length;
        const cur = total > 0 && state.hitIndex >= 0 ? (state.hitIndex + 1) : 0;

        if (state.searchCounter) {
            if (!hasText) state.searchCounter.textContent = '';
            else state.searchCounter.textContent = `${cur} of ${total}`;
        }

        const disableNav = !hasText || total <= 0;
        if (state.searchUpBtn) state.searchUpBtn.disabled = disableNav;
        if (state.searchDownBtn) state.searchDownBtn.disabled = disableNav;
    }

    function runSearch(query, opts = {}) {
        const { silentStatus = false, autoJump = true } = opts;

        const q = String(query || '');
        const trimmed = q.trim();
        state.lastQuery = trimmed;

        // cancel old progressive highlight immediately (before DOM updates from old job)
        if (state.highlightJob?.id) cancelSchedule(state.highlightJob.id);
        state.highlightJob = null;

        clearSearchVisuals();

        // capture query at the time of starting the async index callback
        const runQuery = trimmed;


        if (!trimmed) {
            if (!silentStatus) setStatus('Search cleared.', 'info');
            updateSearchUi();
            return;
        }

        if (!state.data) {
            if (!silentStatus) setStatus('Nothing to search. Parse JSON first.', 'info');
            updateSearchUi();
            return;
        }

        ensureIndexBuilt(() => {
            // If user already typed something else — ignore this stale callback
            if (runQuery !== state.lastQuery) return;

            const qLower = runQuery.toLowerCase();
            const hitPaths = [];

            for (let i = 0; i < state.index.length; i++) {
                if (state.index[i].textLower.includes(qLower)) {
                    hitPaths.push(state.index[i].path);
                    if (hitPaths.length >= 5000) break;
                }
            }

            state.hitPaths = hitPaths;

            if (!hitPaths.length) {
                if (!silentStatus) setStatus(`No matches for: "${trimmed}"`, 'info');
                state.hitIndex = -1;
                updateSearchUi();
                return;
            }

            state.hitIndex = 0;
            if (!silentStatus) setStatus(`Found ${hitPaths.length} match(es).`, 'ok');

            updateSearchUi();

            // Highlight ALL matches (row + bright text), progressively to avoid UI freeze
            highlightAllHitsProgressive(trimmed);

            if (autoJump) jumpToHit(0, trimmed);

        });
    }

    function jumpToHit(idx, queryForInlineMark = '') {
        if (!state.hitPaths.length) return;

        const path = state.hitPaths[idx];
        const el = ensurePathRendered(path);

        if (el) el.classList.add('jp-hit');

        if (el) {
            if (el.tagName === 'DETAILS') {
                const sum = el.querySelector(':scope > summary.jp-row');
                if (sum) activateEl(sum, queryForInlineMark);
                else activateEl(el, queryForInlineMark);
            } else {
                activateEl(el, queryForInlineMark);
            }
        }

        updateSearchUi();
    }

    function nextHit() {
        const q = (state.searchInput?.value || '').trim();

        if (!q) return;

        if (!state.hitPaths.length) {
            runSearch(q, { silentStatus: true, autoJump: true });
            return;
        }

        state.hitIndex = (state.hitIndex + 1) % state.hitPaths.length;
        jumpToHit(state.hitIndex, q);
    }

    function prevHit() {
        const q = (state.searchInput?.value || '').trim();
        if (!q) return;

        if (!state.hitPaths.length) {
            runSearch(q, { silentStatus: true, autoJump: true });
            return;
        }

        state.hitIndex = (state.hitIndex - 1 + state.hitPaths.length) % state.hitPaths.length;
        jumpToHit(state.hitIndex, q);
    }


    function highlightAllHitsProgressive(query) {
        const q = String(query || '').trim();
        if (!q) return;

        // cancel previous highlight job (if any)
        if (state.highlightJob?.id) cancelSchedule(state.highlightJob.id);
        state.highlightJob = null;

        // Remove previous row-hit marks
        state.view?.querySelectorAll('.jp-hit').forEach(el => el.classList.remove('jp-hit'));

        // IMPORTANT: clear old inline highlights globally before applying new query
        state.view?.querySelectorAll('.jp-searchable').forEach(el => unwrapInlineMarks(el));

        const paths = state.hitPaths.slice(0); // copy
        if (!paths.length) return;

        let i = 0;
        const job = { id: null };

        const step = (deadline) => {
            const timeBudget = typeof deadline?.timeRemaining === 'function'
                ? deadline.timeRemaining()
                : 0;

            let iter = 0;

            while (i < paths.length) {
                // If query changed while we were chunk-highlighting — stop
                if (q !== state.lastQuery) return;
                const path = paths[i++];
                const el = ensurePathRendered(path);

                if (el) {
                    // we mark the row element, not the details container
                    const rowEl = (el.tagName === 'DETAILS')
                        ? (el.querySelector(':scope > summary.jp-row') || el)
                        : el;

                    rowEl.classList.add('jp-hit');
                    markInlineMatchInEl(rowEl, q);
                }

                iter++;
                if (iter >= 120) break;
                if (timeBudget && timeBudget < 8) break;
            }

            requestRenumber();

            if (i < paths.length) {
                job.id = schedule(step);
            }
        };

        job.id = schedule(step);
        state.highlightJob = job;
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
                ensureDetailsRendered(d);

                const kids = d.querySelectorAll(':scope > .jp-children > details.jp-branch');
                kids.forEach(k => queue.push(k));

                iterations++;
                if (iterations >= 120) break;
                if (timeBudget && timeBudget < 8) break;
            }

            requestRenumber();
            scheduleGuidesUpdate();

            if (queue.length) {
                job.id = schedule(step);
            } else {
                setExpandButtonsDisabled(false);
                setStatus('All expanded.', 'ok');
                state.expandJob = null;
                scheduleGuidesUpdate();
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

            if (d !== state.rootEl) {
                const children = d.querySelector('.jp-children');
                if (children) children.innerHTML = '';
                d.dataset.jpRendered = '0';
            }
        });

        clearSearchVisuals();
        updateSearchUi();
        setStatus('All collapsed.', 'ok');

        clearGuides();
        requestRenumber();
        scheduleGuidesUpdate();
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

                        <div class="jp-searchWrap" role="search">
                            <input id="jpSearch" class="jp-search" type="text" placeholder="Search in JSON..." autocomplete="off" />
                            <button class="jp-searchX" type="button" aria-label="Clear search" title="Clear">×</button>
                        </div>

                        <div class="jp-searchMeta" aria-label="Search matches">
                            <div class="jp-searchCounter"></div>
                            <button class="jp-navBtn" type="button" data-act="searchUp" aria-label="Previous match" title="Previous (Shift+Enter)">▲</button>
                            <button class="jp-navBtn" type="button" data-act="searchDown" aria-label="Next match" title="Next (Enter)">▼</button>
                        </div>
                    </div>

                    <div class="jp-hint">Live search • Enter = next • Shift+Enter = previous • Esc = clear</div>
                </div>

                <div class="jp-output jp-outputCode" tabindex="0"></div>
            </div>
        `;

        container.appendChild(view);

        state.view = view;

        state.input = view.querySelector('#jpInput');
        state.output = view.querySelector('.jp-output');
        state.status = view.querySelector('.jp-status');

        // Create overlay layer for indent guides (inside output)
        if (state.output) {
            const guides = document.createElement('div');
            guides.className = 'jp-guides';
            state.output.appendChild(guides);
            state.guidesLayer = guides;

            // Guides must track scroll
            state.output.addEventListener('scroll', () => {
                scheduleGuidesUpdate();
            });

            // and window resize (layout changes)
            window.addEventListener('resize', () => {
                scheduleGuidesUpdate();
            });
        }


        // copy: strip non-copy annotations
        state.output.addEventListener('copy', (e) => {
            try {
                const sel = window.getSelection?.();
                if (!sel || sel.rangeCount === 0) return;

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
            } catch (_) { }
        });

        state.parseBtn = view.querySelector('[data-act="parse"]');
        state.clearBtn = view.querySelector('[data-act="clear"]');

        state.searchInput = view.querySelector('#jpSearch');
        state.searchClearX = view.querySelector('.jp-searchX');
        state.searchCounter = view.querySelector('.jp-searchCounter');
        state.searchUpBtn = view.querySelector('[data-act="searchUp"]');
        state.searchDownBtn = view.querySelector('[data-act="searchDown"]');

        state.expandAllBtn = view.querySelector('[data-act="expandAll"]');
        state.collapseAllBtn = view.querySelector('[data-act="collapseAll"]');

        state.parseBtn.addEventListener('click', parseAndRender);

        state.clearBtn.addEventListener('click', () => {
            state.input.value = '';
            if (state.searchInput) state.searchInput.value = '';
            clearOutput();
            setStatus('Cleared.', 'info');
            state.input.focus();
        });

        state.expandAllBtn.addEventListener('click', expandAllChunked);
        state.collapseAllBtn.addEventListener('click', collapseAll);

        // input shortcuts
        state.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                parseAndRender();
            }
        });

        // ===== VSCode-like live search =====

        function triggerLiveSearch() {
            const qRaw = String(state.searchInput?.value || '');

            // show/hide X immediately
            updateSearchUi();

            // debounce to avoid too many runs on fast typing
            if (state.searchDebounceT) clearTimeout(state.searchDebounceT);

            state.searchDebounceT = setTimeout(() => {
                state.searchDebounceT = 0;
                runSearch(qRaw, { silentStatus: true, autoJump: true });
            }, 70);
        }

        state.searchInput.addEventListener('input', triggerLiveSearch);

        state.searchClearX.addEventListener('click', () => {
            state.searchInput.value = '';
            state.lastQuery = '';
            clearSearchVisuals();
            updateSearchUi();
            state.searchInput.focus();
        });

        state.searchDownBtn.addEventListener('click', nextHit);
        state.searchUpBtn.addEventListener('click', prevHit);

        state.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                state.searchInput.value = '';
                state.lastQuery = '';
                clearSearchVisuals();
                updateSearchUi();
                return;
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) prevHit();
                else nextHit();
            }
        });

        setStatus('Paste JSON into the input and click Parse.', 'info');
        updateSearchUi();
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
