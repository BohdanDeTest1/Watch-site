document.addEventListener('DOMContentLoaded', function () {
    const tabs = {
        "доступные для дизайна": document.getElementById('splide-доступные для дизайна'),
        "готовые модели": document.getElementById('splide-готовые модели'),
    };

    const splideDesign = new Splide('#splide-доступные\\ для\\ дизайна', {
        type: 'loop',
        perPage: 4,
        breakpoints: {
            768: { perPage: 1 }
        },
        pagination: true,
    }).mount();

    // 👉 Временно показываем скрытую вкладку
    tabs["готовые модели"].style.display = 'block';

    // 👉 Ждём отрисовку DOM (важно для корректного пагинатора)
    requestAnimationFrame(() => {
        setTimeout(() => {
            new Splide('#splide-готовые\\ модели', {
                type: 'loop',
                perPage: 4,
                breakpoints: {
                    768: { perPage: 1 }
                },
                pagination: true,
            }).mount();

            // Снова скрываем
            tabs["готовые модели"].style.display = 'none';
        }, 50); // задержка 50 мс даёт гарантию
    });

    // 👉 Обработка вкладок
    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const selected = button.innerText.trim();

            document.querySelector('.tab-button.active')?.classList.remove('active');
            button.classList.add('active');

            for (const key in tabs) {
                tabs[key].style.display = key === selected ? 'block' : 'none';
            }
        });
    });
});
