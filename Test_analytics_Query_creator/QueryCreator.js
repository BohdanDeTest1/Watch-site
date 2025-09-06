// Простая утилита: безопасный split строк на TAB (TSV из Google Sheets)
function parseTSV(text) {
    // Удалим пустые хвосты и разбиваем на строки
    const rows = text
        .trim()
        .split(/\r?\n/)
        .map(line => line.split('\t').map(c => c.trim()));
    return rows;
}

// Нормализация имени столбца
const norm = s => (s || '').toString().trim().toLowerCase();

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



    // --- Дата ---
    dateModeToday: document.getElementById('dateModeToday'),
    dateModeRange: document.getElementById('dateModeRange'),
    dateStart: document.getElementById('dateStart'),
    dateEnd: document.getElementById('dateEnd'),
    todayText: document.getElementById('todayText'),
};

// --- Select all / Clear all (навешиваем один раз при загрузке) ---
els.selectAllBtn?.addEventListener('click', () => {
    els.eventList?.querySelectorAll('input[type="checkbox"]')
        .forEach(cb => cb.checked = true);
});

els.clearAllBtn?.addEventListener('click', () => {
    els.eventList?.querySelectorAll('input[type="checkbox"]')
        .forEach(cb => cb.checked = false);
});


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
setInputMode('separate');

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

// заполняем отображение инпутов диапазона в формате DD.MM.YYYY
if (els.dateStart) { els.dateStart.value = todayDMY; els.dateStart.dataset.iso = todayISO; }
if (els.dateEnd) { els.dateEnd.value = todayDMY; els.dateEnd.dataset.iso = todayISO; }

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
        // позиционирование
        // const r = input.getBoundingClientRect();
        // dpEl.style.left = `${window.scrollX + r.left}px`;
        // dpEl.style.top = `${window.scrollY + r.bottom + 6}px`;
        // dpEl.classList.remove('hidden');
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
    if (evLines.length && evLines[0].trim().toLowerCase() === 'event') evLines.shift();
    if (prLines.length && prLines[0].trim().toLowerCase() === 'property') prLines.shift();

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

        const headers = rows[0].map(h => (h ?? '').toLowerCase().trim());
        const eventIdx = headers.indexOf('event');
        const propIdx = headers.indexOf('property');
        if (eventIdx === -1 || propIdx === -1) {
            alert("В файле не найдены колонки 'Event' и 'Property'");
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



    const norm = s => (s || '').toString().trim().toLowerCase();
    let headerRow = rows[0].map(h => norm(h));

    const eventIndex = headerRow.indexOf('event');
    const propIndex = headerRow.indexOf('property');


    const headers = rows[0].map(h => (h ?? '').toLowerCase().trim().replace(/\s+/g, ' '));

    const eventIdx = headers.findIndex(h => h === 'event');
    const propIdx = headers.findIndex(h => h === 'property');


    if (eventIdx === -1 || propIdx === -1) {
        els.errorBox.classList.remove('hidden'); // показать
        els.errorBox.style.display = 'flex';     // явный показ
        els.errorBox.innerHTML = `
        <span class="icon">⚠️</span>
        <div style="font-size: 14px; line-height: 1.4;">
            <div><strong>Warning!</strong></div>
            <div style="font-size: 14px; line-height: 1.2;">Could not find the columns <strong>Event</strong> and/or <strong>Property</strong> </div> 
            <div style="font-size: 14px; line-height: 1.2;">Please check the headers.</div>
        </div>
    `;
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
});

