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
        const itemsLength = data[currentTab].length;

        if (direction === "next") {
            currentIndex++;
            updateTransform(true);

            if (currentIndex === itemsLength + 1) {
                // перешли на клон первого
                setTimeout(() => {
                    carouselInner.style.transition = "none";
                    currentIndex = 1;
                    updateTransform(false);
                    requestAnimationFrame(() => {
                        carouselInner.style.transition = `transform ${animationSpeed}ms ease`;
                    });
                }, animationSpeed);
            }
        } else {
            currentIndex--;
            updateTransform(true);

            if (currentIndex === 0) {
                // перешли на клон последнего
                setTimeout(() => {
                    carouselInner.style.transition = "none";
                    currentIndex = itemsLength;
                    updateTransform(false);
                    requestAnimationFrame(() => {
                        carouselInner.style.transition = `transform ${animationSpeed}ms ease`;
                    });
                }, animationSpeed);
            }
        }
    }



    next.addEventListener("click", () => shift("next"));
    prev.addEventListener("click", () => shift("prev"));

    window.addEventListener("resize", () => renderCarousel());

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

    carouselInner.addEventListener("touchstart", (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    carouselInner.addEventListener("touchend", (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const deltaX = touchStartX - touchEndX;
        const deltaY = Math.abs(touchStartY - touchEndY);

        const threshold = 60; // минимум 60px по горизонтали
        const maxY = 40;      // и максимум 40px по вертикали, чтобы не путать со скроллом

        if (Math.abs(deltaX) > threshold && deltaY < maxY) {
            if (deltaX > 0) {
                shift("next");
            } else {
                shift("prev");
            }
        }
    }, { passive: true });


});
