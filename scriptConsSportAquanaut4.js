
document.addEventListener("DOMContentLoaded", function () {
  const dialSelect = document.getElementById("dialSelect");
  const caseSelect = document.getElementById("caseSelect");
  const engraveSelect = document.getElementById("engraveSelect");
  const logoSelect = document.getElementById("logoSelect");

  const braceletLayer = document.getElementById("braceletLayer");
  const dialLayer = document.getElementById("dialLayer");
  const caseLayer = document.getElementById("caseLayer");

  const engraveText = document.getElementById("engraveText");
  const logoText = document.getElementById("logoText");

  function updateLayer(layer, path, name, ext = "png") {
    layer.src = `watchParts/1_Aquanaut/${path}/${name}.${ext}`;
  }

  function applySelections() {
    const braceletButton = document.querySelector("#braceletOptions button.selected");
    const braceletValue = braceletButton ? braceletButton.dataset.value : "1";
    updateLayer(braceletLayer, "bracelet", `Bracelet_${braceletValue}`);
    updateLayer(dialLayer, "dial", `dial_${dialSelect.value}`);
    updateLayer(caseLayer, "case", `case_${caseSelect.value}`);

    const engraveMap = {
      noLogo: "Без гравировки",
      sLogo: "Гравировка (+200PLN)",
      otherLogo: "Свой текст"
    };

    const logoMap = {
      withIngrave: 'логотип "SEIKO"',
      withoutIngrave: "Без логотипа"
    };

    engraveText.innerText = engraveMap[engraveSelect.value] || "";
    logoText.innerText = logoMap[logoSelect.value] || "";
  }

  function saveToLocal() {
    const braceletButton = document.querySelector("#braceletOptions button.selected");
    const braceletValue = braceletButton ? braceletButton.dataset.value : "1";

    const config = {
      bracelet: braceletValue,
      dial: dialSelect.value,
      case: caseSelect.value,
      engrave: engraveSelect.value,
      logo: logoSelect.value
    };
    localStorage.setItem("aquanautConfig", JSON.stringify(config));
  }

  function loadFromLocalOrURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const config = urlParams.has("bracelet") ? {
      bracelet: urlParams.get("bracelet"),
      dial: urlParams.get("dial"),
      case: urlParams.get("case"),
      engrave: urlParams.get("engrave"),
      logo: urlParams.get("logo")
    } : JSON.parse(localStorage.getItem("aquanautConfig")) || {
      bracelet: "1",
      dial: "1",
      case: "1",
      engrave: "noLogo",
      logo: "withoutIngrave"
    };

    // Выделяем кнопку браслета
    const braceletButtons = document.querySelectorAll('#braceletOptions button');
    braceletButtons.forEach(b => {
      b.classList.toggle('selected', b.dataset.value === config.bracelet);
    });

    dialSelect.value = config.dial;
    caseSelect.value = config.case;
    engraveSelect.value = config.engrave;
    logoSelect.value = config.logo;
    applySelections();
  }

  [dialSelect, caseSelect, engraveSelect, logoSelect].forEach(select => {
    select.addEventListener("change", () => {
      applySelections();
      saveToLocal();
    });
  });

  document.getElementById("downloadBtn").addEventListener("click", () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const width = 800;
    const height = 800;
    canvas.width = width;
    canvas.height = height;

    const imageLayers = [braceletLayer, caseLayer, dialLayer];

    let loaded = 0;
    imageLayers.forEach((img) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        ctx.drawImage(image, 0, 0, width, height);
        loaded++;
        if (loaded === imageLayers.length) {
          const link = document.createElement("a");
          link.download = "aquanaut_watch.png";
          link.href = canvas.toDataURL();
          link.click();
        }
      };
      image.src = img.src;
    });
  });

  // Обработка клика по иконкам браслетов
  const braceletButtons = document.querySelectorAll('#braceletOptions button');
  braceletButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      braceletButtons.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      const value = btn.dataset.value;
      updateLayer(braceletLayer, "bracelet", `Bracelet_${value}`);
      saveToLocal();
    });
  });

  loadFromLocalOrURL();
});
