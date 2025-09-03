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

    // --- Дата ---
    dateModeToday: document.getElementById('dateModeToday'),
    dateModeRange: document.getElementById('dateModeRange'),
    dateStart: document.getElementById('dateStart'),
    dateEnd: document.getElementById('dateEnd'),
    todayText: document.getElementById('todayText'),
};

// ---- Инициализация даты и переключение Today/Range ----
// Локальные форматтеры без перевода в UTC
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // YYYY-MM-DD (локально)
const toDMY = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`; // DD.MM.YYYY

const today = new Date();
const todayISO = toISO(today);
const todayDMY = toDMY(today);

// В «Сегодня» показываем человекочитаемый формат как у инпутов диапазона
if (els.todayText) els.todayText.textContent = todayDMY;

// По умолчанию значения инпутов-дат — ISO для value
if (els.dateStart) els.dateStart.value = todayISO;
if (els.dateEnd) els.dateEnd.value = todayISO;


// Переключатель: показываем/скрываем поля диапазона
function toggleDateInputs() {
    const wrap = document.getElementById('dateRangeWrap');
    const isRange = !!(els.dateModeRange && els.dateModeRange.checked);
    if (wrap) wrap.style.display = isRange ? 'flex' : 'none';
}


toggleDateInputs();
els.dateModeToday?.addEventListener('change', toggleDateInputs);
els.dateModeRange?.addEventListener('change', toggleDateInputs);
// --------------------------------------------------------


els.parseBtn.addEventListener('click', () => {
    // очищаем ошибку при каждом новом парсинге
    els.errorBox.innerHTML = '';
    els.errorBox.classList.add('hidden');

    els.infoBox.innerHTML = '';
    els.infoBox.classList.add('hidden');

    const text = els.pasteArea.value;
    if (!text.trim()) {
        els.infoBox.classList.remove('hidden');
        els.infoBox.style.display = 'flex';
        els.infoBox.innerHTML = `<span class="icon info-icon">i</span> Please enter data before parsing.`;
        return;
    }

    const rows = parseTSV(text);
    if (rows.length === 0) {
        els.infoBox.classList.remove('hidden');
        els.infoBox.style.display = 'flex';
        els.infoBox.innerHTML = `<span class="icon info-icon">i</span> Could not parse the data.`;
        return;

    }

    // Определяем заголовки
    const headers = rows[0].map(h => h.trim());
    const eventIdx = headers.findIndex(h => ['event'].includes(norm(h)));
    const propIdx = headers.findIndex(h => ['property'].includes(norm(h)));

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
    let lastEvent = ''; // «протягиваем» последнее значение Event

    for (const r of state.rows) {
        const evCell = (r[eventIdx] ?? '').trim();
        const pr = (r[propIdx] ?? '').trim();

        if (evCell) lastEvent = evCell;          // обновляем, если в строке указан Event
        if (!lastEvent || !pr) continue;         // пропускаем, если нет Event вообще или пустая property

        if (!state.byEvent.has(lastEvent)) state.byEvent.set(lastEvent, []);
        const arr = state.byEvent.get(lastEvent);

        // добавляем property, сохраняя порядок и избегая дублей
        if (!arr.includes(pr)) arr.push(pr);
    }


    // Заполним селект Event
    els.eventSelect.innerHTML = '';
    const events = Array.from(state.byEvent.keys()).sort((a, b) => a.localeCompare(b));
    for (const ev of events) {
        const opt = document.createElement('option');
        opt.value = ev;
        opt.textContent = ev;
        els.eventSelect.appendChild(opt);
    }

    // сброс «Выбрать все»
    if (els.selectAllEvents) els.selectAllEvents.checked = false;

    // «Выбрать все» — отмечает/снимает все опции
    els.selectAllEvents?.addEventListener('change', () => {
        const all = els.selectAllEvents.checked;
        for (const opt of els.eventSelect.options) opt.selected = all;
    });

    // при ручном выборе синхронизируем чекбокс
    els.eventSelect.addEventListener('change', () => {
        const total = els.eventSelect.options.length;
        const selected = Array.from(els.eventSelect.options).filter(o => o.selected).length;
        if (total === 0) return;
        els.selectAllEvents.checked = (selected === total);
    });



    els.eventPicker.style.display = events.length ? 'flex' : 'none';
    // if (els.parseStatus) {
    //     els.parseStatus.textContent = events.length
    //         ? `Готово. Найдено событий: ${events.length}.`
    //         : 'События не найдены.';
    // }
    els.infoBox.innerHTML = '';
    els.infoBox.classList.add('hidden');
    els.sqlOutput.value = '';
    els.copyStatus.textContent = '';
});

// els.errorBox.innerHTML = '';
// els.errorBox.classList.add('hidden');
// els.errorBox.style.display = 'none';  // на всякий случай инлайн

// els.eventPicker.style.display = events.length ? 'flex' : 'none';
// els.parseStatus.textContent = events.length ? `Готово. Найдено событий: ${events.length}.` : 'События не найдены.';
// els.sqlOutput.value = '';
// els.copyStatus.textContent = '';
// // ← ВСТАВЬ ТУТ три строки из вставки выше


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

    // 1) выбранные события (может быть несколько)
    const selectedEvents = Array.from(els.eventSelect.options)
        .filter(o => o.selected)
        .map(o => o.value)
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


    // 3) WHERE: = 'one' или IN ('a','b',...)
    // 3) WHERE: = 'one' или IN ("a","b",...)
    const whereEvent = (selectedEvents.length === 1)
        ? `AND event = "${esc(selectedEvents[0])}"`
        : `AND event IN (${selectedEvents.map(e => `"${esc(e)}"`).join(', ')})`;

    // 4) Даты:
    // - Если выбран "Сегодня": 
    //   WHERE   DATE(insertion_date) >= "YYYY-MM-DD"
    //   AND     client_time >= "YYYY-MM-DD 00:00:00 UTC"
    // - Если выбран "Диапазон": 
    //   WHERE   DATE(insertion_date) >= "start"
    //   AND     client_time BETWEEN 'start 00:00:00 UTC' AND 'end 00:00:00 UTC'
    let start = todayISO;
    let end = todayISO;
    const isRange = !!(els.dateModeRange && els.dateModeRange.checked);
    if (isRange) {
        start = (els.dateStart?.value || todayISO);
        end = (els.dateEnd?.value || start);
        if (start > end) { const t = start; start = end; end = t; }
    }

    const whereParts = [];
    if (!isRange) {
        // Сегодня
        whereParts.push(`WHERE DATE(insertion_date) >= "${start}"`);
        whereParts.push(`AND client_time >= "${start} 00:00:00 UTC"`);
    } else {
        // Диапазон
        whereParts.push(`WHERE DATE(insertion_date) >= "${start}"`);
        whereParts.push(`AND client_time BETWEEN '${start} 00:00:00 UTC' AND '${end} 00:00:00 UTC'`);
    }

    // событие(я)
    whereParts.push(whereEvent);

    // user_id всегда после даты/события
    whereParts.push(`AND user_id = "test_user_ID"`);

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
ORDER BY client_time DESC limit 1000;`;
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
    els.eventSelect.innerHTML = '';
    els.eventPicker.style.display = 'none';
    // Сброс режима даты и значений
    if (els.dateModeToday) els.dateModeToday.checked = true;
    if (els.dateModeRange) els.dateModeRange.checked = false;
    if (els.dateStart) els.dateStart.value = todayISO;
    if (els.dateEnd) els.dateEnd.value = todayISO;
    toggleDateInputs?.();
    if (els.selectAllEvents) els.selectAllEvents.checked = false;

    // сброс state
    state.rows = [];
    state.headers = [];
    state.colIdx = { event: -1, property: -1 };
    state.byEvent = new Map();
});