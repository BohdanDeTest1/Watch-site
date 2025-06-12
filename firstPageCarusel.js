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

    // function renderCarousel(tab = currentTab) {
    //     const visibleCount = getVisibleCount();
    //     const items = data[tab];

    //     carouselInner.innerHTML = "";

    //     // Создаём клоны
    //     const cloneStart = items.slice(-visibleCount);
    //     const cloneEnd = items.slice(0, visibleCount);
    //     const fullList = [...cloneStart, ...items, ...cloneEnd];

    //     fullList.forEach(item => {
    //         const card = document.createElement("div");
    //         card.className = "carousel-card";
    //         const btnText = tab === "design" ? "GO TO CONSTRUCTOR" : "CHECK THE MODEL";
    //         const btnLink = tab === "design" ? "/pageConstructorsSections.html" : "/pageModels.html";

    //         card.innerHTML = `
    //             <img src="${item.image}" alt="${item.name}">
    //             <h3>${item.name}</h3>
    //             <p>${item.price}</p>
    //             <a href="${btnLink}" class="btn-to-watch">${btnText}</a>
    //         `;
    //         carouselInner.appendChild(card);
    //     });

    //     currentIndex = visibleCount;
    //     updateTransform(false);
    // }

    function renderCarousel(tab = currentTab) {
        const visibleCount = getVisibleCount();
        const items = data[tab];

        carouselInner.innerHTML = "";

        const cloneStart = items.slice(-visibleCount);
        const cloneEnd = items.slice(0, visibleCount);
        const fullList = [...cloneStart, ...items, ...cloneEnd];

        fullList.forEach(item => {
            const card = document.createElement("div");
            card.className = "carousel-card";
            const btnText = tab === "design" ? "GO TO CONSTRUCTOR" : "CHECK THE MODEL";
            const btnLink = tab === "design" ? "/pageConstructorsSections.html" : "/pageModels.html";

            card.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <h3>${item.name}</h3>
            <p>${item.price}</p>
            <a href="${btnLink}" class="btn-to-watch">${btnText}</a>
        `;
            carouselInner.appendChild(card);
        });

        currentIndex = visibleCount;
        requestAnimationFrame(() => updateTransform(false));
    }

    // function updateTransform(animate = true) {
    //     const visibleCount = getVisibleCount();
    //     const card = carouselInner.querySelector(".carousel-card");
    //     if (!card) return;

    //     const cardStyle = window.getComputedStyle(carouselInner);
    //     const gap = parseInt(cardStyle.gap || 20); // получаем gap от .carousel-inner

    //     const cardWidth = card.getBoundingClientRect().width;
    //     const offset = currentIndex * (cardWidth + gap);

    //     if (lastOffset === offset) return;

    //     carouselInner.style.transition = animate ? `transform ${animationSpeed}ms ease` : "none";
    //     carouselInner.style.transform = `translateX(-${offset}px)`;

    //     lastOffset = offset;
    // }

    function updateTransform(animate = true) {
        const cards = carouselInner.querySelectorAll(".carousel-card");
        if (!cards[currentIndex]) return;

        const card = cards[currentIndex];
        const offset = card.offsetLeft;

        if (lastOffset === offset) return;

        carouselInner.style.transition = animate ? `transform ${animationSpeed}ms ease` : "none";
        carouselInner.style.transform = `translateX(-${offset}px)`;

        lastOffset = offset;
    }


    let isAnimating = false;

    // function shift(direction) {
    //     if (isAnimating) return;
    //     isAnimating = true;

    //     const visibleCount = getVisibleCount();
    //     const itemsLength = data[currentTab].length;

    //     if (direction === "next") {
    //         currentIndex++;
    //         updateTransform(true);
    //         if (currentIndex === itemsLength + visibleCount) {
    //             setTimeout(() => {
    //                 carouselInner.style.transition = "none";
    //                 currentIndex = visibleCount;
    //                 updateTransform(false);
    //                 isAnimating = false;
    //             }, animationSpeed);
    //         } else {
    //             setTimeout(() => isAnimating = false, animationSpeed);
    //         }
    //     } else {
    //         currentIndex--;
    //         updateTransform(true);
    //         if (currentIndex === 0) {
    //             setTimeout(() => {
    //                 carouselInner.style.transition = "none";
    //                 currentIndex = itemsLength;
    //                 updateTransform(false);
    //                 isAnimating = false;
    //             }, animationSpeed);
    //         } else {
    //             setTimeout(() => isAnimating = false, animationSpeed);
    //         }
    //     }
    // }

    function shift(direction) {
        if (isAnimating) return;
        isAnimating = true;

        const visibleCount = getVisibleCount();
        const itemsLength = data[currentTab].length;

        if (direction === "next") {
            currentIndex++;
            updateTransform(true);

            if (currentIndex === itemsLength + visibleCount) {
                // Перешли на клон — ждём окончания анимации
                setTimeout(() => {
                    carouselInner.style.transition = "none";
                    currentIndex = visibleCount;
                    updateTransform(false);
                    requestAnimationFrame(() => {
                        carouselInner.style.transition = `transform ${animationSpeed}ms ease`;
                        isAnimating = false;
                    });
                }, animationSpeed);
            } else {
                setTimeout(() => isAnimating = false, animationSpeed);
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
                        carouselInner.style.transition = `transform ${animationSpeed}ms ease`;
                        isAnimating = false;
                    });
                }, animationSpeed);
            } else {
                setTimeout(() => isAnimating = false, animationSpeed);
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
    let touchEndX = 0;

    carouselInner.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, false);

    carouselInner.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, false);

    function handleSwipe() {
        const threshold = 50; // Минимальное расстояние для свайпа
        const swipeDistance = touchStartX - touchEndX;

        if (Math.abs(swipeDistance) > threshold) {
            if (swipeDistance > 0) {
                shift("next");
            } else {
                shift("prev");
            }
        }
    }

});
