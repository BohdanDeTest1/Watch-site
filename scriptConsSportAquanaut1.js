document.addEventListener("DOMContentLoaded", function () {
  const braceletSelect = document.getElementById("braceletSelect");
  const dialSelect = document.getElementById("dialSelect");
  const caseSelect = document.getElementById("caseSelect");
  const engraveSelect = document.getElementById("engraveSelect");
  const logoSelect = document.getElementById("logoSelect");

  const braceletLayer = document.getElementById("braceletLayer");
  const dialLayer = document.getElementById("dialLayer");
  const caseLayer = document.getElementById("caseLayer");
  const engraveLayer = document.getElementById("engraveLayer");
  const logoLayer = document.getElementById("logoLayer");

  function updateLayer(layer, path, name, ext = "png") {
    layer.src = `/watchParts/1_Aquanaut/${path}/${name}.${ext}`;
  }

  function applySelections() {
    updateLayer(braceletLayer, "bracelet", `Bracelet_${braceletSelect.value}`);
    updateLayer(dialLayer, "dial", `dial_${dialSelect.value}`);
    updateLayer(caseLayer, "case", `case_${caseSelect.value}`);
    updateLayer(engraveLayer, "ingrave", engraveSelect.value);
    updateLayer(logoLayer, "logo", logoSelect.value);

  }

  function saveToLocal() {
    const config = {
      bracelet: braceletSelect.value,
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
      logo: "withIngrave"
    };

    braceletSelect.value = config.bracelet;
    dialSelect.value = config.dial;
    caseSelect.value = config.case;
    engraveSelect.value = config.engrave;
    logoSelect.value = config.logo;
    applySelections();
  }

  [braceletSelect, dialSelect, caseSelect, engraveSelect, logoSelect].forEach(select => {
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

    const layers = [braceletLayer, caseLayer, dialLayer, logoLayer, engraveLayer];

    let loaded = 0;
    layers.forEach((img) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        ctx.drawImage(image, 0, 0, width, height);
        loaded++;
        if (loaded === layers.length) {
          const link = document.createElement("a");
          link.download = "aquanaut_watch.png";
          link.href = canvas.toDataURL();
          link.click();
        }
      };
      image.src = img.src;
    });
  });

  loadFromLocalOrURL();
});
