/*global tinycolor*/

const backgroundWindow = browser.extension.getBackgroundPage();

$("#page-picker").spectrum({
  preferredFormat: "rgb",
  flat: true,
  showInput: true,
  showButtons: false,
  containerClassName: "picker",
});

const paletteTypeEl = document.getElementById("palette-type-select");
const paletteTip = document.getElementById("palette-tip");

/* Texts displayed when the select element is changed */
const pagePaletteTip =
  "Pick the palette that will be used to change all page elements, except the text.";
const textPaletteTip =
  "Pick the palette that will be used to change the text colors.";
paletteTip.textContent = pagePaletteTip;

const colorListEl = $("#color-list");

/* Update the element that display colors with the specified colors(arr of color values) */
const populateColorList = (colors) => {
  const colorCount = colors.length;

  colorListEl.empty();
  for (let i = 0; i < colorCount; i += 1) {
    let newColor = document.createElement("div");
    /* The actual color is set in the background style rule */
    newColor.style.background = colors[i];
    newColor.classList.add("color");
    newColor.onclick = () => $("#page-picker").spectrum("set", colors[i]);
    colorListEl.append(newColor);
  }
};

const getCurrentPaletteProp = () => {
  const paletteType = paletteTypeEl.options[paletteTypeEl.selectedIndex].value;

  switch (paletteType) {
    case "page":
      return "pagePalette";
    case "text":
      return "textPalette";
  }
};

/* Get the current selected palette(in the select element) values from the storage */
const getCurrentPalette = async () => {
  const paletteType = paletteTypeEl.options[paletteTypeEl.selectedIndex].value;

  switch (paletteType) {
    case "page":
      return await browser.storage.local
        .get("pagePalette")
        .then((item, err) => {
          if (err) console.log(err);
          return item.pagePalette;
        });
    case "text": {
      return await browser.storage.local
        .get("textPalette")
        .then((item, err) => {
          if (err) console.log(err);
          return item.textPalette;
        });
    }
  }
};

const updateColors = async () => {
  const paletteType = paletteTypeEl.options[paletteTypeEl.selectedIndex].value;
  switch (paletteType) {
    case "page":
      paletteTip.textContent = pagePaletteTip;
      break;
    case "text":
      paletteTip.textContent = textPaletteTip;
      break;
  }

  populateColorList(await getCurrentPalette());
};

updateColors();
paletteTypeEl.onchange = () => updateColors();

// Add a tinycolor to a palette, it will be filtered using the color value
const addColor = (color, palette, sort) => {
  palette.push(color.toRgbString());

  return palette
    .map((c) => {
      const color = tinycolor(c).toRgb();
      return { color: c, value: color.r + color.g + color.b };
    })
    .sort(sort)
    .map((cObj) => cObj.color);
};

$(".btn-add").click(async () => {
  const color = $("#page-picker").spectrum("get");

  const palette = await getCurrentPalette();
  const paletteProp = getCurrentPaletteProp();
  const sort =
    paletteProp === "pagePalette"
      ? (a, b) => a.value - b.value
      : (a, b) => b.value - a.value;
  const newPalette = addColor(color, palette, sort);
  const item = {};

  item[paletteProp] = newPalette;
  backgroundWindow[paletteProp] = newPalette;

  await browser.storage.local.set(item);
  populateColorList(newPalette);
});

$(".btn-remove").click(async () => {
  const color = $("#page-picker").spectrum("get").toRgbString();
  const palette = await getCurrentPalette();

  const newPalette = palette.filter((c) => c !== color);
  const item = {};
  const paletteProp = getCurrentPaletteProp();

  item[paletteProp] = newPalette;
  backgroundWindow[paletteProp] = newPalette;
  await browser.storage.local.set(item);
  populateColorList(newPalette);
});
