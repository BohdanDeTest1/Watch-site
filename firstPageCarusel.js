let currentTab = 'design';
let currentIndex = 0;
let isAnimating = false;

const carouselWrappers = {
    design: document.getElementById("splide-design"),
    ready: document.getElementById("splide-ready")
};

function getVisibleCount() {
    return window.innerWidth < 768 ? 1 : 4;
}

function renderCarousel(tab = currentTab) {
    Object.values(carouselWrappers).forEach(w => w.style.display = "none");
    const wrapper = carouselWrappers[tab];
    if (!wrapper) return;
    wrapper.style.display = "block";

    const carouselInner = wrapper.querySelector(".carousel-inner");
    if (!carouselInner) return;

    const items = data[tab];
    carouselInner.innerHTML = "";

    const fullList = [
        items[items.length - 1],
        ...items,
        items[0],
    ];

    fullList.forEach((item) => {
        const card = document.createElement("div");
        card.className = "carousel-card";
        card.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <h3>${item.name}</h3>
            <p>${item.price}</p>
        `;
        carouselInner.appendChild(card);
    });

    currentIndex = 1;
    updateTransform(false);
}

function updateTransform(animate = true) {
    const wrapper = carouselWrappers[currentTab];
    if (!wrapper) return;
    const carouselInner = wrapper.querySelector(".carousel-inner");
    if (!carouselInner) return;

    const cards = carouselInner.querySelectorAll(".carousel-card");
    const card = cards[currentIndex];
    if (!card) return;

    const offset = card.offsetLeft;
    carouselInner.style.transition = animate ? "transform 500ms ease" : "none";
    carouselInner.style.transform = `translateX(-${offset}px)`;
}

function shift(direction) {
    if (isAnimating) return;
    isAnimating = true;

    const wrapper = carouselWrappers[currentTab];
    const carouselInner = wrapper.querySelector(".carousel-inner");
    const itemsLength = data[currentTab].length;

    if (direction === "next") {
        currentIndex++;
        updateTransform(true);
        if (currentIndex === itemsLength + 1) {
            setTimeout(() => {
                carouselInner.style.transition = "none";
                currentIndex = 1;
                updateTransform(false);
                requestAnimationFrame(() => {
                    carouselInner.style.transition = "transform 500ms ease";
                });
            }, 500);
        }
    } else {
        currentIndex--;
        updateTransform(true);
        if (currentIndex === 0) {
            setTimeout(() => {
                carouselInner.style.transition = "none";
                currentIndex = itemsLength;
                updateTransform(false);
                requestAnimationFrame(() => {
                    carouselInner.style.transition = "transform 500ms ease";
                });
            }, 500);
        }
    }

    setTimeout(() => {
        isAnimating = false;
    }, 520);
}

function initCarouselTabs() {
    const tabs = document.querySelectorAll(".tab-button");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            currentTab = tab.dataset.tab;
            renderCarousel();
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    renderCarousel();

    initCarouselTabs();

    const allInners = document.querySelectorAll(".carousel-inner");

    allInners.forEach(carouselInner => {
        const wrapper = carouselInner.closest(".splide");
        const tabKey = Object.entries(carouselWrappers).find(([, w]) => w === wrapper)?.[0];

        const prev = wrapper.querySelector(".prev-btn");
        const next = wrapper.querySelector(".next-btn");

        if (next) next.addEventListener("click", () => {
            if (tabKey === currentTab) shift("next");
        });
        if (prev) prev.addEventListener("click", () => {
            if (tabKey === currentTab) shift("prev");
        });

        let touchStartX = 0;
        let touchStartY = 0;
        let touchMoved = false;

        carouselInner.addEventListener("touchstart", (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchMoved = false;
        }, { passive: true });

        carouselInner.addEventListener("touchmove", (e) => {
            const deltaX = e.touches[0].clientX - touchStartX;
            const deltaY = e.touches[0].clientY - touchStartY;
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                e.preventDefault();
                touchMoved = true;
            }
        }, { passive: false });

        carouselInner.addEventListener("touchend", (e) => {
            if (!touchMoved || isAnimating || tabKey !== currentTab) return;
            const deltaX = touchStartX - e.changedTouches[0].clientX;
            if (Math.abs(deltaX) > 10) {
                shift(deltaX > 0 ? "next" : "prev");
            }
        });
    });
});

// Демо-данные
const data = {
    design: [...Array(5).keys()].map(i => ({ image: "img.png", name: `Design ${i + 1}`, price: `$${100 + i}` })),
    ready: [...Array(4).keys()].map(i => ({ image: "img.png", name: `Ready ${i + 1}`, price: `$${200 + i}` }))
};

document.addEventListener('DOMContentLoaded', function () {
    new Splide('#splide-design', {
        perPage: 4, // ⬅ по умолчанию 4 карточки
        gap: '20px',
        arrows: true,
        pagination: false,
        rewind: true,
        breakpoints: {
            768: {
                perPage: 1 // ⬅ на мобилке — 1 карточка
            }
        }
    }).mount();

    new Splide('#splide-ready', {
        perPage: getVisibleCount(),
        breakpoints: {
            768: {
                perPage: 1,
            },
        },
        arrows: true,
        pagination: false,
        rewind: true,
    }).mount();
});
