// localization.js

const languageMap = {
    RU: 'РУССКИЙ',
    PL: 'POLSKI',
    EN: 'ENGLISH'
};

function getLangName(code) {
    return languageMap[code] || code;
}

function getDefaultLanguage() {
    const userLang = navigator.language || navigator.userLanguage;
    const lowerLang = userLang.toLowerCase();

    const ruCountries = [
        'ru', 'be', 'uk', 'kz', 'kg', 'az', 'am', 'md', 'tj', 'tm', 'uz', 'lv', 'lt'
    ];

    if (lowerLang.startsWith('pl')) return 'PL';
    if (ruCountries.some(code => lowerLang.startsWith(code))) return 'RU';
    return 'EN';
}

function setLanguage(langCode) {
    const langLabel = document.querySelector('.lang-text');
    if (langLabel) langLabel.textContent = getLangName(langCode);

    fetch(`localization/text_${langCode.toLowerCase()}.json`)
        .then(res => res.json())
        .then(data => {
            const elements = document.querySelectorAll('[data-i18n]');
            elements.forEach(el => {
                const key = el.getAttribute('data-i18n');
                const keys = key.split('.');
                let text = data;
                keys.forEach(k => {
                    if (text) text = text[k];
                });
                if (text) el.textContent = text;
            });
        });
}

function initLanguageSelector() {
    const savedLang = sessionStorage.getItem('lang');
    if (savedLang) {
        setLanguage(savedLang);
    } else {
        const defaultLang = getDefaultLanguage();
        sessionStorage.setItem('lang', defaultLang);
        setLanguage(defaultLang);
    }

    const items = document.querySelectorAll('.lang-dropdown li');
    items.forEach(item => {
        item.addEventListener('click', () => {
            const selectedLang = item.getAttribute('data-lang');
            sessionStorage.setItem('lang', selectedLang);
            setLanguage(selectedLang);
            document.querySelector('.lang-menu').classList.remove('visible');
        });
    });

    const toggleBtn = document.querySelector('#langToggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = document.querySelector('.lang-menu');
            if (menu) menu.classList.toggle('visible');
        });
    }

    document.addEventListener('click', () => {
        document.querySelectorAll('.lang-menu.visible').forEach(menu => {
            menu.classList.remove('visible');
        });
    });
}

document.addEventListener('DOMContentLoaded', initLanguageSelector);
