// === Tool registration (Query Creator) ===
// Лёгкая защита от двойной инициализации + автоподстановка разметки
(function () {
    let _inited = false;

    // Если #qc-root ещё не в DOM: подгружаем его из файла и монтируем в #tool-root
    async function ensureMarkup(container) {
        let tpl = document.getElementById('qc-root');
        if (!tpl) {
            // 1) сначала пробуем ./QueryCreator.html (рядом со скриптом)
            // 2) если не получилось — старый путь QueryCreator/QueryCreator.html
            // 3) если и он не сработал (например, file://), просто не падаем
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
            byEvent: new Map(), // event -> Set(properties)
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

            eventSource: document.getElementById('eventSource'),

        };

        // --- ID-алиасы: если разметка ещё со старыми ID ---
        els.downloadSplit = els.downloadSplit || els.downloadComboBtn;
        els.downloadOptTxt = els.downloadOptTxt || els.downloadTxtTop;
        els.downloadOptCsv = els.downloadOptCsv || els.downloadCsvTop;

        els.downloadAllSplit = els.downloadAllSplit || els.downloadAllComboBtn;
        els.downloadAllOptTxt = els.downloadAllOptTxt || els.downloadAllTxt;
        els.downloadAllOptCsv = els.downloadAllOptCsv || els.downloadAllCsv;



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
        ////////     NEW CODE ENDS     //////////

        function closeCsvModal() {
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
            const squad = document.getElementById('csvSquad').value.trim();
            const folderExtra = document.getElementById('csvFolder').value.trim();
            const err = document.getElementById('csvSquadError');
            if (!squad) { err.textContent = 'Please select a Squad'; return; }
            err.textContent = '';
            const folder = `/${squad}${folderExtra ? `/${folderExtra}` : ''}`;

            const rows = (csvCtx && typeof csvCtx.getRows === 'function') ? csvCtx.getRows() : [];
            if (!rows.length) { closeCsvModal(); return; }

            const csv = buildCsv(rows, { folder, squad });
            // Имя файла: <SQ>[_<feature>]_ <base> _YYYY-MM-DD_HH_MM_SS.csv
            const base = csvCtx?.fileNamePrefix || 'Query';

            // нормализуем "SQ Core" -> "SQ_Core", пробелы -> "_"
            const safeSquad = (squad || '').replace(/\s+/g, '_');

            // нормализуем введённый suite/feature: пробелы/слэш -> "_", схлопываем "__"
            const safeSuite = (folderExtra || '')
                .replace(/[\\\/\s]+/g, '_')   // пробелы и слэши -> _
                .replace(/_+/g, '_')          // схлопнуть несколько _
                .replace(/^_|_$/g, '');       // убрать _ по краям

            const finalPrefix = [safeSquad, safeSuite, base].filter(Boolean).join('_');

            saveBlob(csv, tsName(finalPrefix, 'csv'), 'text/csv;charset=utf-8');
            closeCsvModal();
        });


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
            // в режиме per-event: Download (TOP) прячем, нижний ряд скрыт,
            // показываем 2×2 с Download All
            els.downloadCombo?.classList.add('hidden');
            els.underTopGrid?.classList.add('hidden');
            els.perEventAllWrap?.classList.remove('hidden');
            if (els.perEventControls) els.perEventControls.style.display = 'none';

            if (els.perEventAllWrap) els.perEventAllWrap.style.display = ''; // снять inline 'none'


            moveRefreshUnderTop();
            closeAllDownloadMenus?.();
        }



        function setStateS3() {
            // в режиме per-event: Download (TOP) и Clear скрываем
            els.downloadCombo?.classList.add('hidden');
            els.clearBtn?.classList.add('hidden');

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
            perEventShown: false       // true, когда открыт режим per-event
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
            const selectedCount = Array
                .from(els.eventList?.querySelectorAll('input[type="checkbox"]:checked') || [])
                .length;

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

        // Клик вне тултипа — закрыть (но игнорим клик по модальному zoom-изображению)
        document.addEventListener('click', (e) => {
            if (document.getElementById('howtoImgOverlay')) return; // не закрываем, если открыт zoom
            if (!els.howtoTooltip || !els.howtoTooltip.classList.contains('open')) return;
            const insideTip = e.target.closest('#howtoTooltip');
            const onBtn = e.target.closest('#howtoBtn');
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


        function getInputMode() {
            if (els.modeSeparate?.checked) return 'separate';
            if (els.modeFile?.checked) return 'file';
            return 'paste';
        }
        function setInputMode(mode) {
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
        }
        // навешиваем переключатели
        els.modeSeparate?.addEventListener('change', () => setInputMode('separate'));
        els.modeFile?.addEventListener('change', () => setInputMode('file'));
        els.modePaste?.addEventListener('change', () => setInputMode('paste'));

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
            // 1) Сбросим взвод каждого file-инпута на странице (если вдруг их больше одного)
            const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
            for (const input of fileInputs) {
                // прямой сброс
                try { input.value = ''; } catch (_) { }

                const form = input.closest('form');
                if (form) {
                    // form.reset очистит value file-инпута «официально»
                    form.reset();
                } else {
                    // клон с заменой — самый надёжный способ для одиночных инпутов
                    const fresh = input.cloneNode(true);
                    input.parentNode.replaceChild(fresh, input);
                }
            }


            els.tlsFile = document.getElementById('tlsFile');
            if (els.tlsFile) {
                els.tlsFile.addEventListener('change', (e) => {
                    // только почистим плашки и, при желании, отобразим имя файла.
                    els.infoBox?.classList.add('hidden'); if (els.infoBox) els.infoBox.innerHTML = '';
                    els.errorBox?.classList.add('hidden'); if (els.errorBox) els.errorBox.innerHTML = '';

                    const nameEl = document.getElementById('tlsFileName');
                    if (nameEl) nameEl.textContent = (e.target.files && e.target.files[0]) ? e.target.files[0].name : '';
                    // НЕ парсим здесь — ждём кнопку Decompose
                });
            }


            // 3) Если есть кастомный лейбл с именем файла — очистим
            const nameEl = document.getElementById('tlsFileName');
            if (nameEl) nameEl.textContent = '';
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


        // Построить SQL для одного события (пер-ивент)
        function buildPerEventSQL(ev, props, env, dateStartISO, dateEndISO, isRange) {
            const source = els.eventSource?.value || 'none';   // NEW
            const esc = s => s.replace(/'/g, "''");
            const fromClause = fromClauseFor(env);

            const parts = [];

            // 1) user_id первым
            parts.push(`WHERE user_id = 'test_user_ID'`);

            // 2) даты
            if (!isRange) {
                parts.push(`AND DATE(insertion_date) >= '${dateStartISO}'`);
                parts.push(`AND client_time >= '${dateStartISO} 00:00:00 UTC'`);
            } else {
                parts.push(`AND DATE(insertion_date) >= '${dateStartISO}'`);
                parts.push(`AND client_time BETWEEN '${dateStartISO} 00:00:00 UTC' AND '${dateEndISO} 00:00:00 UTC'`);
            }

            // 3) событие
            parts.push(`AND event = '${esc(ev)}'`);

            // 4) тех.фильтр
            parts.push(`AND twelve_traits_enabled IS NULL`);

            const expandedProps = expandProps(props || []);
            const dedupProps = Array.from(new Set(expandedProps));
            const withC = ensureTrailingC(dedupProps); // ← 'c' последним всегда

            const timeSelect =
                source === 'server' ? 'server_time' :
                    source === 'client' ? 'client_time' :
                        'client_time, server_time';

            const fields = `event, ${timeSelect}, written_by, ${withC.map(p => p).join(', ')}`;


            return `SELECT ${fields}
${fromClause}
${parts.join('\n')}
ORDER BY ${(source === 'server') ? 'server_time' : 'client_time'} DESC
--limit 1000;
`;

        }


        function squadPretty(s) {
            if (!s) return '';
            if (s === 'SQ Core') return 'Squad Core';
            const m = /^SQ\s*([0-9]{1,2})$/.exec(s);
            return m ? `Squad ${m[1]}` : s.replace(/^SQ/i, 'Squad ');
        }

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


            // Для CSV
            const rawSql = sql;
            const description =
                `## Useful query:

${rawSql}


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
                Description: description,   // весь хвост в Description
                Examples: '',               // пусто
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


        //////   NEW CODE ENDS  ///////






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
        function prependSourceTag(title) {
            const v = (els.eventSource && els.eventSource.value || '').toLowerCase();
            if (v === 'server') return `[server] ${title}`;
            if (v === 'client') return `[client] ${title}`;
            return title; // none или селекта нет
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

            title = prependSourceTag(title);   // NEW
            return { title, sql };
        }


        // Сбор всех карточек per-event (нижний Download All → .txt/.csv)
        function collectPerEventRows() {
            const items = Array.from(els.perEventContainer?.querySelectorAll('.per-item') || []);
            return items.map(item => {
                const ev = (item.querySelector('.title code')?.textContent ||
                    item.querySelector('.per-download')?.getAttribute('data-ev') ||
                    'event').trim();
                const sql = (item.querySelector('textarea.per-sql')?.value || '').trim();
                return sql ? { title: prependSourceTag(`Event: ${ev}`), sql } : null; // NEW

            }).filter(Boolean);
        }
        // ==================================================================
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
                if (slot && els.clearBtn.parentElement !== slot) slot.appendChild(els.clearBtn);
                els.clearBtn.classList.add('clear-top');

            } else {
                // убираем «верхний» вид
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

            renderEvents();
        }


        function parseFromFile(file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const text = e.target.result;
                const rows = text.split(/\r?\n/).map(r => r.split('\t'));

                // нормализованные заголовки
                const headers = rows[0].map(h => normalizeHeader(h));

                // индексы с поддержкой вариантов
                const eventIdx = findHeaderIndex(headers, EVENT_HEADERS);
                const propIdx = findHeaderIndex(headers, PROP_HEADERS);

                if (eventIdx === -1 || propIdx === -1) {
                    alert("Could not find 'Event(s)' and/or 'Property/Properties/Field(s)' columns in the file");
                    return;
                }


                state.byEvent = new Map();
                state.eventOrder = [];

                let lastEvent = '';
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row.length) continue;
                    const ev = (row[eventIdx] ?? '').trim();
                    const pr = (row[propIdx] ?? '').trim();

                    if (ev) {
                        lastEvent = ev;
                        if (!state.byEvent.has(ev)) {
                            state.byEvent.set(ev, []);
                            state.eventOrder.push(ev);
                        }
                    }
                    if (lastEvent && pr) {
                        const arr = state.byEvent.get(lastEvent);
                        if (!arr.includes(pr)) arr.push(pr);
                    }
                }
                renderEvents();
            };
            reader.readAsText(file);
        }


        function renderEvents() {
            if (!els.eventList) return;
            els.eventList.innerHTML = '';
            const events = state.eventOrder.slice(); // порядок как в таблице

            for (const ev of events) {
                const id = 'ev_' + ev.replace(/[^a-z0-9_]+/gi, '_');
                const wrap = document.createElement('label');
                wrap.className = 'event-item';
                wrap.title = ev;

                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = ev;
                cb.id = id;

                const text = document.createElement('span');
                text.textContent = ev;

                wrap.appendChild(cb);
                wrap.appendChild(text);
                els.eventList.appendChild(wrap);
            }

            els.eventPicker.style.display = events.length ? 'flex' : 'none';

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
                if (!(els.tlsFile && els.tlsFile.files && els.tlsFile.files.length > 0)) {
                    els.infoBox.classList.remove('hidden');
                    els.infoBox.style.display = 'flex';
                    els.infoBox.innerHTML = `${WARN} Please upload a TSV/TLS file`;
                    return;
                }
                parseFromFile(els.tlsFile.files[0]);
                return;
            }

            // mode === 'paste'
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


            // нормализуем заголовки и находим индексы через варианты
            const headers = rows[0].map(h => normalizeHeader(h));
            const eventIdx = findHeaderIndex(headers, EVENT_HEADERS);
            const propIdx = findHeaderIndex(headers, PROP_HEADERS);

            if (eventIdx === -1 || propIdx === -1) {
                els.errorBox.classList.remove('hidden');
                els.errorBox.style.display = 'flex';
                els.errorBox.innerHTML = `
    <span class="icon">⚠️</span>
    <div style="font-size: 14px; line-height: 1.4;">
      <div><strong>Warning!</strong></div>
      <div style="font-size: 14px; line-height: 1.2;">
        Could not find the columns <strong>Event/Events</strong> and/or <strong>Property/Properties/Field(s)</strong>.
      </div>
      <div style="font-size: 14px; line-height: 1.2;">Please check the headers</div>
    </div>`;
                els.eventPicker.style.display = 'none';
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

            renderEvents();

            els.infoBox.innerHTML = '';
            els.infoBox.classList.add('hidden');
            els.sqlOutput.value = '';
            els.copyStatus.textContent = '';
            els.downloadCombo?.classList.add('hidden');

        });

        els.genBtn.addEventListener('click', () => {
            const source = (els.eventSource?.value || 'none');           // none | server | client
            const fromClause = fromClauseFor(els.tableEnv.value || 'prod');




            const selectedEvents = Array
                .from(els.eventList?.querySelectorAll('input[type="checkbox"]:checked') || [])
                .map(cb => cb.value)
                .filter(Boolean);


            if (selectedEvents.length === 0) {
                genErrorArmed = true;
                updateGenError();                                   // показать плашку под кнопкой
                els.downloadCombo?.classList.add('hidden');
                if (els.perEventControls) els.perEventControls.style.display = 'none';
                return;
            }

            // есть выбранные ивенты — очищаем ошибку и сбрасываем флаг
            genErrorArmed = false;
            updateGenError();

            if (els.perEventAllWrap) els.perEventAllWrap.style.display = 'none';

            // экранирование одинарных кавычек
            const esc = s => s.replace(/'/g, "''");

            // 2) собираем уникальные properties из всех выбранных ивентов (в порядке первого появления)
            const uniqueProps = [];
            const seen = new Set();
            for (const ev of selectedEvents) {
                const props = state.byEvent.get(ev) || [];
                for (const p of props) {
                    const exp = expandProps([p]);          // ← разворачиваем p, если это шаблон
                    for (const q of exp) {
                        if (q && !seen.has(q)) { seen.add(q); uniqueProps.push(q); }
                    }
                }

            }

            if (uniqueProps.length === 0) {
                els.sqlOutput.value = 'For the selected events, no properties were found';
                els.downloadCombo?.classList.add('hidden');
                if (els.perEventControls) els.perEventControls.style.display = 'none'; // ← НОВОЕ
                return;
            }
            if (els.perEventAllWrap) els.perEventAllWrap.style.display = 'none';

            // гарантируем 'c' последним (и без дублей)
            const withTrailingC = (list) => {
                const arr = (list || []).slice();
                const i = arr.indexOf('c');
                if (i !== -1) arr.splice(i, 1); // убрать, если уже есть
                arr.push('c');                  // добавить последним
                return arr;
            };
            const propsWithC = withTrailingC(uniqueProps);
            const timeSelect =
                source === 'server' ? 'server_time' :
                    source === 'client' ? 'client_time' :
                        'client_time, server_time';

            const selectFields = `event, ${timeSelect}, written_by, ${propsWithC.join(', ')}`;



            const whereEvent = (selectedEvents.length === 1)
                ? `AND event = '${esc(selectedEvents[0])}'`
                : `AND event IN (${selectedEvents.map(e => `'${esc(e)}'`).join(', ')})`;

            let start = todayISO;
            let end = todayISO;
            const isRange = !!(els.dateModeRange && els.dateModeRange.checked);
            if (isRange) {
                // приоритет — ISO в data-атрибуте; иначе пробуем распарсить текст DD.MM.YYYY
                const sISO = els.dateStart?.dataset.iso || (() => {
                    const d = parseDMYtoDate(els.dateStart?.value);
                    return d ? toISO(d) : todayISO;
                })();
                const eISO = els.dateEnd?.dataset.iso || (() => {
                    const d = parseDMYtoDate(els.dateEnd?.value);
                    return d ? toISO(d) : sISO;
                })();

                start = sISO;
                end = eISO;
                if (start > end) { const t = start; start = end; end = t; }
            }


            const whereParts = [];

            // 1) user_id первым
            whereParts.push(`WHERE user_id = 'test_user_ID'`);

            // 2) даты
            if (!isRange) {
                // Сегодня
                whereParts.push(`AND DATE(insertion_date) >= '${start}'`);
                whereParts.push(`AND client_time >= '${start} 00:00:00 UTC'`);
            } else {
                // Диапазон
                whereParts.push(`AND DATE(insertion_date) >= '${start}'`);
                whereParts.push(`AND client_time BETWEEN '${start} 00:00:00 UTC' AND '${end} 00:00:00 UTC'`);
            }

            // 3) событие(я)
            whereParts.push(whereEvent);

            // 3.1) фильтр по источнику (опционально)
            if (source === 'server') whereParts.push(`AND written_by = 'server'`);
            else if (source === 'client') whereParts.push(`AND written_by = 'client'`);

            // 4) тех.фильтр
            whereParts.push(`AND twelve_traits_enabled IS NULL`);


            const whereFinal = whereParts.join('\n');


            // 5) Финальный SQL с ORDER BY и limit
            //             let sql = '';
            //             if (mode === 'property_in') {
            //                 sql =
            //                     `SELECT ${selectFields}
            // ${fromClause}
            // ${whereFinal}
            // ORDER BY client_time DESC 
            // --ORDER BY server_time DESC 
            // --limit 1000;`;
            //             } else {
            //                 sql =
            //                     `SELECT ${selectFields}
            // ${fromClause}
            // ${whereFinal}
            // ORDER BY client_time DESC limit 1000;`;
            //             }
            //             els.sqlOutput.value = sql;

            // 5) Финальный SQL с ORDER BY и limit
            const orderField = (source === 'server') ? 'server_time' : 'client_time';

            const sql =
                `SELECT ${selectFields}
${fromClause}
${whereFinal}
ORDER BY ${orderField} DESC
--limit 1000;`;

            els.sqlOutput.value = sql;


            els.copyStatus.textContent = '';
            els.copyStatus.classList.remove('ok', 'warn');
            els.downloadCombo?.classList.remove('hidden');

            // ПЕРЕГЕНЕРАЦИЯ: всегда очищаем старые per-event результаты
            if (els.perEventContainer) {
                if (els.perEventContainer.replaceChildren) {
                    els.perEventContainer.replaceChildren();      // быстро убрать все карточки
                } else {
                    els.perEventContainer.innerHTML = '';
                }
                els.perEventContainer.style.display = 'none';
            }
            // спрятать нижний блок "Download All" (появится только после нового пер-ивент Generate)
            if (els.perEventAllWrap) {
                els.perEventAllWrap.classList.add('hidden');
                els.perEventAllWrap.style.display = 'none';
            }

            // Кнопка «Generate per-event queries» видима ТОЛЬКО если выбрано ≥2 событий,
            // но сами карточки мы сейчас всегда очистили — пользователь нажмёт кнопку заново.
            if (els.perEventControls) {
                const many = selectedEvents.length > 1;
                els.perEventControls.style.display = many ? 'block' : 'none';
            }

            // Отмечаем, что per-event список скрыт/не сгенерирован после нового Generate
            ui.perEventShown = false;


            // NEW: remember selection at the moment of generation
            ui.lastGeneratedEvents = selectedEvents.slice();
            // per-event ещё не открыт
            ui.perEventShown = false;
            // пересчитываем кнопки правой панели
            recalcState();


            // на этапе основного Generate кнопку "Download all" всегда скрываем,
            // появится только после нажатия "Generate per-event queries"
            if (els.perEventAllWrap) els.perEventAllWrap.style.display = 'none';


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

        // нижняя Copy (в блоке per-event 2×2)
        els.copyBtnPer?.addEventListener('click', async () => {
            const txt = els.sqlOutput?.value || '';
            if (!txt.trim()) return;
            try { await navigator.clipboard.writeText(txt); } catch { }
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
            // 1) актуальный список выбранных событий
            const selectedEvents = Array
                .from(els.eventList?.querySelectorAll('input[type="checkbox"]:checked') || [])
                .map(cb => cb.value)
                .filter(Boolean);

            const source = els.eventSource?.value || 'none'; // NEW


            if (!selectedEvents || selectedEvents.length < 2) {
                // Нечего генерировать
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



            const buildWhere = (ev) => {
                const parts = [];

                // 1) user_id первым
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

                // 3.1) фильтр по источнику (если выбран)
                if (source === 'server') parts.push(`AND written_by = 'server'`);
                else if (source === 'client') parts.push(`AND written_by = 'client'`);


                // 4) тех.фильтр
                parts.push(`AND twelve_traits_enabled IS NULL`);

                return parts.join('\n');
            };


            // 3) Рендерим блоки
            if (els.perEventContainer) {
                els.perEventContainer.innerHTML = ''; // очистить перед новым выводом
                for (const ev of selectedEvents) {
                    // const rawProps = (state.byEvent.get(ev) || []).filter(Boolean);
                    // const props = Array.from(new Set(expandProps(rawProps))); // ← разворачиваем + дедуп
                    // const fields = (props.length > 0)
                    //     ? `event, client_time, server_time, written_by, ${props.join(', ')}`
                    //     : `event, client_time, server_time, written_by`;

                    const rawProps = (state.byEvent.get(ev) || []).filter(Boolean);
                    const props = Array.from(new Set(expandProps(rawProps)));
                    const propsWithC = ensureTrailingC(props); // ← 'c' последним всегда
                    const timeSelect =
                        source === 'server' ? 'server_time' :
                            source === 'client' ? 'client_time' :
                                'client_time, server_time';

                    const fields = `event, ${timeSelect}, written_by, ${propsWithC.join(', ')}`;


                    const sql =
                        `SELECT ${fields}
${fromClause}
${buildWhere(ev)}
ORDER BY ${(source === 'server') ? 'server_time' : 'client_time'} DESC
--limit 1000;
`;

                    // Карточка для одного события
                    const wrap = document.createElement('div');
                    wrap.className = 'per-item';
                    wrap.innerHTML = `
  <div class="title">Event: <code>${ev}</code></div>
  <textarea class="per-sql" readonly>${sql.replace(/</g, '&lt;')}</textarea>

  <!-- статус слева, кнопки справа -->
  <div class="row per-actions">
    <span class="copy-status per-status" aria-live="polite" role="status"></span>
    <div class="btns">
      <button class="btn-primary per-copy" data-ev="${ev}">Copy to clipboard</button>

      <div class="dropdown per-dd">
        <button class="btn-primary per-split">Download ▾</button>
        <div class="dropdown-menu" aria-hidden="true">
          <button class="menu-btn txt per-download"       data-ev="${ev}">.txt</button>
          <button class="menu-btn csv per-download-csv"   data-ev="${ev}">.csv (Testomat)</button>
        </div>
      </div>
    </div>
  </div>`;

                    els.perEventContainer.appendChild(wrap);
                }
                els.perEventContainer.style.display = 'block';
                moveClearUnderPerEvent();
                syncClearButtonTopState();

                moveClearToBottom();

                // показать кнопку "Download all" только если карточек >= 2
                if (els.perEventAllWrap) {
                    const cnt = els.perEventContainer?.querySelectorAll('.per-item').length || 0;
                    if (cnt > 1) {
                        els.perEventAllWrap.classList.remove('hidden');
                        els.perEventAllWrap.style.display = '';      // показать (снять inline 'none')
                    } else {
                        els.perEventAllWrap.classList.add('hidden');
                        els.perEventAllWrap.style.display = 'none';  // прятать явно
                    }
                }


                ui.perEventShown = true;

                recalcState();

            }
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
                const props = state.byEvent.get(ev) || [];
                const env = els.tableEnv?.value || 'prod';

                let start = todayISO, end = todayISO;
                const isRange = !!(els.dateModeRange && els.dateModeRange.checked);
                if (isRange) {
                    const sISO = els.dateStart?.dataset.iso || todayISO;
                    const eISO = els.dateEnd?.dataset.iso || sISO;
                    start = sISO; end = eISO; if (start > end) { const t = start; start = end; end = t; }
                }
                const sql = buildPerEventSQL(ev, props, env, start, end, isRange);
                openCsvModal({
                    getRows: () => [{ title: prependSourceTag(`Event: ${ev}`), sql }], // NEW
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


        // ALL events — CSV for Testomat (moved top button -> bottom)

        // Download CSV (S1/S2): один кейс с объединённым SQL из sqlOutput
        els.downloadCsvBtn?.addEventListener('click', () => {
            const sql = (els.sqlOutput?.value || '').trim();
            if (!sql) return; // нечего сохранять

            // Заголовок строки CSV. Можно оставить универсальный.
            const rows = [{ title: 'Combined query', sql }];
            const csv = buildCsv(rows);

            // имя файла: Query_YYYY-MM-DD_HH-MM-SS.csv (локальное время)
            const d = new Date(), pad = n => String(n).padStart(2, '0');
            const name = `Query_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.csv`;

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = name;
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        });


    }

    window.Tools = window.Tools || {};
    window.Tools.queryCreator = { init };

    // --- Авто-инициализация ---
    // Если внешняя обвязка не вызывает init(), сделаем это сами.
    // --- Авто-инициализация ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init().catch(e => console.error('QC init error', e));
        });
    } else {
        init().catch(e => console.error('QC init error', e));
    }

})();



