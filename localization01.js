document.addEventListener('DOMContentLoaded', () => {
    const langToggle = document.getElementById('langToggle');
    const languageMenu = document.getElementById('langMenu');
    const langLabel = document.querySelector('.lang-label');

    // Функция загрузки языка
    async function setLanguage(langCode) {
        try {
            const response = await fetch(`localization/text_${langCode.toLowerCase()}.json`);
            const translations = await response.json();

            document.querySelectorAll('[data-i18n]').forEach(element => {
                const keys = element.getAttribute('data-i18n').split('.');
                let text = translations;
                keys.forEach(k => text = text?.[k]);
                if (text) element.textContent = text;
            });

            langLabel.textContent = getLangName(langCode);
            sessionStorage.setItem('lang', langCode);
        } catch (err) {
            console.error(`Ошибка загрузки локализации для ${langCode}:`, err);
        }
    }

    // Возвращает название языка
    function getLangName(code) {
        switch (code) {
            case 'RU': return 'РУССКИЙ';
            case 'PL': return 'POLSKI';
            case 'EN': return 'ENGLISH';
            default: return 'POLSKI';
        }
    }

    // Обработчик кнопки
    langToggle?.addEventListener('click', () => {
        languageMenu.classList.toggle('visible');
    });

    // Обработчик выбора языка
    languageMenu?.querySelectorAll('li').forEach(item => {
        item.addEventListener('click', () => {
            const selectedLang = item.dataset.lang;
            setLanguage(selectedLang);
            languageMenu.classList.remove('visible');
        });
    });

    // Автовыбор языка
    const savedLang = sessionStorage.getItem('lang');
    if (savedLang) {
        setLanguage(savedLang);
    } else {
        // Язык браузера
        const browserLang = navigator.language.toLowerCase();

        const ruLocales = ['ru', 'uk', 'be', 'mo', 'lv', 'lt', 'hy', 'az', 'kz', 'uz', 'tm', 'kg', 'tj'];
        const plLocales = ['pl'];

        let defaultLang = 'EN';
        if (ruLocales.some(code => browserLang.startsWith(code))) defaultLang = 'RU';
        else if (plLocales.some(code => browserLang.startsWith(code))) defaultLang = 'PL';

        setLanguage(defaultLang);
    }
});
