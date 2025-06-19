let currentTab = 'design';
let currentIndex = 0;
let lastOffset = null;
let isAnimating = false;
const data = {
    design: [...Array(10).keys()].map(i => ({ image: "img.png", name: `Design ${i + 1}`, price: `$${100 + i}` })),
    ready: [...Array(6).keys()].map(i => ({ image: "img.png", name: `Ready ${i + 1}`, price: `$${200 + i}` }))
};

function getVisibleCount() {
    return window.innerWidth < 768 ? 1 : 4;
}

function renderCarousel(tab = currentTab) {
    const carouselInner = document.querySelector(".carousel-inner");
    if (!carouselInner) return; // 💥 элемент не найден — выходим

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
    const carouselInner = document.querySelector(".carousel-inner");
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

    const carouselInner = document.querySelector(".carousel-inner");
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
    const carouselInner = document.querySelector(".carousel-inner");
    renderCarousel();

    const prev = document.getElementById("prev");
    const next = document.getElementById("next");
    next.addEventListener("click", () => shift("next"));
    prev.addEventListener("click", () => shift("prev"));

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
        if (isAnimating) return;
        const deltaX = touchStartX - e.changedTouches[0].clientX;
        if (Math.abs(deltaX) > 10) {
            shift(deltaX > 0 ? "next" : "prev");
        }
    });

    initCarouselTabs();
});

