let allowCookieStorage = false;

function allowCookies() {
    allowCookieStorage = true;
    const lang = getCurrentLang();
    sessionStorage.setItem('lang', lang);
}

function rejectCookies() {
    allowCookieStorage = false;
    sessionStorage.removeItem('lang');
}

function resetLocalization() {
    if (allowCookieStorage) {
        sessionStorage.removeItem('lang');
        location.reload();
    }
}

function initLanguageSelector() {
    const supportedLangs = ['RU', 'EN', 'PL'];
    let lang = sessionStorage.getItem('lang');

    if (!lang) {
        lang = detectSystemLanguage();
        if (allowCookieStorage) {
            sessionStorage.setItem('lang', lang);
        }
    }

    applyLangUI(lang);
    loadLanguage(lang);

    // Обработчики
    document.querySelectorAll('[data-lang]').forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedLang = btn.dataset.lang;
            applyLangUI(selectedLang);
            loadLanguage(selectedLang);
            if (allowCookieStorage) {
                sessionStorage.setItem('lang', selectedLang);
            }
        });
    });
}

function detectSystemLanguage() {
    const browserLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    const ruLangs = ['ru', 'uk', 'be', 'mo', 'lv', 'lt', 'hy', 'az', 'kk', 'uz', 'tk', 'ky', 'tg'];

    if (ruLangs.includes(browserLang.slice(0, 2))) {
        return 'RU';
    } else if (browserLang.startsWith('pl')) {
        return 'PL';
    } else {
        return 'EN';
    }
}

function applyLangUI(lang) {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.textContent = lang;
    });
}

function loadLanguage(lang) {
    fetch(`localization/text_${lang.toLowerCase()}.json`)
        .then(res => res.json())
        .then(data => applyTranslations(data))
        .catch(err => console.error('Translation load error:', err));
}

function applyTranslations(dictionary) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const keys = key.split('.');
        let value = dictionary;

        for (const k of keys) {
            value = value?.[k];
        }

        if (value) el.textContent = value;
    });
}

// Экспортируем функции при необходимости
window.allowCookies = allowCookies;
window.rejectCookies = rejectCookies;
window.resetLocalization = resetLocalization;
window.initLanguageSelector = initLanguageSelector;
