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
    const toggle = document.getElementById('burgerBtn') || document.getElementById('headerToggle');
    const nav = document.getElementById('mobileNav');
    const closeBtn = document.getElementById('mobileNavClose');

    if (!header || !toggle || !nav) return;

    // Скрыть меню по умолчанию на мобилке
    if (window.innerWidth <= 768) {
        header.classList.add('collapsed');
        nav.style.display = 'none';
    }

    // Показать меню при нажатии на бургер
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = nav.style.display === 'flex';
        if (isVisible) {
            nav.style.display = 'none';
            header.classList.add('collapsed');
        } else {
            nav.style.display = 'flex';
            header.classList.remove('collapsed');
        }
    });


    // Закрыть меню при клике вне хедера
    document.addEventListener('click', (e) => {
        if (!header.contains(e.target) && window.innerWidth <= 768) {
            header.classList.add('collapsed');
            nav.style.display = 'none';
        }
    });

    // Кнопка "×"
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            header.classList.add('collapsed');
            nav.style.display = 'none';
        });
    }
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

// function initNewLangSelector() {
//     const toggle = document.getElementById('langToggle');
//     const wrapper = document.querySelector('.language-selector-wrapper');
//     const menu = document.getElementById('langMenu');
//     const label = toggle?.querySelector('.lang-label');

//     if (!toggle || !wrapper || !menu || !label) return;

//     // Отображение меню
//     toggle.addEventListener('click', (e) => {
//         e.stopPropagation();
//         wrapper.classList.toggle('open');
//     });

//     // Выбор языка
//     menu.querySelectorAll('li').forEach(item => {
//         item.addEventListener('click', () => {
//             const lang = item.getAttribute('data-lang');
//             if (!lang) return;

//             // Сохраняем язык в sessionStorage
//             sessionStorage.setItem('preferredLang', lang);

//             // Обновляем метку на кнопке
//             label.textContent = item.textContent;

//             // Применяем локализацию
//             setLanguage(lang);

//             // Закрываем меню
//             wrapper.classList.remove('open');
//         });
//     });

//     // Закрытие при клике вне
//     document.addEventListener('click', (e) => {
//         if (!wrapper.contains(e.target)) {
//             wrapper.classList.remove('open');
//         }
//     });

//     // Устанавливаем язык из sessionStorage при инициализации
//     const savedLang = sessionStorage.getItem('preferredLang') || 'PL';
//     const activeItem = [...menu.querySelectorAll('li')].find(li => li.getAttribute('data-lang') === savedLang);
//     if (activeItem) {
//         label.textContent = activeItem.textContent;
//         if (typeof setLanguage === 'function') {
//             setLanguage(savedLang);
//         }
//     }

//     if (window.innerWidth <= 768) {
//         const langWrapper = document.querySelector('.language-selector-wrapper');
//         const footerCopy = document.querySelector('.footer-copy');
//         if (langWrapper && footerCopy && footerCopy.parentElement) {
//             footerCopy.parentElement.insertBefore(langWrapper, footerCopy);
//         }
//     }
// }

function initNewLangSelector() {
    const toggles = document.querySelectorAll('.language-toggle');
    const wrappers = document.querySelectorAll('.language-selector-wrapper');
    const menus = document.querySelectorAll('.language-menu');

    toggles.forEach((toggle, index) => {
        const wrapper = wrappers[index];
        const menu = menus[index];
        const label = toggle.querySelector('.lang-label');

        if (!toggle || !wrapper || !menu || !label) return;

        // Показ меню
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            wrapper.classList.toggle('open');
        });

        // Выбор языка
        menu.querySelectorAll('li').forEach(item => {
            item.addEventListener('click', () => {
                const lang = item.getAttribute('data-lang');
                if (!lang) return;

                sessionStorage.setItem('preferredLang', lang);

                // Обновить все label на странице
                const langCode = item.getAttribute('data-lang');
                document.querySelectorAll('.lang-label').forEach(labelEl => {
                    if (labelEl.classList.contains('short')) {
                        labelEl.textContent = langCode; // PL / EN / RU
                    } else {
                        labelEl.textContent = getLangName(langCode); // POLSKI / ENGLISH / РУССКИЙ
                    }
                });

                if (typeof setLanguage === 'function') {
                    setLanguage(lang);
                }

                // Закрыть все меню
                document.querySelectorAll('.language-selector-wrapper').forEach(w => {
                    w.classList.remove('open');
                });
            });
        });
    });

    document.addEventListener('click', (e) => {
        wrappers.forEach(wrapper => {
            if (!wrapper.contains(e.target)) {
                wrapper.classList.remove('open');
            }
        });
    });

    // Инициализация с сохранённым языком
    //     const savedLang = sessionStorage.getItem('preferredLang') || 'PL';
    //     document.querySelectorAll('.language-menu li').forEach(item => {
    //         if (item.getAttribute('data-lang') === savedLang) {
    //             document.querySelectorAll('.lang-label').forEach(labelEl => {
    //                 if (labelEl.classList.contains('short')) {
    //                     labelEl.textContent = savedLang;
    //                 } else {
    //                     labelEl.textContent = getLangName(savedLang);
    //                 }
    //             });
    //         }
    //     });

    //     if (typeof setLanguage === 'function') {
    //         setLanguage(savedLang);
    //     }
    const savedLang = sessionStorage.getItem('preferredLang') || 'PL';

    document.querySelectorAll('.lang-label').forEach(labelEl => {
        if (labelEl.classList.contains('short')) {
            labelEl.textContent = savedLang;
        } else {
            labelEl.textContent = getLangName(savedLang);
        }
    });

    if (typeof setLanguage === 'function') {
        setLanguage(savedLang);
    }
}

