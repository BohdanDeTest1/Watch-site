document.addEventListener("DOMContentLoaded", function () {
  const carouselInner = document.querySelector(".carousel-inner");
  const tabs = document.querySelectorAll(".tab-button");
  const prev = document.getElementById("prev");
  const next = document.getElementById("next");
  const animationSpeed = 500;

  const data = {
    design: [
      { image: "model1.png", name: "Watch 1", price: "$100" },
      { image: "model2.png", name: "Watch 2", price: "$200" },
      { image: "model3.png", name: "Watch 3", price: "$300" },
    ],
    ready: [
      { image: "model4.png", name: "Watch 4", price: "$150" },
      { image: "model5.png", name: "Watch 5", price: "$250" },
    ]
  };

  let currentTab = "design";
  let currentIndex = 0;
  let lastOffset = null;

  function getVisibleCount() {
    return window.innerWidth < 768 ? 1 : 4;
  }

  function renderCarousel(tab = currentTab) {
    const visibleCount = getVisibleCount();
    const items = data[tab];

    carouselInner.innerHTML = "";

    const cloneStart = items.slice(-visibleCount);
    const cloneEnd = items.slice(0, visibleCount);
    const fullList = [...cloneStart, ...items, ...cloneEnd];

    fullList.forEach((item) => {
      const card = document.createElement("div");
      card.className = "carousel-card";
      card.innerHTML = `
        <img src="\${item.image}" alt="\${item.name}">
        <h3>\${item.name}</h3>
        <p>\${item.price}</p>
      `;
      carouselInner.appendChild(card);
    });

    currentIndex = visibleCount;
    requestAnimationFrame(() => updateTransform(false));
  }

  function updateTransform(animate = true) {
    const card = carouselInner.querySelector(".carousel-card");
    if (!card) return;
    const gap = 20;
    const cardWidth = card.getBoundingClientRect().width;
    const offset = card.offsetLeft;

    if (lastOffset === offset) return;

    carouselInner.style.transition = animate ? `transform ${animationSpeed}ms ease` : "none";
    carouselInner.style.transform = `translateX(-${offset}px)`;
    lastOffset = offset;
  }

  function shift(direction) {
    const visibleCount = getVisibleCount();
    const itemsLength = data[currentTab].length;

    if (direction === "next") {
      currentIndex++;
      updateTransform(true);
      if (currentIndex === itemsLength + visibleCount) {
        setTimeout(() => {
          carouselInner.style.transition = "none";
          currentIndex = visibleCount;
          updateTransform(false);
        }, animationSpeed);
      }
    } else {
      currentIndex--;
      updateTransform(true);
      if (currentIndex === 0) {
        setTimeout(() => {
          carouselInner.style.transition = "none";
          currentIndex = itemsLength;
          updateTransform(false);
        }, animationSpeed);
      }
    }
  }

  next.addEventListener("click", () => shift("next"));
  prev.addEventListener("click", () => shift("prev"));

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentTab = tab.dataset.tab;
      renderCarousel();
    });
  });

  renderCarousel();

  // Touch events
  let touchStartX = 0;
  let touchEndX = 0;

  carouselInner.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  carouselInner.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const distance = touchStartX - touchEndX;
    if (Math.abs(distance) > 50) {
      shift(distance > 0 ? "next" : "prev");
    }
  });
});