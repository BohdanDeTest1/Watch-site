function loadHeaderFooter() {
    fetch('header.html')
        .then(res => res.text())
        .then(html => {
            document.getElementById('header').innerHTML = html;
            requestAnimationFrame(() => {
                initCollapsibleHeader();
                initLangDropdown();
                initLanguageSelector?.();
                initHoverUnderline();
            });
        });

    fetch('footer.html')
        .then(res => res.text())
        .then(html => {
            document.getElementById('footer').innerHTML = html;
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

    closeBtn?.addEventListener('click', () => {
        header.classList.add('collapsed');
        nav.style.display = 'none';
    });

    buyBtn?.addEventListener('click', (e) => e.stopPropagation());
}

function initLangDropdown() {
    const langButtons = document.querySelectorAll('.lang-btn');

    langButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = button.closest('.language-selector');
            dropdown?.classList.toggle('open');
        });
    });

    const langOptions = document.querySelectorAll('.lang-menu li');
    langOptions.forEach(option => {
        option.addEventListener('click', () => {
            const dropdown = option.closest('.language-selector');
            const btn = dropdown?.querySelector('.lang-btn');
            const menu = dropdown?.querySelector('.lang-menu');
            if (btn && menu) {
                //btn.textContent = option.textContent;
                btn.querySelector('span').textContent = option.textContent;
                menu.classList.remove('visible');
                dropdown.classList.remove('open');
            }
        });
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.language-selector.open').forEach(dropdown => {
            dropdown.classList.remove('open');
        });
    });
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
    ///Experement 1
    document.addEventListener('DOMContentLoaded', () => {
        const toggle = document.getElementById('langToggle');
        const wrapper = document.querySelector('.language-selector-wrapper');
        const menu = document.getElementById('langMenu');
        const label = toggle.querySelector('.lang-label');

        toggle.addEventListener('click', () => {
            wrapper.classList.toggle('open');
        });

        // Обработка выбора языка
        menu.querySelectorAll('li').forEach(item => {
            item.addEventListener('click', () => {
                const lang = item.getAttribute('data-lang');
                label.textContent = item.textContent;
                wrapper.classList.remove('open');
                // Твоя логика переключения языка
            });
        });

        // Закрытие при клике вне
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                wrapper.classList.remove('open');
            }
        });
    });

    ///experement 1 end
}
