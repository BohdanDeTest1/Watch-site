function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('collapsed');
    document.body.classList.toggle('sb-collapsed');
}



window.Tools = window.Tools || {};







// // switchTab()
// function switchTab(tabId) {
//     // Скрываем все табы
//     for (let i = 1; i <= 4; i++) {
//         const view = document.getElementById(`tab${i}View`);
//         const tab = document.querySelector(`.tab:nth-child(${i})`);
//         if (view && tab) {
//             view.classList.add("hidden");
//             tab.classList.remove("active");
//         }
//     }

//     function switchTab(viewId) {
//         // активная кнопка
//         document.querySelectorAll('#sidebar .tab').forEach(t => t.classList.remove('active'));
//         // текущая кнопка — через event.currentTarget
//         if (window.event && window.event.currentTarget) {
//             window.event.currentTarget.classList.add('active');
//         }
//         // переключаем view
//         ['tab1View', 'tab2View', 'tab3View', 'tab4View'].forEach(id => {
//             const el = document.getElementById(id);
//             if (el) el.classList.toggle('hidden', id !== viewId + 'View' && id !== viewId);
//         });
//     }

//     // Показываем активный таб
//     const selectedView = document.getElementById(`${tabId}View`);
//     const selectedTab = document.querySelector(`.tab[onclick="switchTab('${tabId}')"]`);
//     if (selectedView && selectedTab) {
//         selectedView.classList.remove("hidden");
//         selectedTab.classList.add("active");
//     }
// }

// function switchTab(id) {
//     document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
//     document.querySelectorAll('[id$="View"]').forEach(v => v.classList.add('hidden'));
//     document.querySelector(`.tab[onclick*="${id}"]`).classList.add('active');
//     document.getElementById(id + 'View').classList.remove('hidden');
// }

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

    // Сообщаем инструменту Query Creator, что он может инициализироваться.
    // Сейчас init() — тонкий (не монтирует DOM), но оставим вызов на будущее.
    const container = document.getElementById('tool-root') || document;
    window.Tools.queryCreator?.init?.(container);
});



