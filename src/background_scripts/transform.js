/*global tinycolor pagePalette textPalette*/
"use strict";

/* Define the props that will be checked */
const pageColorProps = [
  "background",
  "background-color",
  "background-image",
  "border",
];

const textColorProps = ["color", "fill"];

const hexToValues = (hex) => {
  const hexLength = hex.length;
  if (hexLength === 3) {
    const r = parseInt(`${hex[0]}${hex[0]}`, 16);
    const g = parseInt(`${hex[1]}${hex[1]}`, 16);
    const b = parseInt(`${hex[2]}${hex[2]}`, 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) return 0;

    return r + g + b;
  } else if (hexLength === 6) {
    const r = parseInt(`${hex[0]}${hex[1]}`, 16);
    const g = parseInt(`${hex[2]}${hex[3]}`, 16);
    const b = parseInt(`${hex[4]}${hex[5]}`, 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) return 0;

    return r + g + b;
  }

  return 0;
};

const transformElement = (value, prop, mapFunction) => {
  if (!value || value.indexOf("rgb") === -1) return "";
  if (value === "transparent") return value;

  let transformedStyle = value;

  /**
   * If there is a variable in this step, it should be ignored, it was either calculated
   * before(if not missed), or was/will be replaced if it is for a text prop
   */
  if (transformedStyle.indexOf("var") !== -1) return transformedStyle;

  transformedStyle = transformedStyle.replace(
    /rgba?\((\d{1,3}), ?(\d{1,3}), ?(\d{1,3} ?)(?:, ?(\d?.?\d*))?\)/g,
    (match, r, g, b, a) => {
      const mappedValue = mapFunction(parseInt(r) + parseInt(g) + parseInt(b));
      if (a)
        return mappedValue.replace("rgb(", "rgba(").replace(")", `, ${a})`);

      return mappedValue;
    }
  );

  transformedStyle = transformedStyle.replace(/#([0-9a-fA-F]+)/g, (match, v) =>
    mapFunction(hexToValues(v))
  );

  transformedStyle = transformedStyle.replace(
    /hsla?\((?:(\d{0,3}.?\d*)(?:%|deg|rad|turn)? ?,?)(?: ?(\d{1,3}%?) ?,?)(?: ?(\d{1,3}%?) ?,?)(?: ?\/? ?(\d{0,3}.?\d*%?))?\)/g,
    (match, h, s, l, a) => {
      const rgb = tinycolor({ h, s, l }).toRgb();
      const mappedValue = mapFunction(rgb.r + rgb.g + rgb.b);
      if (a)
        return mappedValue.replace("rgb(", "rgba(").replace(")", `, ${a})`);

      return mappedValue;
    }
  );

  if (!transformedStyle) return "";
  return `${prop}: ${transformedStyle} !important;`;
};

const camelCase = (propName) =>
  propName.replace(/-(\w)/g, (all, w) => w.toUpperCase());

const parseCSSVar = (style, variables) => {
  let formattedValue = style;
  let varIdx;

  while ((varIdx = formattedValue.indexOf("var(")) !== -1) {
    /* Get only what is within var() */
    let varContent = formattedValue.substring(varIdx + 4);
    varContent = varContent.substring(0, varContent.lastIndexOf(")"));

    /* Split the first occurrence of a comma */
    const varValues = varContent.split(/,(.+)/);

    /* Check if the first value is defined */
    if (variables[varValues[0]]) return variables[varValues[0]];

    /* Check if there's a second value */
    if (varValues[1]) {
      /* Check if the second value is another var */
      if (varValues[1].indexOf("var(") !== -1) {
        /* If it is another var, it'll be processed in the next iteration */
        formattedValue = varValues[1];
      } else {
        if (variables[varValues[1]]) {
          return variables[varValues[1]];
        } else {
          /* Either the class with the variable was missed, or it is a predefined color, currently not handled */
          return varValues[1];
        }
      }
    } else {
      return varValues[0];
    }
  }
};

const getTransformedTextColor = (rule, prop, mapTextColor, variables) => {
  const style = rule.style[prop];

  /* If it is a variable, parse and recalculate the value for the text */
  if (style.indexOf("var") !== -1) {
    const parsedStyle = parseCSSVar(style, variables);
    return transformElement(parsedStyle, prop, mapTextColor);
  } else {
    return transformElement(style, prop, mapTextColor);
  }
};

