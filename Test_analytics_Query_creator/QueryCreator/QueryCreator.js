// === Tool registration (Query Creator) ===
// Лёгкая защита от двойной инициализации + автоподстановка разметки
(function () {
    let _inited = false;

    // Если #qc-root ещё не в DOM: подгружаем его из файла и монтируем в #tool-root
    async function ensureMarkup(container) {
        let tpl = document.getElementById('qc-root');
        if (!tpl) {
            const tryPaths = ['QueryCreator.html', 'QueryCreator/QueryCreator.html'];
            for (const p of tryPaths) {
                try {
                    const res = await fetch(p, { cache: 'no-store' });
                    if (res.ok) {
                        const html = await res.text();
                        const ghost = document.createElement('div');
                        ghost.innerHTML = html;
                        tpl = ghost.querySelector('#qc-root');
                        if (tpl) break;
                    }
                } catch (_) {
                    // игнор — попробуем следующий путь
                }
            }
        }
        if (!tpl) {
            console.warn('[QC] #qc-root не найден и файл разметки не удалось загрузить. ' +
                'Убедись, что QueryCreator.html лежит рядом со скриптом или добавь <section id="qc-root"> прямо в страницу.');
            return; // НЕ кидаем исключение, чтобы не уронить инициализацию
        }

        const mountPoint = container || document.getElementById('tool-root') || document.body;
        if (!mountPoint.querySelector('#qc-root')) {
            mountPoint.appendChild(tpl.cloneNode(true));
        }
    }

    // ДЕЛАЕМ init асинхронным и сначала гарантируем разметку
    async function init(container) {
        if (_inited) return;
        _inited = true;

        await ensureMarkup(container);

        // Простая утилита: безопасный split строк на TAB (TSV из Google Sheets)
        function parseTSV(text) {
            // Удалим пустые хвосты и разбиваем на строки
            const rows = text
                .trim()
                .split(/\r?\n/)
                .map(line => line.split('\t').map(c => c.trim()));
            return rows;
        }

        // Разворачиваем спец-шаблоны свойств (* → 1..5) + убираем дубли с сохранением порядка
        function expandProps(list) {
            const out = [];
            for (const name of (list || [])) {
                if (name === 'transaction_item_*') {
                    for (let i = 1; i <= 5; i++) out.push(`transaction_item_${i}`);
                } else if (name === 'transaction_item_amount_*') {
                    for (let i = 1; i <= 5; i++) out.push(`transaction_item_amount_${i}`);
                } else {
                    out.push(name);
                }
            }
            const seen = new Set();
            return out.filter(n => n && !seen.has(n) && (seen.add(n), true));
        }

        // Всегда добавляем 'c' в конец списка полей (без дубля)
        function ensureTrailingC(arr) {
            const list = (arr || []).filter(Boolean);
            const withoutC = list.filter(n => n !== 'c');
            return [...withoutC, 'c'];
        }

        // === Заголовки столбцов: нормализация + варианты названий ===
        const normalizeHeader = (s) =>
            (s ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

        /** допустимые заголовки для колонки событий */
        const EVENT_HEADERS = ['event', 'events'];

        /** допустимые заголовки для колонки свойств */
        const PROP_HEADERS = ['property', 'properties', 'field', 'fields'];

        /** находит индекс первого заголовка из candidates */
        const findHeaderIndex = (headersNormalized, candidates) =>
            headersNormalized.findIndex(h => candidates.includes(h));

        const state = {
            rows: [],
            headers: [],
            colIdx: { event: -1, property: -1 },

            // общий словарь event -> [properties] (как было)
            byEvent: new Map(),

            // источник для каждого event: 'client' | 'server' | 'none'
            sourceOfEvent: new Map(),
        };

        const els = {
            pasteArea: document.getElementById('pasteArea'),
            parseBtn: document.getElementById('parseBtn'),
            parseStatus: document.getElementById('parseStatus'),
            eventPicker: document.getElementById('eventPicker'),
            eventSelect: document.getElementById('eventSelect'),
            genBtn: document.getElementById('genBtn'),
            sqlOutput: document.getElementById('sqlOutput'),
            copyBtn: document.getElementById('copyBtn'),
            copyStatus: document.getElementById('copyStatus'),
            tableEnv: document.getElementById('tableEnv'),
            mode: document.getElementById('mode'),
            selectAllEvents: document.getElementById('selectAllEvents'),
            refreshBtn: document.getElementById('refreshBtn'),
            errorBox: document.getElementById('errorBox'),
            infoBox: document.getElementById('infoBox'),
            clearBtn: document.getElementById('clearBtn'),
            eventsInput: document.getElementById('eventsInput'),
            propertiesInput: document.getElementById('propertiesInput'),
            tlsFile: document.getElementById('tlsFile'),
            eventSourceSeparate: document.getElementById('eventSourceSeparate'),
            eventSourcePaste: document.getElementById('eventSourcePaste'),

            // режимы ввода
            modeSeparate: document.getElementById('modeSeparate'),
            modeFile: document.getElementById('modeFile'),
            modePaste: document.getElementById('modePaste'),

            eventList: document.getElementById('eventList'),
            selectAllBtn: document.getElementById('selectAllBtn'),
            clearAllBtn: document.getElementById('clearAllBtn'),
            downloadBtn: document.getElementById('downloadBtn'),

            perEventBtn: document.getElementById('perEventBtn'),
            perEventControls: document.getElementById('perEventControls'),
            perEventContainer: document.getElementById('perEventContainer'),
            perEventAllWrap: document.getElementById('perEventAllWrap'),
            downloadAllPerBtn: document.getElementById('downloadAllPerBtn'),
            // --- Download All (bottom) split button ---
            downloadAllSplit: document.getElementById('downloadAllSplit'),
            downloadAllMenu: document.getElementById('downloadAllMenu'),
            downloadAllOptTxt: document.getElementById('downloadAllOptTxt'),
            downloadAllOptCsv: document.getElementById('downloadAllOptCsv'),

            downloadCsvBtn: document.getElementById('downloadCsvBtn'),
            csvInfo: document.getElementById('csvInfo'),
            csvInfoTip: document.getElementById('csvInfoTip'),
            clearBottom: document.getElementById('clearBottom'),
            clearBottomRight: document.getElementById('clearBottomRight'),

            // --- Дата ---
            dateModeToday: document.getElementById('dateModeToday'),
            dateModeRange: document.getElementById('dateModeRange'),
            dateStart: document.getElementById('dateStart'),
            dateEnd: document.getElementById('dateEnd'),
            todayText: document.getElementById('todayText'),

            // +++ HowTo +++
            howtoBtn: document.getElementById('howtoBtn'),
            howtoTooltip: document.getElementById('howtoTooltip'),

            topBtnGrid: document.getElementById('topBtnGrid'),
            underTopGrid: document.getElementById('underTopGrid'),
            clearTopSlot: document.getElementById('clearTopSlot'),
            refreshBtn: document.getElementById('refreshBtn'),
            refreshSlot: document.getElementById('refreshSlot'),

            copyBtnPer: document.getElementById('copyBtnPer'),
            refreshBtnPer: document.getElementById('refreshBtnPer'),
            refreshPageBtn: document.getElementById('refreshPageBtn'),

            // --- NEW: комбинированные Download-кнопки ---
            downloadCombo: document.getElementById('downloadCombo'),
            downloadComboBtn: document.getElementById('downloadComboBtn'),
            downloadTxtTop: document.getElementById('downloadTxtTop'),
            downloadCsvTop: document.getElementById('downloadCsvTop'),

            downloadAllCombo: document.getElementById('downloadAllCombo'),
            downloadAllComboBtn: document.getElementById('downloadAllComboBtn'),
            downloadAllMenu: document.getElementById('downloadAllMenu'),
            downloadAllTxt: document.getElementById('downloadAllTxt'),
            downloadAllCsv: document.getElementById('downloadAllCsv'),
            // --- Download (TOP) split button ---
            downloadSplit: document.getElementById('downloadSplit'),
            downloadMenu: document.getElementById('downloadMenu'),
            downloadOptTxt: document.getElementById('downloadOptTxt'),
            downloadOptCsv: document.getElementById('downloadOptCsv'),

            genBtn: document.getElementById('genBtn'),
            genError: document.getElementById('genError'),

            // dual-file
            oneTable: document.getElementById('oneTable'),
            twoTables: document.getElementById('twoTables'),
            tlsFileA: document.getElementById('tlsFileA'),
            tlsFileB: document.getElementById('tlsFileB'),
            eventSourceA: document.getElementById('eventSourceA'),
            eventSourceB: document.getElementById('eventSourceB'),

            // grouped event lists
            eventListClient: document.getElementById('eventListClient'),
            eventListServer: document.getElementById('eventListServer'),
            eventsClientWrap: document.getElementById('eventsClientWrap'),
            eventsServerWrap: document.getElementById('eventsServerWrap'),

            // grouped event lists
            eventListClient: document.getElementById('eventListClient'),
            eventListServer: document.getElementById('eventListServer'),
            eventListNone: document.getElementById('eventListNone'),   // NEW
            eventsClientWrap: document.getElementById('eventsClientWrap'),
            eventsServerWrap: document.getElementById('eventsServerWrap'),
            eventsNoneWrap: document.getElementById('eventsNoneWrap'), // NEW


        };

        // --- ID-алиасы: если разметка ещё со старыми ID ---
        els.downloadSplit = els.downloadSplit || els.downloadComboBtn;
        els.downloadOptTxt = els.downloadOptTxt || els.downloadTxtTop;
        els.downloadOptCsv = els.downloadOptCsv || els.downloadCsvTop;

        els.downloadAllSplit = els.downloadAllSplit || els.downloadAllComboBtn;
        els.downloadAllOptTxt = els.downloadAllOptTxt || els.downloadAllTxt;
        els.downloadAllOptCsv = els.downloadAllOptCsv || els.downloadAllCsv;


        // --- локальные Select all / Clear под каждым списком (делегирование на eventPicker) ---
        els.eventPicker?.addEventListener('click', (e) => {
            const btn = e.target.closest('button.select-clear');
            if (!btn) return;

            const wrap = btn.closest('#eventsClientWrap, #eventsServerWrap, #eventsNoneWrap');

            if (!wrap) return;

            const list = wrap.querySelector('.event-list');
            if (!list) return;

            const boxes = list.querySelectorAll('input[type="checkbox"]');
            const action = btn.dataset.action;

            if (action === 'select-all') {
                boxes.forEach(cb => { cb.checked = true; });
            } else if (action === 'clear') {
                boxes.forEach(cb => { cb.checked = false; });
            }

            // обновить подсказку и внутреннее состояние, если функции есть
            try { if (typeof updateGenError === 'function') updateGenError(); } catch (_) { }
            try { if (typeof recalcState === 'function') recalcState(); } catch (_) { }
        });

        ////////////////////////  Modal start  /////////////////////////////

        // --- CSV modal state/handlers ---
        let csvCtx = null; // { getRows: ()=>[{title,sql},...], fileNamePrefix: 'Query' }

        function openCsvModal(ctx) {
            csvCtx = ctx || {};
            const m = document.getElementById('csvModal'); if (!m) return;

            // ← СБРОСИТЬ ВСЮ ФОРМУ К ДЕФОЛТАМ (placeholder для select и пустой input)
            const form = document.getElementById('csvForm');
            if (form) form.reset();

            // очистить кастомную ошибку
            const err = document.getElementById('csvSquadError');
            if (err) err.textContent = '';

            // при выборе значения — прятать ошибку
            const sel = document.getElementById('csvSquad');
            if (sel) {
                sel.onchange = sel.oninput = () => {
                    const e = document.getElementById('csvSquadError');
                    if (e) e.textContent = '';
                };
            }

            m.classList.remove('hidden');
        }

        function closeCsvModal() {
            const form = document.getElementById('csvForm');
            if (form) form.reset();
            const m = document.getElementById('csvModal'); if (m) m.classList.add('hidden');
            csvCtx = null;
        }

        document.getElementById('csvCancel')?.addEventListener('click', closeCsvModal);
        document.getElementById('csvModal')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('qc-modal__backdrop')) closeCsvModal();
        });
        window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCsvModal(); });

        document.getElementById('csvForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const sel = document.getElementById('csvSquad');
            const folderExtra = (document.getElementById('csvFolder')?.value || '').trim();
            const err = document.getElementById('csvSquadError');

            const squad = sel?.value?.trim();
            if (!squad) { if (err) err.textContent = 'Please select a Squad.'; return; }

            // Folder: "/SQx" или "/SQ Core" + optional "/{suite}"
            const folder = `/${squad}${folderExtra ? `/${folderExtra}` : ''}`;

            const rows = (csvCtx && typeof csvCtx.getRows === 'function') ? csvCtx.getRows() : [];
            if (!rows.length) { closeCsvModal(); return; }

            const csv = buildCsv(rows, { folder, squad });

            // Имя файла: <SQ>[_<feature>]_ <base> _YYYY-MM-DD_HH_MM_SS.csv
            const base = csvCtx?.fileNamePrefix || 'Query';

            // "SQ Core" -> "SQ_Core"
            const safeSquad = (squad || '').replace(/\s+/g, '_');

            // suite/feature из второго поля: пробелы/слэши -> "_", схлопываем "__", обрезаем края
            const safeSuite = (folderExtra || '')
                .replace(/[\\\/\s]+/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '');

            const finalPrefix = [safeSquad, safeSuite, base].filter(Boolean).join('_');

            saveBlob(csv, tsName(finalPrefix, 'csv'), 'text/csv;charset=utf-8');
            closeCsvModal();

        });

        ////////////////////////  Column map modal start  /////////////////////////////

        // --- Column mapping modal state/handlers ---
        let colMapCtx = null; // { headersRaw:[], headersNorm:[], onApply:(eventIdx, propIdx)=>void }

        function guessHeader(headersRaw, headersNorm, testerFn) {
            for (let i = 0; i < headersNorm.length; i++) {
                const hn = headersNorm[i] || '';
                if (testerFn(hn)) return headersRaw[i] || '';
            }
            return '';
        }

        function openColMapModal(ctx) {
            colMapCtx = ctx || {};
            const m = document.getElementById('colMapModal'); if (!m) return;

            const headersRaw = colMapCtx.headersRaw || [];
            const headersNorm = colMapCtx.headersNorm || headersRaw.map(h => normalizeHeader(h));

            // chips
            const chips = document.getElementById('colMapHeaders');
            if (chips) {
                chips.innerHTML = '';
                headersRaw.forEach(h => {
                    const chip = document.createElement('span');
                    chip.className = 'colmap-chip';
                    chip.textContent = String(h || '').trim();
                    chips.appendChild(chip);
                });
            }

            // datalist options
            const dl = document.getElementById('colMapHeaderList');
            if (dl) {
                dl.innerHTML = '';
                headersRaw.forEach(h => {
                    const opt = document.createElement('option');
                    opt.value = String(h || '').trim();
                    dl.appendChild(opt);
                });
            }

            // reset errors
            const eErr = document.getElementById('colMapEventError'); if (eErr) eErr.textContent = '';
            const pErr = document.getElementById('colMapPropError'); if (pErr) pErr.textContent = '';

            // prefill: try stored map → heuristic → empty
            const evInput = document.getElementById('colMapEvent');
            const prInput = document.getElementById('colMapProp');

            const storedEv = state?.customHeaderMap?.event || '';
            const storedPr = state?.customHeaderMap?.property || '';

            const storedEvRaw = storedEv ? (headersRaw[headersNorm.indexOf(storedEv)] || '') : '';
            const storedPrRaw = storedPr ? (headersRaw[headersNorm.indexOf(storedPr)] || '') : '';

            const guessEv = guessHeader(headersRaw, headersNorm, (h) => /\bevent\b/.test(h));
            const guessPr = guessHeader(headersRaw, headersNorm, (h) => /\b(property|properties|field|fields|column|columns)\b/.test(h));

            if (evInput) evInput.value = storedEvRaw || guessEv || '';
            if (prInput) prInput.value = storedPrRaw || guessPr || '';

            // hide other warnings to reduce noise
            try { els.errorBox?.classList.add('hidden'); if (els.errorBox) els.errorBox.innerHTML = ''; } catch (_) { }
            try { els.infoBox?.classList.add('hidden'); if (els.infoBox) els.infoBox.innerHTML = ''; } catch (_) { }

            m.classList.remove('hidden');
        }

        function closeColMapModal() {
            const m = document.getElementById('colMapModal'); if (m) m.classList.add('hidden');
            colMapCtx = null;
        }

        document.getElementById('colMapCancel')?.addEventListener('click', closeColMapModal);
        document.getElementById('colMapModal')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('qc-modal__backdrop')) closeColMapModal();
        });
        window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeColMapModal(); });

        // apply mapping
        document.getElementById('colMapForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const headersRaw = colMapCtx?.headersRaw || [];
            const headersNorm = colMapCtx?.headersNorm || headersRaw.map(h => normalizeHeader(h));

            const evInput = document.getElementById('colMapEvent');
            const prInput = document.getElementById('colMapProp');

            const evNameRaw = (evInput?.value || '').trim();
            const prNameRaw = (prInput?.value || '').trim();

            const evName = normalizeHeader(evNameRaw);
            const prName = normalizeHeader(prNameRaw);

            const eErr = document.getElementById('colMapEventError');
            const pErr = document.getElementById('colMapPropError');
            if (eErr) eErr.textContent = '';
            if (pErr) pErr.textContent = '';

            const evIdx = headersNorm.indexOf(evName);
            const prIdx = headersNorm.indexOf(prName);

            let ok = true;
            if (!evNameRaw || evIdx === -1) { ok = false; if (eErr) eErr.textContent = 'Please enter a valid header from the list above.'; }
            if (!prNameRaw || prIdx === -1) { ok = false; if (pErr) pErr.textContent = 'Please enter a valid header from the list above.'; }
            if (!ok) return;

            // save for next parses
            state.customHeaderMap = { event: evName, property: prName };

            const apply = colMapCtx?.onApply;
            closeColMapModal();
            try { if (typeof apply === 'function') apply(evIdx, prIdx); } catch (_) { }
        });

        ////////////////////////  Column map modal end  /////////////////////////////

        ////////////////////////  Modal end  /////////////////////////////

        function moveRefreshToTop() {
            if (!els.refreshBtn || !els.topBtnGrid) return;
            // поставить Refresh ВМЕСТО .txt (в правую ячейку TOP)
            if (!els.topBtnGrid.contains(els.refreshBtn)) els.topBtnGrid.appendChild(els.refreshBtn);
        }
        function moveRefreshUnderTop() {
            if (!els.refreshBtn || !els.refreshSlot) return;
            if (!els.refreshSlot.contains(els.refreshBtn)) els.refreshSlot.appendChild(els.refreshBtn);
        }

        function setStateS0() {
            // TOP: Copy | Clear
            els.downloadCombo?.classList.add('hidden');

            // Clear наверх и «верхний» вид
            moveClearBackToTopRow();
            els.clearBtn?.classList.remove('hidden');
            els.clearBtn?.classList.add('clear-top');

            // нижний ряд и общий 2×2 прячем
            els.underTopGrid?.classList.add('hidden');
            els.perEventAllWrap?.classList.add('hidden');
            if (els.underTopGrid) els.underTopGrid.style.display = 'none';

            // закрыть возможные выпадашки
            closeAllDownloadMenus?.();

            // спрятать всё per-event
            if (els.perEventControls) els.perEventControls.style.display = 'none';
            if (els.perEventContainer) { els.perEventContainer.style.display = 'none'; els.perEventContainer.innerHTML = ''; }
            if (els.perEventAllWrap) els.perEventAllWrap.style.display = 'none';
        }

        function setStateS1() {
            // TOP: Copy | Download (dropdown)
            els.downloadCombo?.classList.remove('hidden');

            // Clear сверху скрываем — место занял Download
            els.clearBtn?.classList.add('hidden');

            // UNDER-TOP нам не нужен в этой версии
            els.underTopGrid?.classList.add('hidden');
            if (els.downloadCsvBtn) els.downloadCsvBtn.classList.add('hidden');

            // пер-ивент скрыт
            if (els.perEventControls) els.perEventControls.style.display = 'none';
            if (els.perEventAllWrap) els.perEventAllWrap.style.display = 'none';

            closeAllDownloadMenus?.();
        }

        function setStateS2() {
            setStateS1();
            if (els.perEventControls) els.perEventControls.style.display = 'flex';
            closeAllDownloadMenus?.();
        }

        function setStateS3() {
            // // в режиме per-event: Download (TOP) и Clear скрываем
            // els.downloadCombo?.classList.add('hidden');
            // els.clearBtn?.classList.add('hidden');

            // В per-event: прячем только Download (TOP), Clear остаётся на месте в clearTopSlot
            els.downloadCombo?.classList.add('hidden');
            els.clearBtn?.classList.remove('hidden');
            moveClearBackToTopRow();

            // верхний UNDER-TOP прячем, общий низ показываем
            els.underTopGrid?.classList.add('hidden');
            els.perEventAllWrap?.classList.remove('hidden');
            if (els.perEventAllWrap) els.perEventAllWrap.style.display = ''; // снять возможный inline 'none'

            if (els.perEventControls) els.perEventControls.style.display = 'none';
            closeAllDownloadMenus?.();
        }

        // --- UI memory for right panel ---
        const ui = {
            lastGeneratedEvents: [],   // массив имён ивентов на момент последней генерации
            perEventShown: false,       // true, когда открыт режим per-event
            lastPrimarySource: 'none'
        };


        const WARN_SIGN = '<span class="warn-emoji" aria-hidden="true">⚠️</span>';

        // --- Select all / Clear all (навешиваем один раз при загрузке) ---
        els.selectAllBtn?.addEventListener('click', () => {
            els.eventList?.querySelectorAll('input[type="checkbox"]')
                .forEach(cb => cb.checked = true);
            updateGenError();
        });

        els.clearAllBtn?.addEventListener('click', () => {
            els.eventList?.querySelectorAll('input[type="checkbox"]')
                .forEach(cb => cb.checked = false);
            updateGenError();
        });

        const recalcOnlyIfNoSql = () => {
            if (!els.sqlOutput?.value || !els.sqlOutput.value.trim()) recalcState();
        };

        els.eventList?.addEventListener('change', () => { recalcOnlyIfNoSql(); updateGenError(); });
        els.selectAllBtn?.addEventListener('click', () => { recalcOnlyIfNoSql(); updateGenError(); });
        els.clearAllBtn?.addEventListener('click', () => { recalcOnlyIfNoSql(); updateGenError(); });


        // Флаг: начинать показывать ошибку только после первой неудачной попытки генерации
        let genErrorArmed = false;

        // Показ/скрытие сообщения под кнопкой в зависимости от выбранных ивентов
        function updateGenError() {
            if (!els.genError) return;
            const selectedCount = document.querySelectorAll('#eventPicker input[type="checkbox"]:checked').length;
            if (genErrorArmed && selectedCount === 0) {
                els.genError.textContent = 'Please select at least one event';
                els.genError.classList.remove('hidden');
            } else {
                els.genError.textContent = '';
                els.genError.classList.add('hidden');
            }
        }

        // --- HowTo tooltip open/close + scroll-hint ---

        const backdropEl = document.getElementById('howtoBackdrop');

        function openHowto() {
            els.howtoTooltip?.classList.add('open');
            if (backdropEl) backdropEl.hidden = false;
        }

        function closeHowto() {
            els.howtoTooltip?.classList.remove('open');
            if (backdropEl) backdropEl.hidden = true;
        }

        els.howtoBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!els.howtoTooltip) return;
            if (els.howtoTooltip.classList.contains('open')) {
                closeHowto();
            } else {
                openHowto();
            }
        });

        // маленькая "i" рядом с "Upload TSV/TLS file"
        document.getElementById('modeFileInfo')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // ← важно: не даём всплыть до document-клик-закрывалки
            openHowto();
            const firstStep = els.howtoTooltip?.querySelector('.howto-tooltip__body ol > li');
            firstStep?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });



        // Клик вне тултипа — закрыть (но игнорим клик по модальному zoom-изображению)
        document.addEventListener('click', (e) => {
            if (document.getElementById('howtoImgOverlay')) return;
            if (!els.howtoTooltip || !els.howtoTooltip.classList.contains('open')) return;
            const insideTip = e.target.closest('#howtoTooltip');
            const onBtn = e.target.closest('#howtoBtn, #modeFileInfo'); // ← добавили вашу кнопку
            if (insideTip || onBtn) return;
            closeHowto();
        });


        // Клик по бэкдропу — тоже закрыть
        backdropEl?.addEventListener('click', closeHowto);

        // ESC — закрыть
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeHowto();
        });


        // --- HowTo image zoom (overlay) ---
        function openHowtoImageOverlay(src, alt = '', zoomHalf = false) {
            closeHowtoImageOverlay();

            const overlay = document.createElement('div');
            overlay.id = 'howtoImgOverlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');

            overlay.innerHTML = `
    <div class="howto-img-modal">
      <img src="${src}" alt="${alt}" class="${zoomHalf ? 'zoom-half' : ''}">
    </div>
  `;

            // клик по фону — закрывает только картинку; событие не «пробрасываем»,
            // чтобы не закрывать HowTo-подсказку
            overlay.addEventListener('click', (e) => {
                e.stopPropagation();
                const box = e.target.closest('.howto-img-modal');
                if (!box) closeHowtoImageOverlay();
            });

            window.addEventListener('keydown', onEscCloseOverlay);
            document.body.appendChild(overlay);

            // === NEW: клик по самой картинке тоже закрывает оверлей (zoom-out)
            const enlargedImg = overlay.querySelector('.howto-img-modal img');
            if (enlargedImg) {
                enlargedImg.addEventListener('click', (e) => {
                    e.stopPropagation();        // не даём уйти клику на overlay
                    closeHowtoImageOverlay();   // закрываем только картинку
                });
            }

        }

        els.howtoTooltip?.addEventListener('click', (e) => {
            const wrap = e.target.closest('.howto-img-wrap');
            if (!wrap) return;
            const img = wrap.querySelector('img.howto-img');
            if (!img) return;

            const zoomHalf = (img.dataset.zoom === 'half') || img.classList.contains('howto-img--testomat');
            openHowtoImageOverlay(img.src, img.alt, zoomHalf); // ← передаём флаг уменьшения
        });

        function closeHowtoImageOverlay() {
            const overlay = document.getElementById('howtoImgOverlay');
            if (overlay) overlay.remove();
            window.removeEventListener('keydown', onEscCloseOverlay);
        }

        function onEscCloseOverlay(e) {
            if (e.key === 'Escape') closeHowtoImageOverlay();
        }

        // === reset left-side input (files/paste/columns + lists), keep SQL on the right ===
        function resetLeftInput() {
            // 1) сброс внутреннего состояния разборки
            state.byEvent = new Map();
            state.eventOrder = [];
            state.sourceOfEvent = new Map();

            // 2) очистка списков событий и скрытие секции выбора
            try {
                els.eventListClient?.replaceChildren?.();
                els.eventListServer?.replaceChildren?.();
            } catch (_) { }
            if (els.eventsClientWrap) els.eventsClientWrap.style.display = 'none';
            if (els.eventsServerWrap) els.eventsServerWrap.style.display = 'none';
            if (els.eventPicker) els.eventPicker.style.display = 'none';

            // 3) очистить текстовые поля всех режимов
            if (els.eventsInput) els.eventsInput.value = '';
            if (els.propertiesInput) els.propertiesInput.value = '';
            if (els.pasteArea) els.pasteArea.value = '';

            // 4) сбросить ВСЕ file-инпуты (режим file): A/B (и одиночный tlsFile, если вдруг есть)
            ['tlsFileA', 'tlsFileB', 'tlsFile'].forEach(id => {
                const oldEl = document.getElementById(id);
                if (!oldEl) return;
                const clone = oldEl.cloneNode(true);
                oldEl.replaceWith(clone);
                // если этот инпут лежит в els — обновим ссылку
                if (id in els) els[id] = clone;
            });

            // 5) вернуть селекты источника таблиц к None
            if (els.eventSourceA) els.eventSourceA.value = 'none';
            if (els.eventSourceB) els.eventSourceB.value = 'none';

            // также сбрасываем источники для режимов 2/3
            if (els.eventSourceSeparate) els.eventSourceSeparate.value = 'none';
            if (els.eventSourcePaste) els.eventSourcePaste.value = 'none';

            // также сбросить "Table" во всех режимах
            if (els.tableEnv) {
                els.tableEnv.selectedIndex = 0;
                els.tableEnv.dispatchEvent(new Event('change', { bubbles: true }));
            }


            // 6) спрятать подсказки/ошибки и per-event
            if (els.genError) { els.genError.textContent = ''; els.genError.classList.add('hidden'); }
            if (els.errorBox) { els.errorBox.innerHTML = ''; els.errorBox.classList.add('hidden'); }
            if (els.infoBox) { els.infoBox.innerHTML = ''; els.infoBox.classList.add('hidden'); }
            if (els.perEventContainer) { els.perEventContainer.replaceChildren?.(); els.perEventContainer.style.display = 'none'; }
            if (els.perEventControls) els.perEventControls.style.display = 'none';
            if (els.perEventAllWrap) { els.perEventAllWrap.classList.add('hidden'); els.perEventAllWrap.style.display = 'none'; }

            // 7) ничего не трогаем справа: els.sqlOutput.value — остаётся как есть
        }

        function getInputMode() {
            if (els.modeSeparate?.checked) return 'separate';
            if (els.modeFile?.checked) return 'file';
            return 'paste';
        }
        function setInputMode(mode) {

            // при смене режима чистим левую панель (SQL справа не трогаем)
            if (ui.inputMode && ui.inputMode !== mode) {
                resetLeftInput();
            }
            ui.inputMode = mode;

            const blocks = {
                separate: document.getElementById('mode-separate'),
                file: document.getElementById('mode-file'),
                paste: document.getElementById('mode-paste'),
            };
            // активируем только нужный блок
            Object.values(blocks).forEach(b => b?.classList.remove('active'));
            if (blocks[mode]) blocks[mode].classList.add('active');

            if (mode === 'separate') {
                els.eventsInput?.scrollTo(0, 0);
                els.propertiesInput?.scrollTo(0, 0);
            }

            // скрыть инфо/ошибки при переключении
            els.infoBox?.classList.add('hidden'); if (els.infoBox) els.infoBox.innerHTML = '';
            els.errorBox?.classList.add('hidden'); if (els.errorBox) els.errorBox.innerHTML = '';

            // --- show/hide second file block ---
            function updateFileBlocks() {
                const two = !!(els.twoTables && els.twoTables.checked);

                // показываем/прячем второй блок файла
                document.getElementById('fileBlockB')?.classList.toggle('hidden', !two);

                // ВАЖНО: заголовки "Table №1/№2"
                const labA = document.getElementById('tableLabelA');
                const labB = document.getElementById('tableLabelB');

                // при 1-й таблице оба заголовка скрыты; при 2-х — оба видны
                labA?.classList.toggle('hidden', !two);
                labB?.classList.toggle('hidden', !two);
            }
            els.oneTable?.addEventListener('change', updateFileBlocks);
            els.twoTables?.addEventListener('change', updateFileBlocks);
            updateFileBlocks();


        }
        // навешиваем переключатели
        els.modeSeparate?.addEventListener('change', () => setInputMode('separate'));
        els.modeFile?.addEventListener('change', () => setInputMode('file'));
        els.modePaste?.addEventListener('change', () => setInputMode('paste'));
        // --- source change → re-tag current events and re-render ---
        function reapplySourceForCurrentEvents(src) {
            if (!state || !Array.isArray(state.eventOrder) || !state.eventOrder.length) return;
            state.sourceOfEvent = state.sourceOfEvent || new Map();
            for (const ev of state.eventOrder) state.sourceOfEvent.set(ev, src);
            renderEvents();
        }

        els.eventSourceSeparate?.addEventListener('change', () => {
            if (getInputMode() !== 'separate') return;
            reapplySourceForCurrentEvents((els.eventSourceSeparate.value || 'none').toLowerCase());
        });

        els.eventSourcePaste?.addEventListener('change', () => {
            if (getInputMode() !== 'paste') return;
            reapplySourceForCurrentEvents((els.eventSourcePaste.value || 'none').toLowerCase());
        });

        // дефолт — «separate»
        setInputMode('file');

        // --- Keep top for long pastes in separate mode ---
        function keepTop(el) {
            if (!el) return;
            const pin = () => { el.scrollTop = 0; };

            // после вставки переносим курсор и скролл в начало
            el.addEventListener('paste', () => {
                setTimeout(() => {
                    try { el.selectionStart = el.selectionEnd = 0; } catch (_) { }
                    el.scrollTop = 0;
                }, 0);
            });

            // держим верх на любых изменениях/фокусе
            el.addEventListener('input', pin);
            el.addEventListener('focus', pin);
            el.addEventListener('keyup', pin);
        }

        keepTop(els.eventsInput);
        keepTop(els.propertiesInput);

        // --- Auto-resize for Event/Property textareas ---
        function autoResizeTA(ta) {
            if (!ta) return;
            ta.style.height = 'auto';
            ta.style.height = (ta.scrollHeight + 2) + 'px'; // +2px на границы
            ta.scrollTop = 0; // всегда «сверху»
        }

        [els.eventsInput, els.propertiesInput].forEach((ta) => {
            if (!ta) return;
            // первичная подгонка (если что-то уже вставлено)
            autoResizeTA(ta);
            // при вводе/вставке — пересчитать
            ta.addEventListener('input', () => autoResizeTA(ta));
            ta.addEventListener('paste', () => setTimeout(() => autoResizeTA(ta), 0));
        });

        // ---- Clean pasted TSV: drop empty lines ----
        function cleanPastedTSV(text) {
            // убираем BOM/zero-width, режем на строки и фильтруем строки,
            // где после удаления табов/пробелов не осталось символов
            return (text || '')
                .replace(/\uFEFF|\u200B|\u200C|\u200D/g, '')
                .split(/\r?\n/)
                .filter(line => line.replace(/[\t\s]/g, '') !== '')
                .join('\n');
        }

        // Обработка вставки из буфера
        els.pasteArea?.addEventListener('paste', (e) => {
            const cd = e.clipboardData || window.clipboardData;
            if (!cd) return; // на всякий случай — пусть браузер вставит как есть
            e.preventDefault();
            const raw = cd.getData('text/plain');
            els.pasteArea.value = cleanPastedTSV(raw);
        });

        // Поддержка "перетаскивания" текста (drag&drop)
        els.pasteArea?.addEventListener('drop', (e) => {
            e.preventDefault();
            const raw = e.dataTransfer?.getData('text/plain') || '';
            els.pasteArea.value = cleanPastedTSV(raw);
        });

        function resetTlsInput() {
            // очистить все file-инпуты на странице (как и раньше)
            const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
            for (const input of fileInputs) {
                try { input.value = ''; } catch (_) { }
                const form = input.closest('form');
                if (form) form.reset();
                else {
                    const fresh = input.cloneNode(true);
                    input.parentNode.replaceChild(fresh, input);
                }
            }

            // === ВАЖНО: пере-схватить новые DOM-элементы после клонирования ===
            els.tlsFileA = document.getElementById('tlsFileA');
            els.tlsFileB = document.getElementById('tlsFileB');

            // опционально — почистить инфобоксы и реакцию на выбор файла
            const onFileChange = () => {
                els.infoBox?.classList.add('hidden'); if (els.infoBox) els.infoBox.innerHTML = '';
                els.errorBox?.classList.add('hidden'); if (els.errorBox) els.errorBox.innerHTML = '';
            };
            els.tlsFileA?.addEventListener('change', onFileChange);
            els.tlsFileB?.addEventListener('change', onFileChange);
        }

        // ---- Инициализация даты и переключение Today/Range ----
        const pad = n => String(n).padStart(2, "0");
        const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;   // YYYY-MM-DD
        const toDMY = d => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;   // DD.MM.YYYY
        const parseDMYtoDate = str => {
            const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec((str || "").trim());
            if (!m) return null;
            return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
        };
        const parseISOtoDate = str => {
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((str || "").trim());
            if (!m) return null;
            return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        };

        const today = new Date();
        const todayISO = toISO(today);
        const todayDMY = toDMY(today);

        if (els.todayText) els.todayText.textContent = todayDMY;

        // ==== Testomat CSV config ====
        const TESTOMAT = {
            owner: 'it_testomat',
            priority: 'normal',
            status: 'manual',
            folder: '/SQ3/Sandbox - Derba/test #3',
            labels: 'TT Feature tag: , Squad: , TC Owner: ',
            url: ''
        };

        // Порядок колонок как в примере
        const CSV_HEADERS = [
            'ID', 'Title', 'Status', 'Folder', 'Emoji', 'Priority', 'Tags', 'Owner', 'Description', 'Examples', 'Labels', 'Url'
        ];

        // human-readable для столбца Labels
        function squadPretty(s) {
            if (!s) return '';
            if (s === 'SQ Core') return 'Squad Core';
            const m = /^SQ\s*([0-9]{1,2})$/.exec(s);
            return m ? `Squad ${m[1]}` : s.replace(/^SQ/i, 'Squad ');
        }

        // CSV-экранирование
        const csvEscape = (v = '') => {
            const s = String(v ?? '');
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        // Возвращает 3 строки FROM: активная без комментария, остальные — закомментированы
        function fromClauseFor(env) {
            const LINES = {
                'stage': "FROM trtdpstaging.STG_TRT_STR_EVENT.TRT_EVENT_STREAM_QA -- Staging / RC (od-rc)",
                'prod-cheats': "FROM trtstreamingdata.TRT_STR_EVENT.TRT_EVENT_STREAM_QA -- prod_cheats",
                'prod': "FROM trtstreamingdata.TRT_STR_EVENT.TRT_EVENT_STREAM -- Prod",
            };
            const order = ['stage', 'prod-cheats', 'prod'];
            const current = order.includes(env) ? env : 'prod';
            return order.map(k => (k === current ? LINES[k] : `--${LINES[k]}`)).join('\n');
        }

        // //////   NEW CODE ENDS  ///////

        // Построить SQL для одного события (пер-ивент)
        function buildPerEventSQL(ev, props, env, dateStartISO, dateEndISO, isRange, src = 'none') {
            const source = (src || 'none').toLowerCase();
            const esc = s => s.replace(/'/g, "''");
            const fromClause = fromClauseFor(env);

            const where = [];
            where.push(`WHERE user_id = 'test_user_ID'`);
            if (!isRange) {
                where.push(`AND DATE(insertion_date) >= '${dateStartISO}'`);
                where.push(`AND client_time >= '${dateStartISO} 00:00:00 UTC'`);
            } else {
                where.push(`AND DATE(insertion_date) >= '${dateStartISO}'`);
                where.push(`AND client_time BETWEEN '${dateStartISO} 00:00:00 UTC' AND '${dateEndISO} 00:00:00 UTC'`);
            }
            where.push(`AND event = '${esc(ev)}'`);
            if (source === 'server') where.push(`AND written_by = 'server'`);
            else if (source === 'client') where.push(`AND written_by = 'client'`);
            where.push(`AND twelve_traits_enabled IS NULL`);

            const expandedProps = expandProps(props || []);
            const dedupProps = Array.from(new Set(expandedProps));
            const withC = ensureTrailingC(dedupProps);

            const timeSelect =
                source === 'server' ? 'server_time' :
                    source === 'client' ? 'client_time' :
                        'client_time, server_time';

            const fields = `event, ${timeSelect}, written_by, ${withC.join(', ')}`;

            return `SELECT ${fields}
${fromClause}
${where.join('\n')}
ORDER BY ${source === 'server' ? 'server_time' : 'client_time'} DESC
--limit 1000;`;
        }

        // ==== CSV helpers ====
        const EXAMPLES_TEMPLATE =
            `## Preconditions:
—

### Steps
1. Step #1
 *Expected:*

2. Step #2
 *Expected:*`;

        function makeCsvRow({ title, sql }, opts = {}) {
            const prettySquad = squadPretty(opts.squad || '');
            const description = `## Useful query:

${sql}

${EXAMPLES_TEMPLATE}
`;
            const row = {
                ID: '',
                Title: title,
                Status: TESTOMAT.status,
                Folder: opts.folder ?? TESTOMAT.folder,
                Emoji: '',
                Priority: TESTOMAT.priority,
                Tags: '',
                Owner: TESTOMAT.owner,
                Description: description,
                Examples: '',
                Labels: prettySquad ? `Squad: ${prettySquad}` : '',
                Url: TESTOMAT.url
            };
            return CSV_HEADERS.map(h => csvEscape(row[h])).join(',');
        }

        function buildCsv(rows, opts = {}) {
            const header = CSV_HEADERS.join(',');
            const body = rows.map(r => makeCsvRow(r, opts)).join('\n');
            return header + '\n' + body + '\n';
        }

        // === [Download helpers] ============================================
        function saveBlob(text, name, mime) {
            const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = name;
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
        }
        function tsName(prefix, ext) {
            const d = new Date(), pad = n => String(n).padStart(2, '0');
            return `${prefix}_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.${ext}`;
        }

        // Добавить метку источника в Title (если есть селект eventSource)
        function withSourceTag(title, src) {
            const v = (src || '').toLowerCase();
            if (v === 'server') return `[server] ${title}`;
            if (v === 'client') return `[client] ${title}`;
            return title;
        }

        // Сбор «одного кейса» (верхний Download → .txt/.csv)
        function collectCombinedRow() {
            const sql = (els.sqlOutput?.value || '').trim();
            if (!sql) return null;

            // Берём те ивенты, которые были на последнем Generate
            const events = (ui?.lastGeneratedEvents || []).slice();

            let title = 'Combined query';               // дефолт
            if (events.length > 1) {
                // запрос: "Events: e1, e2, e3"
                title = `Events: ${events.join(', ')}`;
            } else if (events.length === 1) {
                // для одного — красиво: "Event: e1"
                title = `Event: ${events[0]}`;
            }

            const src = (ui?.lastPrimarySource || 'none').toLowerCase();
            title = withSourceTag(title, src);


            return { title, sql };
        }

        // Сбор всех карточек per-event (нижний Download All → .txt/.csv)
        function collectPerEventRows() {
            const items = Array.from(els.perEventContainer?.querySelectorAll('.per-item') || []);
            return items.map(item => {
                const ev = (item.querySelector('.title code')?.textContent ||
                    item.querySelector('.per-download')?.getAttribute('data-ev') || 'event').trim();
                const sql = (item.querySelector('textarea.per-sql')?.value || '').trim();
                const src = (item.querySelector('.title')?.dataset.source || 'none').toLowerCase();
                return sql ? { title: withSourceTag(`Event: ${ev}`, src), sql } : null;
            }).filter(Boolean);

        }
        // === [Dropdown open/close] ========================================
        function openMenu(containerEl) {
            if (!containerEl) return;
            containerEl.classList.add('open');                            // класс на .dropdown
            const menu = containerEl.querySelector('.dropdown-menu');
            menu?.setAttribute('aria-hidden', 'false');
        }
        function closeMenu(containerEl) {
            if (!containerEl) return;
            containerEl.classList.remove('open');                         // снимаем с .dropdown
            const menu = containerEl.querySelector('.dropdown-menu');
            menu?.setAttribute('aria-hidden', 'true');
        }
        function closeAllDownloadMenus() {
            closeMenu(els.downloadCombo);                                 // TOP
            closeMenu(els.downloadAllCombo);                              // BOTTOM (All)
            document.querySelectorAll('#perEventContainer .dropdown')
                .forEach(el => closeMenu(el));                              // per-event карточки
        }

        // клик снаружи — закрываем оба меню
        document.addEventListener('click', (e) => {
            // если кликнули внутри ЛЮБОГО dropdown — не закрываем
            if (e.target.closest('.dropdown')) return;
            closeAllDownloadMenus();
        });
        // ==================================================================

        function moveClearToBottom() {
            if (!els.clearBtn) return;
            if (els.clearBottomRight) {
                els.clearBottomRight.appendChild(els.clearBtn);
            } else if (els.clearBottom) {
                els.clearBottom.style.display = 'flex';
                els.clearBottom.appendChild(els.clearBtn);
            }
        }

        function moveClearToDefaultPlace() {
            if (!els.clearBtn) return;
            const mainBtns = els.clearBtn.closest('.row.btns') || document.querySelector('.row.btns');
            if (mainBtns) mainBtns.appendChild(els.clearBtn);
            if (els.clearBottom) els.clearBottom.style.display = 'none';
        }

        // Показать Clear под per-event кнопкой (ширина как у perEventBtn)
        function moveClearUnderPerEvent() {
            if (!els.clearBtn) return;
            const park = document.getElementById('clearUnderPer');
            if (park) {
                park.style.display = 'flex';
                park.appendChild(els.clearBtn);
                els.clearBtn.classList.remove('clear-top'); // внизу — не "верхний" стиль
            }
        }

        // Вернуть Clear в верхнюю строку (под Copy) — для не-per-event сценариев
        function moveClearBackToTopRow() {
            if (!els.clearBtn) return;
            const slot = els.clearTopSlot || document.getElementById('clearTopSlot');
            if (slot && els.clearBtn.parentElement !== slot) slot.appendChild(els.clearBtn);
            els.clearBtn.classList.add('clear-top'); // внешний вид «верхней» кнопки
        }

        // Когда SQL пустой и нет per-event: Clear под Copy, темно-серая и того же размера.
        // Когда есть per-event: Clear внизу (это уже делает moveClearToBottom()).
        function syncClearButtonTopState() {
            if (!els.clearBtn) return;

            const hasPerEvent = !!(els.perEventContainer && els.perEventContainer.offsetParent !== null);
            const sqlIsEmpty = !els.sqlOutput || !els.sqlOutput.value || !els.sqlOutput.value.trim();

            if (!hasPerEvent && sqlIsEmpty) {
                // держим Clear под Copy и оформляем как «верхнюю»
                // (если кнопку переносили вниз — вернём её в верхний ряд под Copy)
                const slot = els.clearTopSlot || document.getElementById('clearTopSlot');
                // if (slot && els.clearBtn.parentElement !== slot) slot.appendChild(els.clearBtn);
                els.clearBtn.classList.add('clear-top');

            } else {
                // убираем «верхний» вид
                // els.clearBtn.classList.remove('clear-top');
                els.clearBtn.classList.remove('clear-top');
            }
        }

        function recalcState() {
            // Сейчас достаточно синхронизировать расположение/видимость Clear
            // Если дальше появятся ещё действия — добавишь сюда.
            try {
                syncClearButtonTopState();
            } catch (_) { }
        }

        // заполняем отображение инпутов диапазона в формате DD.MM.YYYY
        if (els.dateStart) { els.dateStart.value = todayDMY; els.dateStart.dataset.iso = todayISO; }
        if (els.dateEnd) { els.dateEnd.value = todayDMY; els.dateEnd.dataset.iso = todayISO; }

        recalcState();

        // Переключатель диапазона — показать/скрыть блок
        function toggleDateInputs() {
            const wrap = document.getElementById('dateRangeWrap');
            const isRange = !!(els.dateModeRange && els.dateModeRange.checked);
            if (wrap) wrap.style.display = isRange ? 'flex' : 'none';
        }
        toggleDateInputs();
        els.dateModeToday?.addEventListener('change', toggleDateInputs);
        els.dateModeRange?.addEventListener('change', toggleDateInputs);

        // ------ ЛЁГКИЙ ПОП-АП КАЛЕНДАРЬ ------
        (function initDatePicker() {
            let dpEl = null;
            let boundInput = null;          // к какому инпуту сейчас привязан попап
            let current = new Date();

            function buildDP() {
                if (dpEl) return dpEl;
                dpEl = document.createElement('div');
                dpEl.className = 'dp hidden';
                dpEl.innerHTML = `
      <div class="dp-header">
        <div class="dp-nav">
          <button class="dp-btn" data-nav="-12">«</button>
          <button class="dp-btn" data-nav="-1">‹</button>
        </div>
        <div>
          <select class="dp-select" id="dpMonth"></select>
          <select class="dp-select" id="dpYear"></select>
        </div>
        <div class="dp-nav">
          <button class="dp-btn" data-nav="1">›</button>
          <button class="dp-btn" data-nav="12">»</button>
        </div>
      </div>
      <div class="dp-grid" id="dpGrid"></div>
    `;
                document.body.appendChild(dpEl);
                // заполнить селекты
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const mSel = dpEl.querySelector('#dpMonth');
                monthNames.forEach((m, i) => {
                    const o = document.createElement('option');
                    o.value = i; o.textContent = m; mSel.appendChild(o);
                });
                const ySel = dpEl.querySelector('#dpYear');
                const thisYear = (new Date()).getFullYear();
                for (let y = thisYear - 10; y <= thisYear + 10; y++) {
                    const o = document.createElement('option');
                    o.value = y; o.textContent = y; ySel.appendChild(o);
                }

                dpEl.addEventListener('click', (e) => {
                    const btn = e.target.closest('.dp-btn');
                    if (btn) {
                        const shift = Number(btn.dataset.nav || 0);
                        current.setMonth(current.getMonth() + shift);
                        render();
                        return;
                    }
                    const dayBtn = e.target.closest('.dp-day');
                    if (dayBtn && boundInput) {
                        const y = Number(dayBtn.dataset.y);
                        const m = Number(dayBtn.dataset.m);
                        const d = Number(dayBtn.dataset.d);
                        const date = new Date(y, m, d);
                        const iso = toISO(date);
                        const dmy = toDMY(date);
                        boundInput.value = dmy;
                        boundInput.dataset.iso = iso;    // для генерации SQL
                        hide();
                    }
                });

                mSel.addEventListener('change', () => { current.setMonth(Number(mSel.value)); render(); });
                ySel.addEventListener('change', () => { current.setFullYear(Number(ySel.value)); render(); });

                // клик вне попапа — закрыть
                document.addEventListener('click', (e) => {
                    if (!dpEl || dpEl.classList.contains('hidden')) return;
                    if (e.target === boundInput) return;
                    if (!dpEl.contains(e.target)) hide();
                });
                window.addEventListener('resize', () => hide());
                return dpEl;
            }

            function showForInput(input) {
                boundInput = input;
                buildDP();
                // если в инпуте уже есть дата — открыть на ней
                const d = parseDMYtoDate(input.value) || new Date();
                current = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                render();

                // позиционирование — показываем ПО-НАД инпутом
                const r = input.getBoundingClientRect();
                const gap = 8; // отступ между инпутом и попапом

                // сделать видимым, чтобы измерить высоту (без мерцания)
                dpEl.style.visibility = 'hidden';
                dpEl.classList.remove('hidden');
                const popH = dpEl.offsetHeight;

                // координаты
                const left = window.scrollX + r.left;
                let top = window.scrollY + r.top - gap - popH;

                // если не хватает места сверху — показываем снизу (фолбэк)
                if (top < window.scrollY + 8) {
                    top = window.scrollY + r.bottom + gap;
                }

                dpEl.style.left = `${left}px`;
                dpEl.style.top = `${top}px`;
                dpEl.style.visibility = 'visible';

            }

            function hide() {
                dpEl?.classList.add('hidden');
                boundInput = null;
            }

            function render() {
                const mSel = dpEl.querySelector('#dpMonth');
                const ySel = dpEl.querySelector('#dpYear');
                mSel.value = current.getMonth();
                ySel.value = current.getFullYear();

                const grid = dpEl.querySelector('#dpGrid');
                grid.innerHTML = '';

                // шапка дней (начинаем с понедельника)
                const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                dow.forEach(w => {
                    const el = document.createElement('div');
                    el.className = 'dp-dow';
                    el.textContent = w;
                    grid.appendChild(el);
                });

                // вычисляем начало сетки
                const first = new Date(current.getFullYear(), current.getMonth(), 1);
                let startIdx = first.getDay(); // 0=Sun ... 6=Sat
                if (startIdx === 0) startIdx = 7;   // хотим Mon..Sun
                const start = new Date(first);
                start.setDate(first.getDate() - (startIdx - 1));

                // 6 недель * 7 дней
                const todayKey = toISO(new Date());
                const selISO = (boundInput?.dataset.iso) || '';
                for (let i = 0; i < 42; i++) {
                    const d = new Date(start);
                    d.setDate(start.getDate() + i);
                    const cell = document.createElement('button');
                    cell.type = 'button';
                    cell.className = 'dp-day';
                    cell.dataset.y = d.getFullYear();
                    cell.dataset.m = d.getMonth();
                    cell.dataset.d = d.getDate();
                    cell.textContent = pad(d.getDate());

                    if (d.getMonth() !== current.getMonth()) {
                        cell.style.opacity = .45;
                    }
                    if (toISO(d) === todayKey) cell.classList.add('is-today');
                    if (selISO && toISO(d) === selISO) cell.classList.add('is-selected');

                    grid.appendChild(cell);
                }
            }

            // повесим на оба инпута
            [document.getElementById('dateStart'), document.getElementById('dateEnd')].forEach(inp => {
                inp?.addEventListener('click', (e) => {
                    e.preventDefault();
                    showForInput(inp);
                });
            });
        })();

        function parseFromSeparateInputs() {
            // не удаляем пустые строки — они важны для выравнивания!
            const evLines = (els.eventsInput?.value || '').replace(/\r/g, '').split('\n');
            const prLines = (els.propertiesInput?.value || '').replace(/\r/g, '').split('\n');

            // убираем заголовки, если скопировали их вместе с колонками
            // если в первой строке лежит заголовок — убираем его (с вариативностью)
            if (evLines.length && EVENT_HEADERS.includes(evLines[0].trim().toLowerCase())) {
                evLines.shift();
            }
            if (prLines.length && PROP_HEADERS.includes(prLines[0].trim().toLowerCase())) {
                prLines.shift();
            }

            state.byEvent = new Map();
            state.eventOrder = [];

            let currentEvent = null;
            const maxLen = Math.max(evLines.length, prLines.length);

            for (let i = 0; i < maxLen; i++) {
                const ev = (evLines[i] ?? '').trim();
                const pr = (prLines[i] ?? '').trim();

                // forward-fill события — как при merged-ячейках в Google Sheets
                if (ev) {
                    currentEvent = ev;
                    if (!state.byEvent.has(currentEvent)) {
                        state.byEvent.set(currentEvent, []);
                        state.eventOrder.push(currentEvent);
                    }
                }
                // добавляем property к текущему событию, если оно есть
                if (currentEvent && pr) {
                    const arr = state.byEvent.get(currentEvent);
                    if (!arr.includes(pr)) arr.push(pr);
                }
            }

            // источник для всех событий из режима "separate"
            state.sourceOfEvent = new Map();
            {
                const src = (els.eventSourceSeparate?.value || 'none').toLowerCase();
                for (const ev of (state.eventOrder || [])) {
                    state.sourceOfEvent.set(ev, src);
                }
            }

            renderEvents();
        }


        // Ingest TSV rows into state.byEvent using selected column indexes (supports merged Event cells)
        function ingestRowsFromTsv(rows, eventIdx, propIdx, sourceTag) {
            if (!rows || !rows.length) return;

            state.byEvent = state.byEvent || new Map();
            state.eventOrder = state.eventOrder || [];
            state.sourceOfEvent = state.sourceOfEvent || new Map();

            let lastEvent = '';
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || !row.length) continue;

                const ev = (row[eventIdx] ?? '').trim();
                const pr = (row[propIdx] ?? '').trim();

                if (ev) {
                    lastEvent = ev;

                    if (!state.byEvent.has(ev)) {
                        state.byEvent.set(ev, []);
                        state.eventOrder.push(ev);
                    }
                    if (!state.sourceOfEvent.has(ev)) {
                        state.sourceOfEvent.set(ev, (sourceTag || 'none'));
                    }
                }

                if (lastEvent && pr) {
                    const arr = state.byEvent.get(lastEvent) || [];
                    if (!arr.includes(pr)) arr.push(pr);
                    state.byEvent.set(lastEvent, arr);
                }
            }
        }


        function parseFromFile(file, sourceTag = 'none', done) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const text = e.target.result;
                const rows = text.split(/\r?\n/).map(r => r.split('\t'));

                const headersRaw = rows[0].map(h => (h ?? '').toString().trim());
                const headers = headersRaw.map(h => normalizeHeader(h));

                // 1) try default header candidates (Event/Events + Property/Properties/Field(s))
                let eventIdx = findHeaderIndex(headers, EVENT_HEADERS);
                let propIdx = findHeaderIndex(headers, PROP_HEADERS);

                // 2) try stored custom mapping (if user already mapped once)
                if ((eventIdx === -1 || propIdx === -1) && state.customHeaderMap) {
                    const evNorm = state.customHeaderMap.event;
                    const prNorm = state.customHeaderMap.property;
                    const evTry = evNorm ? headers.indexOf(evNorm) : -1;
                    const prTry = prNorm ? headers.indexOf(prNorm) : -1;
                    if (evTry !== -1) eventIdx = evTry;
                    if (prTry !== -1) propIdx = prTry;
                }

                if (eventIdx === -1 || propIdx === -1) {
                    // Ask user to map columns instead of hard-failing.
                    openColMapModal({
                        headersRaw,
                        headersNorm: headers,
                        onApply: (evIdx, prIdx) => {
                            ingestRowsFromTsv(rows, evIdx, prIdx, sourceTag || 'none');
                            renderEvents();
                            if (typeof done === 'function') done();
                        }
                    });
                    return;
                }


                let lastEvent = '';
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row.length) continue;

                    const ev = (row[eventIdx] ?? '').trim();
                    const pr = (row[propIdx] ?? '').trim();

                    if (ev) {
                        lastEvent = ev;

                        // регистрируем событие и его источник
                        if (!state.byEvent.has(ev)) {
                            state.byEvent.set(ev, []);
                            state.eventOrder = state.eventOrder || [];
                            state.eventOrder.push(ev);
                        }
                        if (!state.sourceOfEvent.has(ev)) {
                            state.sourceOfEvent.set(ev, sourceTag || 'none');
                        }
                    }
                    if (lastEvent && pr) {
                        const arr = state.byEvent.get(lastEvent);
                        if (!arr.includes(pr)) arr.push(pr);
                    }
                }

                renderEvents(); // отрисуем два списка
                if (typeof done === 'function') done();   // ← сигнал о завершении
            };
            reader.readAsText(file);
        }

        function renderEvents() {
            const order = state.eventOrder || [];
            const byEv = state.byEvent || new Map();

            const client = [];
            const server = [];
            const none = [];
            for (const ev of order) {
                const src = (state.sourceOfEvent.get(ev) || 'none').toLowerCase();
                if (src === 'server') server.push(ev);
                else if (src === 'client') client.push(ev);
                else none.push(ev); // отдельная группа
            }

            const paint = (wrapEl, listEl, items) => {
                if (!listEl || !wrapEl) return;
                listEl.innerHTML = '';
                wrapEl.style.display = items.length ? '' : 'none';
                for (const ev of items) {
                    const id = 'ev_' + ev.replace(/[^a-z0-9_]+/gi, '_');
                    const label = document.createElement('label');
                    label.className = 'event-item';
                    label.title = ev;

                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.value = ev;
                    cb.id = id;
                    cb.dataset.source = (state.sourceOfEvent.get(ev) || 'none');

                    const span = document.createElement('span');
                    span.textContent = ev;

                    label.appendChild(cb);
                    label.appendChild(span);
                    listEl.appendChild(label);
                }
            };

            // --- SAFE: порядок групп в левой колонке = порядок загруженных таблиц ---
            const listsCol = els.eventPicker?.querySelector('.field');
            if (listsCol && els.eventsClientWrap && els.eventsServerWrap && els.eventsNoneWrap) {
                // 1) желаемый порядок по селектам источников (A → B)
                const two = !!(els.twoTables && els.twoTables.checked);
                const srcA = (els.eventSourceA?.value || 'none').toLowerCase();
                const srcB = (els.eventSourceB?.value || 'none').toLowerCase();
                const desired = two ? [srcA, srcB] : [srcA];

                // 2) уникализируем в порядке появления
                const orderSrc = [];
                desired.forEach(s => { if (!orderSrc.includes(s)) orderSrc.push(s); });

                // 3) соответствие источник → DOM-обёртка
                const wrapBySrc = {
                    client: els.eventsClientWrap,
                    server: els.eventsServerWrap,
                    none: els.eventsNoneWrap
                };

                // 4) предварительно вытащим обёртки из колонки (если они уже там)
                ['client', 'server', 'none'].forEach(s => {
                    const w = wrapBySrc[s];
                    if (w && listsCol.contains(w)) listsCol.removeChild(w);
                });

                // 5) ставим в нужном порядке…
                orderSrc.forEach(s => {
                    const w = wrapBySrc[s];
                    if (w) listsCol.appendChild(w);
                });

                // …и добавляем те, которых не было в desired, в хвост
                ['client', 'server', 'none'].forEach(s => {
                    if (!orderSrc.includes(s)) {
                        const w = wrapBySrc[s];
                        if (w) listsCol.appendChild(w);
                    }
                });
            }

            paint(els.eventsClientWrap, els.eventListClient, client);
            paint(els.eventsServerWrap, els.eventListServer, server);
            paint(els.eventsNoneWrap, els.eventListNone, none);   // NEW


            // показать/скрыть секцию целиком
            const any = client.length + server.length + none.length > 0; // NEW
            els.eventPicker.style.display = any ? 'flex' : 'none';

            genErrorArmed = false;
            updateGenError();
            if (els.genError) { els.genError.textContent = ''; els.genError.classList.add('hidden'); }
        }

        // --- начало обработчика Decompose ---
        els.parseBtn.addEventListener('click', () => {
            // очищаем сообщения
            els.errorBox.innerHTML = '';
            els.errorBox.classList.add('hidden');
            els.infoBox.innerHTML = '';
            els.infoBox.classList.add('hidden');

            // ► Режимы ввода
            const mode = getInputMode();

            const WARN = '<span class="icon warn-emoji" aria-hidden="true">⚠️</span>';

            if (mode === 'separate') {
                const hasEvents = !!(els.eventsInput && els.eventsInput.value.trim());
                const hasProps = !!(els.propertiesInput && els.propertiesInput.value.trim());
                if (!hasEvents && !hasProps) {
                    els.infoBox.classList.remove('hidden');
                    els.infoBox.style.display = 'flex';
                    els.infoBox.innerHTML = `${WARN} Enter values in both the 'Events' and 'Properties' fields`;
                    return;
                }
                parseFromSeparateInputs();
                return;
            }

            if (mode === 'file') {
                // сбрасываем старые результаты
                state.byEvent = new Map();
                state.eventOrder = [];
                state.sourceOfEvent = new Map();

                const two = !!(els.twoTables && els.twoTables.checked);
                const fA = els.tlsFileA?.files?.[0];
                const fB = els.tlsFileB?.files?.[0];

                if (!fA && (!two || !fB)) {
                    els.infoBox.classList.remove('hidden');
                    els.infoBox.style.display = 'flex';
                    els.infoBox.innerHTML = `${WARN} Please upload ${two ? 'both files' : 'a file'}`;
                    return;
                }

                const srcA = (els.eventSourceA?.value || 'none');
                const srcB = (els.eventSourceB?.value || 'none');

                if (two && fA && fB) {
                    // строгий порядок: сначала таблица №1, затем таблица №2
                    parseFromFile(fA, srcA, () => parseFromFile(fB, srcB));
                } else if (fA) {
                    parseFromFile(fA, srcA);
                } else if (fB) {
                    // на случай, если пользователь загрузил только вторую
                    parseFromFile(fB, srcB);
                }
                return;
            }

            // mode === 'paste'

            // reset previous results
            state.byEvent = new Map();
            state.eventOrder = [];
            state.sourceOfEvent = new Map();


            const text = els.pasteArea?.value || '';
            if (!text.trim()) {
                els.infoBox.classList.remove('hidden');
                els.infoBox.style.display = 'flex';
                els.infoBox.innerHTML = `${WARN} Please paste the full spreadsheet (TSV)`;
                return;
            }

            let rows = parseTSV(text);

            if (rows.length === 0) {
                els.infoBox.classList.remove('hidden');
                els.infoBox.style.display = 'flex';
                els.infoBox.innerHTML = `${WARN} Could not parse the data`;
                return;
            }

            // normalize headers and find indexes using variants
            const headersRaw = rows[0].map(h => (h ?? '').toString().trim());
            const headers = headersRaw.map(h => normalizeHeader(h));

            // 1) default candidates
            let eventIdx = findHeaderIndex(headers, EVENT_HEADERS);
            let propIdx = findHeaderIndex(headers, PROP_HEADERS);

            // 2) stored custom mapping
            if ((eventIdx === -1 || propIdx === -1) && state.customHeaderMap) {
                const evNorm = state.customHeaderMap.event;
                const prNorm = state.customHeaderMap.property;
                const evTry = evNorm ? headers.indexOf(evNorm) : -1;
                const prTry = prNorm ? headers.indexOf(prNorm) : -1;
                if (evTry !== -1) eventIdx = evTry;
                if (prTry !== -1) propIdx = prTry;
            }

            if (eventIdx === -1 || propIdx === -1) {
                openColMapModal({
                    headersRaw,
                    headersNorm: headers,
                    onApply: (evIdx, prIdx) => {
                        ingestRowsFromTsv(rows, evIdx, prIdx, els.eventSource?.value || 'none');
                        renderEvents();
                    }
                });
                return;
            }


            state.rows = rows.slice(1);
            state.headers = headers;
            state.colIdx = { event: eventIdx, property: propIdx };
            state.byEvent = new Map();
            state.eventOrder = [];       // порядок первого появления Event
            let lastEvent = '';          // «протягиваем» последнее значение Event


            for (const r of state.rows) {
                const evRaw = r[eventIdx];
                const prRaw = r[propIdx];

                const evCell = (evRaw ?? '').trim();
                const pr = (prRaw ?? '').trim();

                // если в строке появился новый Event — запоминаем и регистрируем его порядок
                if (evCell) {
                    lastEvent = evCell;
                    if (!state.byEvent.has(lastEvent)) {
                        state.byEvent.set(lastEvent, []);
                        state.eventOrder.push(lastEvent);  // порядок первого появления
                    }
                }

                // если Event ещё не встречался или Property пуст — пропускаем строку
                if (!lastEvent || !pr) continue;

                // добавляем Property в порядке первого появления (без сортировки)
                const arr = state.byEvent.get(lastEvent) || [];
                if (!arr.includes(pr)) arr.push(pr);
                state.byEvent.set(lastEvent, arr);

            }

            // источник для всех событий из режима "paste"
            state.sourceOfEvent = new Map();
            {
                const src = (els.eventSourcePaste?.value || 'none').toLowerCase();
                for (const ev of (state.eventOrder || [])) {
                    state.sourceOfEvent.set(ev, src);
                }
            }

            renderEvents();

            els.infoBox.innerHTML = '';
            els.infoBox.classList.add('hidden');
            els.sqlOutput.value = '';
            els.copyStatus.textContent = '';
            els.downloadCombo?.classList.add('hidden');

        });

        function collectSelectedBySource() {
            const take = (root) =>
                Array.from(root?.querySelectorAll('input[type="checkbox"]:checked') || [])
                    .map(cb => ({ ev: cb.value, src: (cb.dataset.source || 'none').toLowerCase() }));

            const pickedClient = take(els.eventListClient);
            const pickedServer = take(els.eventListServer);
            const pickedNone = take(els.eventListNone);

            // порядок карточек берём из реального порядка групп в левой колонке
            const listsCol = els.eventPicker?.querySelector('.field');
            const ids = Array.from(listsCol?.children || [])
                .map(el => el.id)
                .filter(id => /events(Client|Server|None)Wrap/.test(id));

            const bySrc = { client: pickedClient, server: pickedServer, none: pickedNone };
            let picked = [];
            ids.forEach(id => {
                const key = id.includes('Client') ? 'client' : id.includes('Server') ? 'server' : 'none';
                picked = picked.concat(bySrc[key]);
            });

            const client = picked.filter(x => x.src === 'client').map(x => x.ev);
            const server = picked.filter(x => x.src === 'server').map(x => x.ev);
            const none = picked.filter(x => x.src === 'none').map(x => x.ev);

            return { client, server, none, all: picked.map(x => x.ev) };
        }

        ////  не удалять ////
        els.genBtn.addEventListener('click', () => {
            const fromClause = fromClauseFor(els.tableEnv.value || 'prod');

            // собираем выбранные события по группам
            const picked = collectSelectedBySource();
            // вариант 1
            // const selectedCount = picked.client.length + picked.server.length + picked.none.length;
            // вариант 2 (проще и надёжнее):
            const selectedCount = picked.all.length;

            if (selectedCount === 0) {
                genErrorArmed = true;
                updateGenError();
                els.downloadCombo?.classList.add('hidden');
                if (els.perEventControls) els.perEventControls.style.display = 'none';
                return;
            }

            // экранирование
            const esc = s => s.replace(/'/g, "''");

            // даты (как у тебя было)
            let start = todayISO, end = todayISO;
            const isRange = !!(els.dateModeRange && els.dateModeRange.checked);
            if (isRange) {
                const sISO = els.dateStart?.dataset.iso || todayISO;
                const eISO = els.dateEnd?.dataset.iso || sISO;
                start = sISO; end = eISO; if (start > end) { const t = start; start = end; end = t; }
            }

            const whereCommonLines = (isRange) ? [
                `WHERE user_id = 'test_user_ID'`,
                `AND DATE(insertion_date) >= '${start}'`,
                `AND client_time ${isRange ? `BETWEEN '${start} 00:00:00 UTC' AND '${end} 00:00:00 UTC'` : `>= '${start} 00:00:00 UTC'`}`,
                `AND twelve_traits_enabled IS NULL`,
            ] : [
                `WHERE user_id = 'test_user_ID'`,
                `AND DATE(insertion_date) >= '${start}'`,
                `AND client_time >= '${start} 00:00:00 UTC'`,
                `AND twelve_traits_enabled IS NULL`,
            ];

            // свойства для группы
            const propsFor = (eventsArr) => {
                const uniq = [];
                const seen = new Set();
                for (const ev of eventsArr) {
                    const list = state.byEvent.get(ev) || [];
                    const expanded = expandProps(list);
                    for (const p of expanded) {
                        if (p && !seen.has(p)) { seen.add(p); uniq.push(p); }
                    }
                }
                return ensureTrailingC(uniq);
            };

            // WHERE для конкретной группы c учётом timeField ('client_time' | 'server_time')
            const whereFor = (eventsArr, timeField) => {
                const w = [
                    `WHERE user_id = 'test_user_ID'`,
                    `AND DATE(insertion_date) >= '${start}'`,
                    isRange
                        ? `AND ${timeField} BETWEEN '${start} 00:00:00 UTC' AND '${end} 00:00:00 UTC'`
                        : `AND ${timeField} >= '${start} 00:00:00 UTC'`,
                    `AND twelve_traits_enabled IS NULL`,
                ];
                // фильтр по событиям вставляем сразу после user_id
                const evLine = (eventsArr.length === 1)
                    ? `AND event = '${esc(eventsArr[0])}'`
                    : `AND event IN (${eventsArr.map(e => `'${esc(e)}'`).join(', ')})`;
                w.splice(1, 0, evLine);
                return w.join('\n');
            };

            // вспомогательно: альтернативная (закомментированная) строка времени для симметрии
            const altTimeLine = (altField) => {
                if (!altField) return '';
                return isRange
                    ? `--AND ${altField} BETWEEN '${start} 00:00:00 UTC' AND '${end} 00:00:00 UTC'`
                    : `--AND ${altField} >= '${start} 00:00:00 UTC'`;
            };

            // Определяем, какие источники реально выбраны
            const present = [];
            if (picked.client?.length) present.push('client');
            if (picked.server?.length) present.push('server');
            if (picked.none?.length) present.push('none');

            // Порядок по таблицам (A → B), если выбраны 2 таблицы
            const two = !!(els.twoTables && els.twoTables.checked);
            const srcA = (els.eventSourceA?.value || 'none').toLowerCase();
            const srcB = (els.eventSourceB?.value || 'none').toLowerCase();
            const orderByTables = Array.from(new Set(two ? [srcA, srcB] : [srcA]));

            // Кто "первый": берём первый из orderByTables, который реально присутствует
            let primary = orderByTables.find(s => present.includes(s)) || present[0] || 'none';

            // picked-объект только из реально присутствующих групп
            const pickedForBuild = {};
            present.forEach(s => { pickedForBuild[s] = picked[s].slice(); });

            // Всегда строим единую кверю (если группа одна — будет один SELECT)
            const sqlText = buildUnifiedSQL(pickedForBuild, primary, fromClause, start, end, isRange);
            els.sqlOutput.value = sqlText;
            ui.lastPrimarySource = primary;

            // ЕДИНАЯ квери с двумя SELECT-заголовками (второй — комментом)
            function buildUnifiedSQL(picked, primary, fromClause, start, end, isRange) {
                const esc = s => s.replace(/'/g, "''");
                const timeOf = (src) => src === 'server' ? 'server_time' : 'client_time';
                const labelOf = (src) => src === 'server' ? 'server event' : (src === 'client' ? 'client event' : 'event');

                const presentKeys = ['client', 'server', 'none'].filter(k => Array.isArray(picked[k]) && picked[k].length);
                const second = presentKeys.find(k => k !== primary);
                const havePair = !!second;

                // SELECT строки
                const fieldsPrimary =
                    primary === 'none'
                        ? `event, client_time, server_time, written_by, ${propsFor(picked.none).join(', ')}`
                        : `event, ${timeOf(primary)}, written_by, ${propsFor(picked[primary]).join(', ')}`;

                const topLines = [
                    `SELECT ${fieldsPrimary} -- ${labelOf(primary)}`
                ];

                if (havePair) {
                    const fieldsAlt = `event, ${timeOf(second)}, written_by, ${propsFor(picked[second]).join(', ')}`;
                    topLines.push(`--SELECT ${fieldsAlt} -- ${labelOf(second)}`);
                }

                // WHERE (жёсткий порядок: user_id → DATE → активное время → события → twelve_traits → альтернативное время → written_by)
                const W = [];
                W.push(`WHERE user_id = 'test_user_ID'`);
                W.push(`AND DATE(insertion_date) >= '${start}'`);

                const activeTime = !isRange
                    ? `AND ${timeOf(primary)} >= '${start} 00:00:00 UTC'`
                    : `AND ${timeOf(primary)} BETWEEN '${start} 00:00:00 UTC' AND '${end} 00:00:00 UTC'`;
                W.push(activeTime);

                const evLine = (arr) => arr.length === 1
                    ? `AND event = '${esc(arr[0])}'`
                    : `AND event IN (${arr.map(e => `'${esc(e)}'`).join(', ')})`;

                if (primary === 'none') {
                    W.push(evLine(picked.none));
                    if (havePair) W.push(`--${evLine(picked[second])}`); // коммент второй группы
                } else {
                    W.push(evLine(picked[primary]));
                    if (havePair) W.push(`--${evLine(picked[second])}`);
                }


                W.push(`AND twelve_traits_enabled IS NULL`);

                if (havePair) {
                    if (primary === 'none') {
                        // для None всегда добавляем коммент по server_time (как договаривались)
                        const altTime = !isRange
                            ? `--AND server_time >= '${start} 00:00:00 UTC'`
                            : `--AND server_time BETWEEN '${start} 00:00:00 UTC' AND '${end} 00:00:00 UTC'`;
                        W.push(altTime);
                    } else {
                        const altTime = !isRange
                            ? `--AND ${timeOf(second)} >= '${start} 00:00:00 UTC'`
                            : `--AND ${timeOf(second)} BETWEEN '${start} 00:00:00 UTC' AND '${end} 00:00:00 UTC'`;
                        W.push(altTime);
                    }
                }


                if (primary === 'client') {
                    W.push(`AND written_by = 'client'`);
                    if (havePair) W.push(`--AND written_by = 'server'`);
                } else if (primary === 'server') {
                    W.push(`AND written_by = 'server'`);
                    if (havePair) W.push(`--AND written_by = 'client'`);
                }
                // для 'none' — без written_by

                const orderActive = `ORDER BY ${timeOf(primary)} DESC`;
                const orderAlt = havePair ? `--ORDER BY ${timeOf(second)} DESC` : '';

                // одна квери: два (верхних) SELECT-заголовка + общий FROM/WHERE/ORDER
                return [
                    topLines.join('\n'),
                    fromClause,
                    W.join('\n'),
                    orderActive,
                    orderAlt,
                    `--limit 1000;`
                ].filter(Boolean).join('\n');
            }

            if (els.perEventControls) {
                const many = picked.all.length > 1;   // считаем client + server + none
                els.perEventControls.style.display = many ? 'flex' : 'none';
            }


            ui.lastGeneratedEvents = picked.all.slice();
            ui.perEventShown = false;
            recalcState();

            // очистить старые per-event результаты и спрятать "Download all"
            els.copyStatus.textContent = '';
            els.copyStatus.classList.remove('ok', 'warn');
            els.downloadCombo?.classList.remove('hidden');

            if (els.perEventContainer) {
                els.perEventContainer.replaceChildren?.();
                els.perEventContainer.innerHTML = '';
                els.perEventContainer.style.display = 'none';
            }
            if (els.perEventAllWrap) {
                els.perEventAllWrap.classList.add('hidden');
                els.perEventAllWrap.style.display = 'none';
            }

        });

        els.copyBtn.addEventListener('click', async () => {

            // сбрасываем статусы у всех пер-ивентных карточек
            els.perEventContainer?.querySelectorAll('.per-status').forEach(s => {
                s.textContent = '';
                s.classList.remove('ok', 'warn');
            });

            const txt = els.sqlOutput.value;

            // Пусто → показываем оранжевую валидацию
            if (!txt.trim()) {
                els.copyStatus.classList.remove('ok');
                els.copyStatus.classList.add('warn');
                els.copyStatus.innerHTML = `${WARN_SIGN}Nothing to copy`;
                return;
            }

            // Есть текст → копируем и показываем зелёный успех
            try {
                await navigator.clipboard.writeText(txt);
                els.copyStatus.classList.remove('warn');
                els.copyStatus.classList.add('ok');
                els.copyStatus.textContent = 'Copied to clipboard';
            } catch {
                // Фолбэк
                els.sqlOutput.select();
                document.execCommand('copy');
                els.copyStatus.classList.remove('warn');
                els.copyStatus.classList.add('ok');
                els.copyStatus.textContent = 'Copied (fallback)';
            }
        });

        // нижняя Copy (в блоке per-event all)
        els.copyBtnPer?.addEventListener('click', async () => {
            const txt = els.sqlOutput.value || '';
            if (!txt.trim()) return;
            try {
                await navigator.clipboard.writeText(txt);
            } catch {
                els.sqlOutput.select();
                document.execCommand('copy');
            }
        });

        // следим за пустотой SQL, чтобы выравнивать Clear под Copy
        els.sqlOutput?.addEventListener('input', syncClearButtonTopState);

        els.clearBtn?.addEventListener('click', () => {
            els.sqlOutput.value = '';
            els.copyStatus.textContent = '';
            els.copyStatus.classList.remove('ok', 'warn');
            els.downloadCombo?.classList.add('hidden');
            if (els.perEventControls) els.perEventControls.style.display = 'none';
            if (els.perEventContainer) { els.perEventContainer.innerHTML = ''; els.perEventContainer.style.display = 'none'; }
            if (els.perEventAllWrap) els.perEventAllWrap.style.display = 'none';


            els.sqlOutput.focus(); // опционально: ставим фокус в поле
            syncClearButtonTopState();
            moveClearBackToTopRow();
            syncClearButtonTopState();

            genErrorArmed = false;
            updateGenError();
            if (els.genError) { els.genError.textContent = ''; els.genError.classList.add('hidden'); }


        });

        els.refreshPageBtn?.addEventListener('click', () => {
            // очищаем все поля и статусы
            els.pasteArea.value = '';
            els.sqlOutput.value = '';
            if (els.parseStatus) els.parseStatus.textContent = '';
            els.copyStatus.textContent = '';
            els.downloadCombo?.classList.add('hidden');
            els.copyStatus.classList.remove('ok', 'warn');
            els.errorBox.innerHTML = '';
            els.errorBox.classList.add('hidden');
            els.infoBox.innerHTML = '';
            els.infoBox.classList.add('hidden');

            // --- NEW: очистка per-event результатов ---
            // скрыть саму кнопку "Generate per-event queries"
            if (els.perEventControls) els.perEventControls.style.display = 'none';

            // очистить и спрятать контейнер карточек
            if (els.perEventContainer) {
                // уберёт все карточки .per-item, статусы, кнопки
                if (els.perEventContainer.replaceChildren) {
                    els.perEventContainer.replaceChildren();   // быстрый способ
                } else {
                    els.perEventContainer.innerHTML = '';
                }
                els.perEventContainer.style.display = 'none';
            }

            // спрятать кнопку "Download all .txt"
            els.perEventAllWrap?.classList.add('hidden');

            // УДАЛИТЬ строки со старым select:
            // els.eventSelect.innerHTML = '';   // ← ЭТОГО БОЛЬШЕ НЕТ

            // Скрыть и очистить новый список чекбоксов
            els.eventPicker.style.display = 'none';
            if (els.eventList) els.eventList.innerHTML = '';

            // Очистить отдельные поля Event/Property (режим Separate)
            if (els.eventsInput) els.eventsInput.value = '';
            if (els.propertiesInput) els.propertiesInput.value = '';
            // Схлопнуть высоту textarea после очистки
            if (els.eventsInput) { try { els.eventsInput.style.height = 'auto'; } catch (e) { } }
            if (els.propertiesInput) { try { els.propertiesInput.style.height = 'auto'; } catch (e) { } }

            // Сброс режима даты и значений
            if (els.dateModeToday) els.dateModeToday.checked = true;
            if (els.dateModeRange) els.dateModeRange.checked = false;
            if (els.dateStart) { els.dateStart.value = todayDMY; els.dateStart.dataset.iso = todayISO; }
            if (els.dateEnd) { els.dateEnd.value = todayDMY; els.dateEnd.dataset.iso = todayISO; }
            toggleDateInputs?.();

            // Снять «выбрать все» если где-то остался
            if (els.selectAllEvents) els.selectAllEvents.checked = false;

            // Полностью сбросить file input (режим File)
            resetTlsInput();

            // === сброс выбора "сколько таблиц" ===
            if (els.oneTable) els.oneTable.checked = true;
            if (els.twoTables) els.twoTables.checked = false;
            document.getElementById('fileBlockB')?.classList.add('hidden'); // скрыть блок №2
            document.getElementById('tableLabelA')?.classList.add('hidden');
            document.getElementById('tableLabelB')?.classList.add('hidden');

            document.querySelectorAll('.bq-table-select').forEach(sel => {
                sel.selectedIndex = 0;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            });

            // === NEW: сбросить все селекты источников к None ===
            ['eventSourceA', 'eventSourceB', 'eventSourceSeparate', 'eventSourcePaste'].forEach(id => {
                const sel = document.getElementById(id);
                if (sel) sel.value = 'none';
            });

            // === NEW: сбросить выбор BQ-таблицы к первому пункту ===
            const resetSelectToFirst = (sel) => {
                if (!sel || !sel.options || !sel.options.length) return;
                sel.selectedIndex = 0;
                // если где-то есть onChange-логика, дёрнем её
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            };

            // === NEW: сбросить выбор BQ-таблицы к первому пункту ===
            const tSel = els.tableEnv || document.getElementById('tableEnv');
            if (tSel) {
                tSel.selectedIndex = 0;
                tSel.dispatchEvent(new Event('change', { bubbles: true }));
            }


            // === сброс Event source к дефолту ===
            if (els.eventSourceA) els.eventSourceA.value = 'none';
            if (els.eventSourceB) els.eventSourceB.value = 'none';

            // Обнулить состояние
            state.rows = [];
            state.headers = [];
            state.colIdx = { event: -1, property: -1 };
            state.byEvent = new Map();
            state.eventOrder = [];
            moveClearBackToTopRow();
            syncClearButtonTopState();
            recalcState();

            genErrorArmed = false;
            updateGenError();
            if (els.genError) { els.genError.textContent = ''; els.genError.classList.add('hidden'); }


        });

        els.refreshBtn?.addEventListener('click', () => {
            // 1) очистить текст сгенерированного SQL
            if (els.sqlOutput) els.sqlOutput.value = '';

            // 2) статусы и сообщения
            if (els.copyStatus) { els.copyStatus.textContent = ''; els.copyStatus.classList.remove('ok', 'warn'); }
            if (els.errorBox) { els.errorBox.innerHTML = ''; els.errorBox.classList.add('hidden'); }
            if (els.infoBox) { els.infoBox.innerHTML = ''; els.infoBox.classList.add('hidden'); }

            // 3) скрыть Download в TOP и нижнюю 2×1 сетку
            els.downloadCombo?.classList.add('hidden');
            els.underTopGrid?.classList.add('hidden');
            els.perEventAllWrap?.classList.add('hidden');

            // 4) пер-ивент: спрятать кнопку генерации, очистить контейнер карточек, спрятать общий 2×2
            if (els.perEventControls) els.perEventControls.style.display = 'none';
            if (els.perEventContainer) {
                if (els.perEventContainer.replaceChildren) els.perEventContainer.replaceChildren();
                else els.perEventContainer.innerHTML = '';
                els.perEventContainer.style.display = 'none';
            }
            if (els.perEventAllWrap) els.perEventAllWrap.style.display = 'none';

            // 5) вернуть раскладку панели к начальному виду (Copy | Refresh в TOP)
            setStateS0();

            // сбросить выбор BQ-таблицы к первому пункту
            if (els.tableEnv) {
                els.tableEnv.selectedIndex = 0;
                els.tableEnv.dispatchEvent(new Event('change', { bubbles: true }));
            }


            genErrorArmed = false;
            updateGenError();
            if (els.genError) { els.genError.textContent = ''; els.genError.classList.add('hidden'); }

        });

        els.refreshBtnPer?.addEventListener('click', () => {

            ui.lastGeneratedEvents = [];
            ui.perEventShown = false;

            // твоя логика refresh/clear:
            if (els.sqlOutput) els.sqlOutput.value = '';
            if (els.perEventContainer) { els.perEventContainer.innerHTML = ''; els.perEventContainer.style.display = 'none'; }
            if (els.perEventAllWrap) els.perEventAllWrap.style.display = 'none';
            if (els.perEventControls) els.perEventControls.style.display = 'none';
            recalcState();

            genErrorArmed = false;
            if (els.genError) { els.genError.textContent = ''; els.genError.classList.add('hidden'); }


        });

        // === Download CSV for Testomat (по выбранным событиям) ===

        els.downloadCsvBtn?.addEventListener('click', () => {
            const sql = (els.sqlOutput?.value || '').trim();
            if (!sql) return;

            // используем именно то, что было на последней генерации
            const events = ui.lastGeneratedEvents.slice();
            if (!events.length) return;

            const title = (events.length === 1)
                ? `Event: ${events[0]}`
                : `Events: ${events.join(', ')}`;

            const csv = buildCsv([{ title, sql }]);

            const d = new Date(), pad = n => String(n).padStart(2, '0');
            const name = `Testomat_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.csv`;

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = name;
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        });

        // === [TOP Download menu handlers] =================================
        els.downloadSplit?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (els.downloadCombo?.classList.contains('open')) closeMenu(els.downloadCombo);
            else { closeAllDownloadMenus(); openMenu(els.downloadCombo); }
        });

        els.downloadOptTxt?.addEventListener('click', () => {
            const row = collectCombinedRow();
            if (!row) return;
            const name = tsName('Query', 'txt');
            saveBlob(row.sql + '\n', name, 'text/plain;charset=utf-8');
            closeAllDownloadMenus();
        });

        els.downloadOptCsv?.addEventListener('click', () => {
            const row = collectCombinedRow(); if (!row) return;
            openCsvModal({ getRows: () => [row], fileNamePrefix: 'Query' });
            closeAllDownloadMenus?.();
        });

        // ==================================================================

        // === [BOTTOM Download All menu handlers] ==========================

        els.downloadAllSplit?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (els.downloadAllCombo?.classList.contains('open')) closeMenu(els.downloadAllCombo);
            else { closeAllDownloadMenus(); openMenu(els.downloadAllCombo); }
        });

        els.downloadAllOptTxt?.addEventListener('click', () => {
            const rows = collectPerEventRows();
            if (!rows?.length) return;
            // TXT: с шапкой между блоками, как в твоём текущем коде
            const fileText = rows.map(r => `-- FOR EVENT: ${r.title.replace(/^Event:\s*/, '')}\n${r.sql}`).join('\n\n\n') + '\n';
            saveBlob(fileText, tsName('Queries_per_event', 'txt'), 'text/plain;charset=utf-8');
            closeAllDownloadMenus();
        });

        els.downloadAllOptCsv?.addEventListener('click', () => {
            const rows = collectPerEventRows(); if (!rows?.length) return;
            openCsvModal({ getRows: () => rows, fileNamePrefix: 'Queries_per_event' });
            closeAllDownloadMenus?.();
        });

        // ==================================================================

        // --- Generate per-event queries (отдельный SQL на каждый выбранный Event) ---
        els.perEventBtn?.addEventListener('click', () => {

            const take = (root) =>
                Array.from(root?.querySelectorAll('input[type="checkbox"]:checked') || [])
                    .map(cb => ({ ev: cb.value, src: (cb.dataset.source || 'none').toLowerCase() }));

            const pickedClient = take(els.eventListClient);
            const pickedServer = take(els.eventListServer);

            // Порядок карточек = порядок групп слева
            // const picker = els.eventPicker || document.getElementById('eventPicker');
            // const clientFirst = (picker?.firstElementChild?.id === 'eventsClientWrap');
            // const picked = clientFirst
            //     ? [...pickedClient, ...pickedServer]
            //     : [...pickedServer, ...pickedClient];

            const pickedNone = take(els.eventListNone);

            const listsCol = els.eventPicker?.querySelector('.field');
            const ids = Array.from(listsCol?.children || [])
                .map(el => el.id)
                .filter(id => /events(Client|Server|None)Wrap/.test(id));

            const bySrc = { client: pickedClient, server: pickedServer, none: pickedNone };
            let picked = [];
            ids.forEach(id => {
                const key = id.includes('Client') ? 'client' : id.includes('Server') ? 'server' : 'none';
                picked = picked.concat(bySrc[key]);
            });

            if (picked.length < 2) {
                if (els.perEventControls) els.perEventControls.style.display = 'none';
                return;
            }

            // 2) общие параметры окружения/диапазона дат (как в основном генераторе)
            const esc = s => s.replace(/'/g, "''");
            const fromClause = fromClauseFor(els.tableEnv.value || 'prod');

            let start = todayISO;
            let end = todayISO;
            const isRange = !!(els.dateModeRange && els.dateModeRange.checked);
            if (isRange) {
                const sISO = els.dateStart?.dataset.iso || (() => {
                    const d = parseDMYtoDate(els.dateStart?.value); return d ? toISO(d) : todayISO;
                })();
                const eISO = els.dateEnd?.dataset.iso || (() => {
                    const d = parseDMYtoDate(els.dateEnd?.value); return d ? toISO(d) : sISO;
                })();
                start = sISO; end = eISO; if (start > end) { const t = start; start = end; end = t; }
            }


            const buildWhere = (ev, src) => {
                const parts = [];
                // 1) user_id
                parts.push(`WHERE user_id = 'test_user_ID'`);
                // 2) даты
                if (!isRange) {
                    parts.push(`AND DATE(insertion_date) >= '${start}'`);
                    parts.push(`AND client_time >= '${start} 00:00:00 UTC'`);
                } else {
                    parts.push(`AND DATE(insertion_date) >= '${start}'`);
                    parts.push(`AND client_time BETWEEN '${start} 00:00:00 UTC' AND '${end} 00:00:00 UTC'`);
                }
                // 3) событие
                parts.push(`AND event = '${esc(ev)}'`);
                // 4) источник
                if (src === 'server') parts.push(`AND written_by = 'server'`);
                else if (src === 'client') parts.push(`AND written_by = 'client'`);
                // 5) тех.фильтр
                parts.push(`AND twelve_traits_enabled IS NULL`);
                return parts.join('\n');
            };

            // 3) Рендерим блоки
            if (els.perEventContainer) {
                els.perEventContainer.innerHTML = '';
                for (const { ev, src } of picked) {
                    const rawProps = (state.byEvent.get(ev) || []).filter(Boolean);
                    const props = Array.from(new Set(expandProps(rawProps)));
                    const propsWithC = ensureTrailingC(props);

                    const timeSelect = (src === 'server') ? 'server_time'
                        : (src === 'client') ? 'client_time'
                            : 'client_time, server_time';
                    const fields = `event, ${timeSelect}, written_by, ${propsWithC.join(', ')}`;

                    const sql = `SELECT ${fields}
${fromClause}
${buildWhere(ev, src)}
ORDER BY ${(src === 'server') ? 'server_time' : 'client_time'} DESC
--limit 1000;`;

                    const wrap = document.createElement('div');
                    wrap.className = 'per-item';
                    wrap.innerHTML = `
 <div class="title" data-source="${src}">Event: <code>${ev}</code></div>
  <textarea class="per-sql" readonly>${sql.replace(/</g, '&lt;')}</textarea>
  <div class="row per-actions">
    <span class="copy-status per-status" aria-live="polite" role="status"></span>
    <div class="btns">
      <button class="btn-primary per-copy" data-ev="${ev}">Copy to clipboard</button>
      <div class="dropdown per-dd">
        <button class="btn-primary per-split">Download ▾</button>
        <div class="dropdown-menu" aria-hidden="true">
          <button class="menu-btn txt per-download"     data-ev="${ev}">.txt</button>
          <button class="menu-btn csv per-download-csv" data-ev="${ev}">.csv (Testomat)</button>
        </div>
      </div>
    </div>
  </div>`;
                    els.perEventContainer.appendChild(wrap);
                }
                els.perEventContainer.style.display = 'block';
            }

            // Всегда держим Clear в верхнем слоте — порядок кнопок не меняется
            moveClearBackToTopRow();

            // moveClearUnderPerEvent();
            // syncClearButtonTopState();
            // moveClearToBottom();

            // показать кнопку "Download all" только если карточек >= 2
            if (els.perEventAllWrap) {
                const cnt = els.perEventContainer?.querySelectorAll('.per-item').length || 0;
                if (cnt > 1) {
                    els.perEventAllWrap.classList.remove('hidden');
                    els.perEventAllWrap.style.display = '';
                } else {
                    els.perEventAllWrap.classList.add('hidden');
                    els.perEventAllWrap.style.display = 'none';
                }
            }

            ui.perEventShown = true;
            recalcState();
        });

        // Делегирование кликов для Copy / Download в пер-ивентных блоках
        els.perEventContainer?.addEventListener('click', async (e) => {
            const item = e.target.closest('.per-item');
            if (!item) return;
            const ta = item.querySelector('textarea.per-sql');
            if (!ta) return;

            // toggle per-event dropdown
            const splitBtn = e.target.closest('.per-split');
            if (splitBtn) {
                e.stopPropagation();
                const dd = splitBtn.closest('.dropdown');
                const isOpen = dd?.classList.contains('open');
                closeAllDownloadMenus();
                if (!isOpen && dd) openMenu(dd);
                return;
            }

            if (e.target.classList.contains('per-copy')) {
                // 0) НОВОЕ: перед показом локального статуса — погасить основной
                els.copyStatus.textContent = '';
                els.copyStatus.classList.remove('ok', 'warn');

                // 1) Сбросить статусы у всех пер-ивентных карточек
                els.perEventContainer?.querySelectorAll('.per-status').forEach(s => {
                    s.textContent = '';
                    s.classList.remove('ok', 'warn');
                });

                // 2) Пишем статус только в текущую карточку
                const status = item.querySelector('.per-status') || item.querySelector('.copy-status');
                const text = (ta.value || '').trim();

                if (!text) {
                    if (status) {
                        status.classList.remove('ok');
                        status.classList.add('warn');
                        status.innerHTML = `${WARN_SIGN}Nothing to copy`;
                    }
                    return;
                }

                try {
                    await navigator.clipboard.writeText(text);
                    if (status) {
                        status.classList.remove('warn');
                        status.classList.add('ok');
                        status.textContent = 'Copied to clipboard';
                    }
                } catch {
                    ta.select();
                    document.execCommand('copy');
                    if (status) {
                        status.classList.remove('warn');
                        status.classList.add('ok');
                        status.textContent = 'Copied (fallback)';
                    }
                }
            }

            if (e.target.classList.contains('per-download')) {
                const sql = (ta.value || '').trim();
                if (!sql) return;

                // имя: Query_<event>_YYYY-MM-DD_HH-MM-SS.txt
                const ev = e.target.getAttribute('data-ev') || 'Event';
                const d = new Date(), pad = n => String(n).padStart(2, '0');
                const file = `EVENT_${ev}_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.txt`;

                const blob = new Blob([sql + '\n'], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = file;
                document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
            }


            if (e.target.classList.contains('per-download-csv')) {
                const ev = e.target.getAttribute('data-ev') || 'Event';
                const src = (state.sourceOfEvent.get(ev) || 'none').toLowerCase();
                const props = state.byEvent.get(ev) || [];
                const env = els.tableEnv?.value || 'prod';

                let start = todayISO, end = todayISO;
                const isRange = !!(els.dateModeRange && els.dateModeRange.checked);
                if (isRange) {
                    const sISO = els.dateStart?.dataset.iso || todayISO;
                    const eISO = els.dateEnd?.dataset.iso || sISO;
                    start = sISO; end = eISO; if (start > end) { const t = start; start = end; end = t; }
                }

                const sql = buildPerEventSQL(ev, props, env, start, end, isRange, src);
                openCsvModal({
                    getRows: () => [{ title: withSourceTag(`Event: ${ev}`, src), sql }],
                    fileNamePrefix: `EVENT_${ev}`
                });
                return;
            }

        });

        // --- Download all per-event queries (.txt) с шапкой "-- FOR EVENT: <name>" ---
        els.downloadAllPerBtn?.addEventListener('click', () => {
            // идём по карточкам, чтобы взять и SQL, и имя ивента
            const items = Array.from(els.perEventContainer?.querySelectorAll('.per-item') || []);

            const blocks = items.map(item => {
                // имя ивента берём из заголовка "Event: <code>name</code>"
                const ev =
                    (item.querySelector('.title code')?.textContent ||
                        item.querySelector('.per-download')?.getAttribute('data-ev') ||
                        'event').trim();

                const sql = (item.querySelector('textarea.per-sql')?.value || '').trim();
                if (!sql) return ''; // пропускаем пустые

                // формируем блок: шапка-комментарий + SQL
                return `-- FOR EVENT: ${ev}\n${sql}`;
            }).filter(Boolean);

            if (blocks.length === 0) return;

            // между блоками — ДВЕ пустые строки (т.е. три \n)
            const fileText = blocks.join('\n\n\n') + '\n';

            // имя файла: Queries_per_event_YYYY-MM-DD_HH-MM-SS.txt
            const d = new Date(), pad = n => String(n).padStart(2, '0');
            const name = `Queries_per_event_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.txt`;

            const blob = new Blob([fileText], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        });
        syncClearButtonTopState();

    }

    // ALL events — CSV for Testomat (moved top button -> bottom)

    window.Tools = window.Tools || {};
    window.Tools.queryCreator = { init };

    // --- Авто-инициализация ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init().catch(e => console.error('QC init error', e));
        });
    } else {
        init().catch(e => console.error('QC init error', e));
    }

})();