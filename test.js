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
            link.style.setProperty('--origin', toLeft ? 'left' : 'right'); // <- инверсия
            link.classList.remove('hovered');
        });
    });
}

document.addEventListener('DOMContentLoaded', initHoverUnderline);
