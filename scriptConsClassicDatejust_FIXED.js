document.addEventListener("DOMContentLoaded", function () {
  // === Обработчики info-кнопок ===
  function setupInfoTooltip(buttonId, tooltipId) {
      const btn = document.getElementById(buttonId);
      const tooltip = document.getElementById(tooltipId);
      const isMobile = window.innerWidth <= 768;

      if (!btn || !tooltip) return;

      if (isMobile) {
          btn.addEventListener("click", (e) => {
              e.stopPropagation();
              const isVisible = tooltip.style.display === "block";
              tooltip.style.display = isVisible ? "none" : "block";
          });

          document.addEventListener("click", (e) => {
              if (!tooltip.contains(e.target) && !btn.contains(e.target)) {
                  tooltip.style.display = "none";
              }
          });
      } else {
          btn.addEventListener("mouseenter", () => {
              tooltip.style.display = "block";
          });

          btn.addEventListener("mouseleave", () => {
              tooltip.style.display = "none";
          });

          tooltip.addEventListener("mouseleave", () => {
              tooltip.style.display = "none";
          });
      }
  }

  setupInfoTooltip("infoButton", "infoTooltip");
  setupInfoTooltip("infoButton2", "infoTooltip2");
  setupInfoTooltip("infoButton3", "infoTooltip3");

  // === Обработчик кнопки скачивания изображения ===
  const downloadBtn = document.getElementById("downloadBtn");
  const watchArea = document.getElementById("watchPreviewBox");

  if (downloadBtn && watchArea) {
      downloadBtn.addEventListener("click", () => {
          const isMobile = window.innerWidth <= 768;

          const originalHeight = watchArea.style.height;
          const originalWidth = watchArea.style.width;

          watchArea.style.setProperty("width", isMobile ? "360px" : "280px", "important");
          watchArea.style.setProperty("height", "400px", "important");

          html2canvas(watchArea, { scale: 2 }).then(canvas => {
              const link = document.createElement("a");
              link.download = "watch.png";
              link.href = canvas.toDataURL("image/png");
              link.click();

              watchArea.style.width = originalWidth;
              watchArea.style.height = originalHeight;
          });
      });
  }
});