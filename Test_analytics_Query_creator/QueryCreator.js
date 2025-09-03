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

    // --- Дата ---
    dateModeToday: document.getElementById('dateModeToday'),
    dateModeRange: document.getElementById('dateModeRange'),
    dateStart: document.getElementById('dateStart'),
    dateEnd: document.getElementById('dateEnd'),
    todayText: document.getElementById('todayText'),
};

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
        const r = input.getBoundingClientRect();
        dpEl.style.left = `${window.scrollX + r.left}px`;
        dpEl.style.top = `${window.scrollY + r.bottom + 6}px`;
        dpEl.classList.remove('hidden');
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
        opt.title = ev;                 // подсказка с полным именем при наведении
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


    const whereEvent = (selectedEvents.length === 1)
        ? `AND event = "${esc(selectedEvents[0])}"`
        : `AND event IN (${selectedEvents.map(e => `"${esc(e)}"`).join(', ')})`;

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