els.genBtn.addEventListener('click', () => {
    const mode = els.mode.value; // можно оставить как было
    let fromClause = '';
    if (els.tableEnv.value === 'stage') {
        fromClause =
            `FROM trtdpstaging.STG_TRT_STR_EVENT.TRT_EVENT_STREAM_QA --Staging / RC
--FROM trtstreamingdata.TRT_STR_EVENT.TRT_EVENT_STREAM -- Prod`;
    } else {
        fromClause =
            `--FROM trtdpstaging.STG_TRT_STR_EVENT.TRT_EVENT_STREAM_QA --Staging / RC
FROM trtstreamingdata.TRT_STR_EVENT.TRT_EVENT_STREAM -- Prod`;
    }


    const selectedEvents = Array
        .from(els.eventList?.querySelectorAll('input[type="checkbox"]:checked') || [])
        .map(cb => cb.value)
        .filter(Boolean);

    if (selectedEvents.length === 0) {
        els.sqlOutput.value = 'First select at least one Event';
        return;
    }

    // экранирование одинарных кавычек
    const esc = s => s.replace(/'/g, "''");

    // 2) собираем уникальные properties из всех выбранных ивентов (в порядке первого появления)
    const uniqueProps = [];
    const seen = new Set();
    for (const ev of selectedEvents) {
        const props = state.byEvent.get(ev) || [];
        for (const p of props) {
            if (p && !seen.has(p)) {
                seen.add(p);
                uniqueProps.push(p);
            }
        }
    }

    if (uniqueProps.length === 0) {
        els.sqlOutput.value = 'For the selected events, no properties were found';
        return;
    }

    const selectFields = `event, client_time, server_time, written_by, ${uniqueProps.join(', ')}`;


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
    if (!isRange) {
        // Сегодня
        whereParts.push(`WHERE DATE(insertion_date) >= '${start}'`);
        whereParts.push(`AND client_time >= '${start} 00:00:00 UTC'`);
    } else {
        // Диапазон
        whereParts.push(`WHERE DATE(insertion_date) >= '${start}'`);
        whereParts.push(`AND client_time BETWEEN '${start} 00:00:00 UTC' AND '${end} 00:00:00 UTC'`);
    }

    // событие(я)
    whereParts.push(whereEvent);

    // user_id всегда после даты/события
    whereParts.push(`AND user_id = 'test_user_ID'`);

    // twelve_traits_enabled всегда перед ORDER BY
    whereParts.push(`AND twelve_traits_enabled IS NULL`);

    const whereFinal = whereParts.join('\n');

    // 5) Финальный SQL с ORDER BY и limit
    let sql = '';
    if (mode === 'property_in') {
        sql =
            `SELECT ${selectFields}
${fromClause}
${whereFinal}
ORDER BY client_time DESC 
--ORDER BY server_time DESC 
--limit 1000;`;
    } else {
        sql =
            `SELECT ${selectFields}
${fromClause}
${whereFinal}
ORDER BY client_time DESC limit 1000;`;
    }
    els.sqlOutput.value = sql;
    els.copyStatus.textContent = '';
});

els.copyBtn.addEventListener('click', async () => {
    const txt = els.sqlOutput.value;
    if (!txt.trim()) {
        els.copyStatus.textContent = 'nothing to copy';
        return;
    }
    try {
        await navigator.clipboard.writeText(txt);
        els.copyStatus.textContent = 'Copied to clipboard';
    } catch {
        // Фолбэк
        els.sqlOutput.select();
        document.execCommand('copy');
        els.copyStatus.textContent = 'Copied (fallback)';
    }

});

els.clearBtn?.addEventListener('click', () => {
    els.sqlOutput.value = '';
    els.copyStatus.textContent = '';
    els.sqlOutput.focus(); // опционально: ставим фокус в поле
});


els.refreshBtn.addEventListener('click', () => {
    // очищаем все поля и статусы
    els.pasteArea.value = '';
    els.sqlOutput.value = '';
    if (els.parseStatus) els.parseStatus.textContent = '';
    els.copyStatus.textContent = '';
    els.errorBox.innerHTML = '';
    els.errorBox.classList.add('hidden');
    els.infoBox.innerHTML = '';
    els.infoBox.classList.add('hidden');

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
});



function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('collapsed');
    document.body.classList.toggle('sb-collapsed');
}

// 3333
function switchTab(tabId) {
    // Скрываем все табы
    for (let i = 1; i <= 4; i++) {
        const view = document.getElementById(`tab${i}View`);
        const tab = document.querySelector(`.tab:nth-child(${i})`);
        if (view && tab) {
            view.classList.add("hidden");
            tab.classList.remove("active");
        }
    }

    function switchTab(viewId) {
        // активная кнопка
        document.querySelectorAll('#sidebar .tab').forEach(t => t.classList.remove('active'));
        // текущая кнопка — через event.currentTarget
        if (window.event && window.event.currentTarget) {
            window.event.currentTarget.classList.add('active');
        }
        // переключаем view
        ['tab1View', 'tab2View', 'tab3View', 'tab4View'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('hidden', id !== viewId + 'View' && id !== viewId);
        });
    }

    // Показываем активный таб
    const selectedView = document.getElementById(`${tabId}View`);
    const selectedTab = document.querySelector(`.tab[onclick="switchTab('${tabId}')"]`);
    if (selectedView && selectedTab) {
        selectedView.classList.remove("hidden");
        selectedTab.classList.add("active");
    }
}

function switchTab(id) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('[id$="View"]').forEach(v => v.classList.add('hidden'));
    document.querySelector(`.tab[onclick*="${id}"]`).classList.add('active');
    document.getElementById(id + 'View').classList.remove('hidden');
}

// Открывать панель кликом по пустому месту, когда она закрыта
(() => {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    sidebar.addEventListener('click', (e) => {
        // работаем только когда панель закрыта
        if (!sidebar.classList.contains('collapsed')) return;

        // если клик пришёлся по интерактивному элементу — выходим
        const interactive = e.target.closest(
            '#sidebarTop, .tab, .toggle-btn, #themeSlider, button, a, input, select, textarea'
        );
        if (interactive) return;

        // пустое место → открыть панель
        if (typeof toggleSidebar === 'function') toggleSidebar();
    });
})();