const getTransformedRule = (rule, mapColor, mapTextColor, variables) => {
  /* Do not do anything in the case of a undefined selectorText, this happens with CSSKeyframeRule */
  if (!rule.selectorText) return "";

  let elements = "";
  const ruleLength = rule.style.length;

  if (ruleLength === 0) return "";

  /* Loop through all rules and transform variables  */
  for (let i = 0; i < ruleLength; i += 1) {
    const styleProp = rule.style[i];

    if (styleProp.startsWith("--")) {
      let styleValue = rule.style.getPropertyValue(styleProp);

      if (styleValue.indexOf("var") !== -1)
        styleValue = parseCSSVar(styleValue, variables);

      let tinyColor = tinycolor(styleValue);

      /**
       * Transform the tinycolor to a rgba if it is a valid color, or just use the style value,
       * the original value is stored in the variables object because text rules are replaced using it.
       */
      if (tinyColor.isValid()) {
        const rgbaValue = tinyColor.toRgbString();
        variables[styleProp] = rgbaValue;
        elements += transformElement(rgbaValue, styleProp, mapColor);
      } else {
        variables[styleProp] = styleValue;
        elements += transformElement(styleValue, styleProp, mapColor);
      }
    }
  }

  /* Loop through page props and text props, transforming if this rule has any */
  for (let i = 0; i < pageColorProps.length; i += 1) {
    const prop = pageColorProps[i];

    if (rule.style[camelCase(prop)])
      elements += transformElement(rule.style[camelCase(prop)], prop, mapColor);
  }

  for (let i = 0; i < textColorProps.length; i += 1) {
    const prop = textColorProps[i];

    if (rule.style[camelCase(prop)])
      elements += getTransformedTextColor(rule, prop, mapTextColor, variables);
  }

  if (!elements) return "";
  return `${rule.selectorText}{${elements}}`;
};

const transformRules = (rules, mapColor, mapTextColor, variables) => {
  if (!rules) return "";
  let transformedRules = "";

  const ruleCount = rules.length;
  for (let i = 0; i < ruleCount; i += 1) {
    const rule = rules[i];

    /* Some rules may actually have a CSSRuleList, if that is the case they need to be transformed. */
    transformedRules += rule.style
      ? getTransformedRule(rule, mapColor, mapTextColor, variables)
      : transformRules(rule.cssRules, mapColor, mapTextColor, variables);
  }

  return transformedRules;
};

/**
 *  Transform a number to a number in a different range
 *  Usage: affineTransform(765, 0, 765, 0, 7) -> 7
 */
const affineTransform = (x, minA, maxA, minB, maxB) =>
  Math.round((x - minA) * ((maxB - minB) / (maxA - minA)) + minB);

const normalPaletteScale = (palette) => (oldColor) =>
  palette[affineTransform(oldColor, 0, 765, 0, palette.length - 1)];
const invertedPaletteScale = (palette) => (oldColor) =>
  palette[affineTransform(oldColor, 0, 765, palette.length - 1, 0)];

const replaceColors = (sheet, variables, isInverted) => {
  let mapPageColor;
  let mapTextColor;

  if (!isInverted) {
    mapPageColor = normalPaletteScale(pagePalette);
    mapTextColor = invertedPaletteScale(textPalette);
  } else {
    mapPageColor = invertedPaletteScale(pagePalette);
    mapTextColor = normalPaletteScale(textPalette);
  }

  let sheetRules = sheet.cssRules;

  if (!sheetRules && sheet.sheet) sheetRules = sheet.sheet.cssRules;
  return transformRules(sheetRules, mapPageColor, mapTextColor, variables);
};

const getStylesheetFromText = (css) => {
  /**
   *  Create a style and a doc node to append it to, as the stylesheet will
   *  only be parsed after it was appended
   */
  const htmlDoc = document.implementation.createHTMLDocument("");
  const sheet = document.createElement("style");
  sheet.appendChild(document.createTextNode(css));
  htmlDoc.body.appendChild(sheet);
  return sheet;
};

// eslint-disable-next-line no-unused-vars
const transformSheets = async (sheets, isInverted) => {
  let transformedStyles = "";

  const totalSheets = sheets.length;

  /* Store all CSS variables because their values are needed when changing text colors */
  let variables = {};

  for (let i = 0; i < totalSheets; i += 1) {
    try {
      /* Check if the stylesheet is located in the current domain */
      transformedStyles += replaceColors(
        getStylesheetFromText(sheets[i]),
        variables,
        isInverted
      );
    } catch (e) {
      console.log(e);
    }
  }

  return transformedStyles;
};
