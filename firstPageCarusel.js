document.addEventListener("DOMContentLoaded", function () {
    const carouselInner = document.querySelector(".carousel-inner");
    const tabs = document.querySelectorAll(".tab-button");
    const prev = document.getElementById("prev");
    const next = document.getElementById("next");
    const animationSpeed = 500;

    const data = {
        design: [
            { image: "first_page_switcher/model-0-aquanaut.png", name: "Seiko Aquanaut", price: "$99" },
            { image: "first_page_switcher/model-1-classic.png", name: "Seiko Classic", price: "$100" },
            { image: "first_page_switcher/model-1-2-GrandSeikoGMT.png", name: "Grand Seiko GMT", price: "$190" },
            { image: "first_page_switcher/model-2-Datejust.png", name: "Seiko Datejust", price: "$110" },
            { image: "first_page_switcher/model-5-royal.png", name: "Seiko Royal Oak", price: "$140" },
            { image: "first_page_switcher/model-3-daytona.png", name: "Seiko Daytona", price: "$120" },
            { image: "first_page_switcher/model-4-Nautilus.png", name: "Seiko Nautilus", price: "$130" },
            { image: "first_page_switcher/model-11.png", name: "Seiko Seamaster", price: "$190" },
            { image: "first_page_switcher/model-14-nautilus-sport.png", name: "Seiko Nautilus Sport", price: "$135" },
            { image: "first_page_switcher/model-1-1-GrandSeiko.png", name: "Seiko Grand Seiko", price: "$190" },
            { image: "first_page_switcher/model-6.png", name: "Seiko PRX", price: "$150" },
            { image: "first_page_switcher/model-9-skx007.png", name: "Seiko SKX007", price: "$160" },
            { image: "first_page_switcher/model-12.png", name: "Seiko Speedmaster", price: "$180" },
            { image: "first_page_switcher/model-7-santos.png", name: "Seiko Santos", price: "$200" }, { image: "first_page_switcher/model-0-aquanaut.png", name: "Seiko Aquanaut", price: "$99" },
            { image: "first_page_switcher/model-1-classic.png", name: "Seiko Classic", price: "$100" },
            { image: "first_page_switcher/model-1-2-GrandSeikoGMT.png", name: "Grand Seiko GMT", price: "$190" },
            { image: "first_page_switcher/model-2-Datejust.png", name: "Seiko Datejust", price: "$110" },
            { image: "first_page_switcher/model-5-royal.png", name: "Seiko Royal Oak", price: "$140" },
            { image: "first_page_switcher/model-3-daytona.png", name: "Seiko Daytona", price: "$120" },
            { image: "first_page_switcher/model-4-Nautilus.png", name: "Seiko Nautilus", price: "$130" },
            { image: "first_page_switcher/model-11.png", name: "Seiko Seamaster", price: "$190" },
            { image: "first_page_switcher/model-14-nautilus-sport.png", name: "Seiko Nautilus Sport", price: "$135" },
            { image: "first_page_switcher/model-1-1-GrandSeiko.png", name: "Seiko Grand Seiko", price: "$190" },
            { image: "first_page_switcher/model-6.png", name: "Seiko PRX", price: "$150" },
            { image: "first_page_switcher/model-9-skx007.png", name: "Seiko SKX007", price: "$160" },
            { image: "first_page_switcher/model-12.png", name: "Seiko Speedmaster", price: "$180" },
            { image: "first_page_switcher/model-7-santos.png", name: "Seiko Santos", price: "$200" }, { image: "first_page_switcher/model-0-aquanaut.png", name: "Seiko Aquanaut", price: "$99" },
            { image: "first_page_switcher/model-1-classic.png", name: "Seiko Classic", price: "$100" },
            { image: "first_page_switcher/model-1-2-GrandSeikoGMT.png", name: "Grand Seiko GMT", price: "$190" },
            { image: "first_page_switcher/model-2-Datejust.png", name: "Seiko Datejust", price: "$110" },
            { image: "first_page_switcher/model-5-royal.png", name: "Seiko Royal Oak", price: "$140" },
            { image: "first_page_switcher/model-3-daytona.png", name: "Seiko Daytona", price: "$120" },
            { image: "first_page_switcher/model-4-Nautilus.png", name: "Seiko Nautilus", price: "$130" },
            { image: "first_page_switcher/model-11.png", name: "Seiko Seamaster", price: "$190" },
            { image: "first_page_switcher/model-14-nautilus-sport.png", name: "Seiko Nautilus Sport", price: "$135" },
            { image: "first_page_switcher/model-1-1-GrandSeiko.png", name: "Seiko Grand Seiko", price: "$190" },
            { image: "first_page_switcher/model-6.png", name: "Seiko PRX", price: "$150" },
            { image: "first_page_switcher/model-9-skx007.png", name: "Seiko SKX007", price: "$160" },
            { image: "first_page_switcher/model-12.png", name: "Seiko Speedmaster", price: "$180" },
            { image: "first_page_switcher/model-7-santos.png", name: "Seiko Santos", price: "$200" }, { image: "first_page_switcher/model-0-aquanaut.png", name: "Seiko Aquanaut", price: "$99" },
            { image: "first_page_switcher/model-1-classic.png", name: "Seiko Classic", price: "$100" },
            { image: "first_page_switcher/model-1-2-GrandSeikoGMT.png", name: "Grand Seiko GMT", price: "$190" },
            { image: "first_page_switcher/model-2-Datejust.png", name: "Seiko Datejust", price: "$110" },
            { image: "first_page_switcher/model-5-royal.png", name: "Seiko Royal Oak", price: "$140" },
            { image: "first_page_switcher/model-3-daytona.png", name: "Seiko Daytona", price: "$120" },
            { image: "first_page_switcher/model-4-Nautilus.png", name: "Seiko Nautilus", price: "$130" },
            { image: "first_page_switcher/model-11.png", name: "Seiko Seamaster", price: "$190" },
            { image: "first_page_switcher/model-14-nautilus-sport.png", name: "Seiko Nautilus Sport", price: "$135" },
            { image: "first_page_switcher/model-1-1-GrandSeiko.png", name: "Seiko Grand Seiko", price: "$190" },
            { image: "first_page_switcher/model-6.png", name: "Seiko PRX", price: "$150" },
            { image: "first_page_switcher/model-9-skx007.png", name: "Seiko SKX007", price: "$160" },
            { image: "first_page_switcher/model-12.png", name: "Seiko Speedmaster", price: "$180" },
            { image: "first_page_switcher/model-7-santos.png", name: "Seiko Santos", price: "$200" }
        ],
        ready: [
            { image: "first_page_switcher/model-4-Nautilus.png", name: "Model Nautilus", price: "$130" },
            { image: "first_page_switcher/model-14-nautilus-sport.png", name: "Model Nautilus Sport", price: "$135" },
            { image: "first_page_switcher/model-5-royal.png", name: "Model Royal Oak", price: "$140" },
            { image: "first_page_switcher/model-6.png", name: "Model PRX", price: "$150" },
            { image: "first_page_switcher/model-9-skx007.png", name: "Model SKX007", price: "$160" },
            { image: "first_page_switcher/model-12.png", name: "Model Speedmaster", price: "$180" },
            { image: "first_page_switcher/model-11.png", name: "Model Seamaster", price: "$190" },
            { image: "first_page_switcher/model-7-santos.png", name: "Model Santos", price: "$200" }
        ]
    };

    let currentTab = 'design';
    let currentIndex = 0;
    let lastOffset = null; // глобально, рядом с currentIndex
    let lastWidth = window.innerWidth;

    function getVisibleCount() {
        return window.innerWidth < 768 ? 1 : 4;
    }

    function renderCarousel(tab = currentTab) {
        const items = data[tab];
        carouselInner.innerHTML = "";

        const fullList = [
            items[items.length - 1], // клон последнего в начало
            ...items,
            items[0], // клон первого в конец
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

        currentIndex = 1; // начинаем со 1-й реальной карточки
        updateTransform(false);
    }

    function updateTransform(animate = true) {
        const cards = carouselInner.querySelectorAll(".carousel-card");
        const card = cards[currentIndex];
        if (!card) return;

        const offset = card.offsetLeft;

        carouselInner.style.transition = animate ? `transform ${animationSpeed}ms ease` : "none";
        carouselInner.style.transform = `translateX(-${offset}px)`;
    }


    let isAnimating = false;



    function shift(direction) {
        if (isAnimating) return;
        isAnimating = true;

        const cards = carouselInner.querySelectorAll(".carousel-card");
        const itemsLength = cards.length;

        if (direction === "next") {
            currentIndex++;
            if (currentIndex >= itemsLength) {
                currentIndex = 0;
            }
        } else {
            currentIndex--;
            if (currentIndex < 0) {
                currentIndex = itemsLength - 1;
            }
        }

        updateTransform(true);
        setTimeout(() => {
            isAnimating = false;
        }, animationSpeed);
    }




    next.addEventListener("click", () => shift("next"));
    prev.addEventListener("click", () => shift("prev"));


    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelector(".tab-button.active")?.classList.remove("active");
            tab.classList.add("active");
            currentTab = tab.dataset.tab;
            renderCarousel();
        });
    });

    renderCarousel();


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
            // Горизонтальный свайп → блокируем скролл страницы
            e.preventDefault();
            touchMoved = true;
        }
    }, { passive: false }); // ⚠️ очень важно: passive: false — иначе preventDefault не сработает!

    carouselInner.addEventListener("touchend", (e) => {
        if (isAnimating) return;

        const touchEndX = e.changedTouches[0].clientX;
        const deltaX = touchStartX - touchEndX;

        const threshold = 10;
        if (Math.abs(deltaX) > threshold) {
            if (deltaX > 0) {
                shift("next");
            } else {
                shift("prev");
            }
        }
    });



});
