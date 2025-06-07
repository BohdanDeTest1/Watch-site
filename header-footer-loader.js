function loadHeaderFooter() {
    fetch('header.html')
        .then(res => res.text())
        .then(html => {
            document.getElementById('header').innerHTML = html;
            requestAnimationFrame(() => {
                initCollapsibleHeader();
                initHoverUnderline();
            });
        });

    fetch('footer.html')
        .then(res => res.text())
        .then(html => {
            document.getElementById('footer').innerHTML = html;
            requestAnimationFrame(() => {
                initNewLangSelector();
            });
        });
}

window.addEventListener('DOMContentLoaded', loadHeaderFooter);

window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        loadHeaderFooter();
    }
});

function initCollapsibleHeader() {
    const header = document.querySelector('.header-desk');
    const toggle = document.getElementById('headerToggle');
    const buyBtn = header?.querySelector('.btn-buy-desk');
    const nav = document.getElementById('mobileNav');
    const closeBtn = document.getElementById('mobileNavClose');

    if (!header || !toggle || !buyBtn || !nav) return;

    if (window.innerWidth <= 768) {
        header.classList.add('collapsed');
        nav.style.display = 'none';
    }

    toggle.addEventListener('click', (e) => {
        if (!buyBtn.contains(e.target)) {
            const isCollapsed = header.classList.contains('collapsed');
            if (isCollapsed) {
                header.classList.remove('collapsed');
                nav.style.display = 'flex';
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (!header.contains(e.target) && window.innerWidth <= 768) {
            header.classList.add('collapsed');
            nav.style.display = 'none';
        }
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            header.classList.add('collapsed');
            if (nav) nav.style.display = 'none';
        });
    }

    buyBtn.addEventListener('click', (e) => e.stopPropagation());
}

function initHoverUnderline() {
    const links = document.querySelectorAll('.desktop-only a');

    links.forEach(link => {
        link.addEventListener('mouseenter', (e) => {
            const rect = link.getBoundingClientRect();
            const fromLeft = e.clientX < rect.left + rect.width / 2;
            link.style.setProperty('--origin', fromLeft ? 'left' : 'right');
            link.classList.add('hovered');
        });

        link.addEventListener('mouseleave', (e) => {
            const rect = link.getBoundingClientRect();
            const toLeft = e.clientX < rect.left + rect.width / 2;
            link.style.setProperty('--origin', toLeft ? 'left' : 'right');
            link.classList.remove('hovered');
        });
    });
}

function initNewLangSelector() {
    const toggle = document.getElementById('langToggle');
    const wrapper = document.querySelector('.language-selector-wrapper');
    const menu = document.getElementById('langMenu');
    const label = toggle?.querySelector('.lang-label');

    if (!toggle || !wrapper || !menu || !label) return;

    // Отображение меню
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        wrapper.classList.toggle('open');
    });

    // Выбор языка
    menu.querySelectorAll('li').forEach(item => {
        item.addEventListener('click', () => {
            const lang = item.getAttribute('data-lang');
            if (!lang) return;

            // Сохраняем язык в sessionStorage
            sessionStorage.setItem('preferredLang', lang);

            // Обновляем метку на кнопке
            label.textContent = item.textContent;

            // Применяем локализацию
            setLanguage(lang);

            // Закрываем меню
            wrapper.classList.remove('open');
        });
    });

    // Закрытие при клике вне
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            wrapper.classList.remove('open');
        }
    });

    // Устанавливаем язык из sessionStorage при инициализации
    const savedLang = sessionStorage.getItem('preferredLang') || 'PL';
    const activeItem = [...menu.querySelectorAll('li')].find(li => li.getAttribute('data-lang') === savedLang);
    if (activeItem) {
        label.textContent = activeItem.textContent;
        if (typeof setLanguage === 'function') {
            setLanguage(savedLang);
        }
    }

    if (window.innerWidth <= 768) {
        const langWrapper = document.querySelector('.language-selector-wrapper');
        const footerCopy = document.querySelector('.footer-copy');
        if (langWrapper && footerCopy && footerCopy.parentElement) {
            footerCopy.parentElement.insertBefore(langWrapper, footerCopy);
        }
    }
}
