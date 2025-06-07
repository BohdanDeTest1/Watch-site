// scriptConstructorsSections.js

function loadHeaderFooter() {
    fetch('header.html')
        .then(res => res.text())
        .then(html => {
            document.getElementById('header').innerHTML = html;
            requestAnimationFrame(() => initCollapsibleHeader());
        });

    fetch('footer.html')
        .then(res => res.text())
        .then(html => {
            document.getElementById('footer').innerHTML = html;
        });
}

function initCollapsibleHeader() {
    const header = document.querySelector('.header-desk');
    const toggle = document.getElementById('headerToggle');
    const buyBtn = header?.querySelector('.btn-buy-desk');
    const nav = document.getElementById('mobileNav');

    if (!header || !buyBtn) return;

    if (window.innerWidth <= 768) {
        header.classList.add('collapsed');
        if (nav) nav.style.display = 'none';
    }

    if (toggle) {
        toggle.addEventListener('click', (e) => {
            if (!buyBtn.contains(e.target)) {
                const isCollapsed = header.classList.contains('collapsed');
                if (isCollapsed) {
                    header.classList.remove('collapsed');
                    if (nav) nav.style.display = 'flex';
                }
            }
        });
    }

    document.addEventListener('click', (e) => {
        const isClickInside = header.contains(e.target);
        const isBuyClick = buyBtn.contains(e.target);

        if (!isClickInside && !isBuyClick && window.innerWidth <= 768) {
            header.classList.add('collapsed');
            if (nav) nav.style.display = 'none';
        }
    });

    buyBtn.addEventListener('click', (e) => e.stopPropagation());
}

window.addEventListener('DOMContentLoaded', () => {
    loadHeaderFooter();

    document.querySelectorAll('.section-box').forEach(box => {
        box.addEventListener('click', () => {
            const target = box.getAttribute('data-target');
            if (target) {
                window.location.href = target;
            }
        });
    });
});
