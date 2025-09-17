function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('collapsed');
    document.body.classList.toggle('sb-collapsed');
}

window.Tools = window.Tools || {};

function switchTab(id) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('[id$="View"]').forEach(v => v.classList.add('hidden'));

    const btn = document.querySelector(`.tab[onclick*="${id}"]`);
    if (btn) btn.classList.add('active');

    const view = document.getElementById(id + 'View');
    if (view) view.classList.remove('hidden');
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

// === App bootstrap ===
document.addEventListener('DOMContentLoaded', () => {
    // По умолчанию открываем первую вкладку (где у тебя Query Creator)
    switchTab('tab1');

    // === Sidebar item hover tooltips (only when collapsed) ===
    (() => {
        const sidebar = document.getElementById('sidebar');
        const tabs = document.querySelectorAll('#sidebar .tab, #themeSlider'); // добавили #themeSlider
        let tipEl = null;
        let hideTimer = null;

        function ensureTip() {
            if (!tipEl) {
                tipEl = document.createElement('div');
                tipEl.className = 'side-hover-tip';
                document.body.appendChild(tipEl);
            }
            return tipEl;
        }

        function showTip(target) {
            if (!sidebar?.classList.contains('collapsed')) return; // только для закрытой панели
            clearTimeout(hideTimer); hideTimer = null; // не дать прошлому таймеру снести новый тултип

            // текст берём из .label или data-title, иначе — из текста элемента
            const label = target.querySelector('.label');
            const text = (target.dataset.title || '').trim();
            if (!text) return;

            const el = ensureTip();
            el.textContent = text;

            // позиционирование справа от панели: по центру пункта
            const r = target.getBoundingClientRect();
            // предварительно показать, чтобы получить высоту
            el.style.left = '-9999px';
            el.style.top = '-9999px';
            el.classList.add('show');
            const top = Math.round(r.top + r.height / 2 - el.offsetHeight / 2);
            const left = r.right + 16;

            el.style.left = `${left}px`;
            el.style.top = `${Math.max(8, top)}px`;
        }

        function hideTip() {
            if (!tipEl) return;
            tipEl.classList.remove('show');
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => { tipEl?.remove(); tipEl = null; }, 120);
        }
        // кэшируем заголовки для стабильного текста тултипа
        tabs.forEach(tab => {
            const label = tab.querySelector('.label');
            const title =
                (label?.textContent || '').trim() ||
                tab.getAttribute('aria-label') ||
                tab.dataset.title || '';
            if (title) {
                tab.dataset.title = title;        // дальше showTip всегда возьмёт dataset.title
                tab.setAttribute('aria-label', title);
            }
        });

        tabs.forEach(tab => {
            tab.addEventListener('mouseenter', () => showTip(tab));
            tab.addEventListener('mouseleave', hideTip);
            tab.addEventListener('focus', () => showTip(tab));  // поддержка клавиатуры
            tab.addEventListener('blur', hideTip);
        });

        // если панель открылась — мгновенно скрываем тултип
        const obs = new MutationObserver(() => {
            if (!sidebar.classList.contains('collapsed')) hideTip();
        });
        sidebar && obs.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    })();

    const sidebar = document.getElementById('sidebar');
    const tabs = document.querySelectorAll('#sidebar .tab, #themeSlider');
    // === Close sidebar on outside click (when open) ===
    document.addEventListener('click', (e) => {
        // если панели нет или уже свернута — ничего не делаем
        if (!sidebar || sidebar.classList.contains('collapsed')) return;

        // клики внутри самой панели — игнорируем
        if (e.target.closest('#sidebar')) return;

        // клики по элементам-исключениям (дропдауны, модалки, хелпы) — игнорируем,
        // чтобы не было нежданного закрытия во время действий
        if (
            e.target.closest('.dropdown-menu') ||
            e.target.closest('.qc-modal') ||
            e.target.closest('.howto-tooltip')
        ) {
            return;
        }

        // всё остальное — клик "по фону": закрываем панель
        sidebar.classList.add('collapsed');
    });

    // Дополнительно: закрывать по Esc (удобно на десктопе)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar && !sidebar.classList.contains('collapsed')) {
            sidebar.classList.add('collapsed');
        }
    });


    // Сообщаем инструменту Query Creator, что он может инициализироваться.
    // Сейчас init() — тонкий (не монтирует DOM), но оставим вызов на будущее.
    const container = document.getElementById('tool-root') || document;
    window.Tools.queryCreator?.init?.(container);

    // === Theme toggle ===
    (function () {
        const THEME_KEY = 'qc-theme';          // 'light' | 'night'
        const btn = document.getElementById('themeSlider');

        function applyTheme(mode) {
            const isLight = mode === 'light';
            document.body.classList.toggle('theme-light', isLight);
            document.body.classList.toggle('theme-night', !isLight);

            if (btn) {
                btn.classList.toggle('is-light', isLight);
                btn.classList.toggle('is-night', !isLight);

                // локальные подсказки в кнопке (если нужны)
                const tipL = btn.querySelector('.tip-left');
                const tipR = btn.querySelector('.tip-right');
                if (tipL) tipL.textContent = 'Light Mode';
                if (tipR) tipR.textContent = 'Dark Mode';

                // текст для общего hover-tooltip
                btn.dataset.title = isLight ? 'Light Mode' : 'Dark Mode';
                btn.setAttribute('aria-label', btn.dataset.title);
            }
        }

        // init
        const saved = localStorage.getItem(THEME_KEY) || 'night';
        applyTheme(saved);

        // click
        btn?.addEventListener('click', (e) => {
            e.preventDefault();
            const next = document.body.classList.contains('theme-light') ? 'night' : 'light';
            localStorage.setItem(THEME_KEY, next);
            applyTheme(next);
        });

        // keyboard
        btn?.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                btn.click();
            }
        });
    })();


});



