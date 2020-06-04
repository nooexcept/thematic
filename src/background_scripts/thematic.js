/*global transformSheets getDomain*/
"use strict";

var blacklist = [];
var pagePalette = [];
var textPalette = [];
var inverted = [];

var isBlacklisted = (url) => blacklist.some((e) => url.indexOf(e) !== -1);
var isInverted = (url) => inverted.some((e) => url.indexOf(e) !== -1);

const getDisplayCover = (url) => {
  const basePageColor = !isInverted(url)
    ? pagePalette[pagePalette.length - 1]
    : pagePalette[0];
  return `:root{background:${basePageColor} !important}html{background:${basePageColor} !important}body,body *{visibility:hidden !important}`;
};

const transformPage = (() => {
  let cache = {};

  return {
    transform: async (tabId, url, frameId) => {
      const cacheURL = url + frameId;

      if (!cache[cacheURL]) {
        await browser.tabs.executeScript(tabId, {
          file: "/src/content_scripts/transformPage.js",
          frameId: frameId,
          runAt: "document_idle",
        });

        const cssText = await browser.tabs.sendMessage(
          tabId,
          {
            type: "request-sheets",
          },
          { frameId: frameId }
        );

        cache[cacheURL] = await transformSheets(cssText, isInverted(url));
      }

      await browser.tabs.insertCSS(tabId, {
        code: cache[cacheURL],
        runAt: "document_start",
        frameId: frameId,
      });
    },
    isCached: (url, frameId) => !!cache[url + frameId],
  };
})();

const hideIframesCSS = "iframe{visibility: hidden}";

const onDOMCommitted = ({ tabId, url, frameId }) => {
  if (isBlacklisted(url)) return;
  if (pagePalette.length === 0 || textPalette.length === 0) return;

  /**
   * It's not possible to insert the CSS in any other frame in this step,
   * because the DOM is not fully loaded
   */
  if (frameId !== 0) return;

  const domain = getDomain(url);

  /* If it is cached, the transformation will just apply the CSS as soon as possible */
  if (transformPage.isCached(domain, frameId)) {
    transformPage.transform(tabId, domain, frameId);
  } else {
    browser.tabs.insertCSS(tabId, {
      code: getDisplayCover(url),
      runAt: "document_start",
      frameId: frameId,
      cssOrigin: "user",
    });
  }

  /* Hide iframes before they show up */
  browser.tabs.insertCSS(tabId, {
    code: hideIframesCSS,
    runAt: "document_start",
    frameId: frameId,
    cssOrigin: "user",
  });
};

const onDOMCompleted = async ({ tabId, url, frameId }) => {
  if (isBlacklisted(url)) return;
  if (pagePalette.length === 0 || textPalette.length === 0) return;
  if (frameId !== 0) return;

  const domain = getDomain(url);

  /* Transform sheets if the page is not cached, as it wasn't transformed during onDOMCommitted */
  if (!transformPage.isCached(domain, frameId)) {
    await transformPage.transform(tabId, domain, frameId);
    browser.tabs.removeCSS(tabId, {
      code: getDisplayCover(url),
      frameId: frameId,
      cssOrigin: "user",
    });
  }

  /* Transform all iframes */
  browser.webNavigation.getAllFrames({ tabId }).then(async (frameInfo) => {
    for (let i = 0; i < frameInfo.length; i += 1) {
      if (frameInfo[i].frameId !== 0)
        await transformPage.transform(tabId, url, frameInfo[i].frameId);
    }

    browser.tabs.removeCSS(tabId, {
      code: hideIframesCSS,
      frameId: frameId,
      cssOrigin: "user",
    });
  });
};

/**
 *  Receives properties in the storage.local and their respective
 *  default values, it will set the default if needed and return the values
 */
const getItemsOrSetDefault = async (storageObj) => {
  const res = [];
  const props = Object.keys(storageObj);
  const propCount = props.length;

  for (let i = 0; i < propCount; i += 1) {
    const prop = props[i];

    let tmp = await browser.storage.local.get(prop).then((item, err) => {
      if (err) console.log(err);
      return item[prop];
    });

    if (!tmp) {
      tmp = storageObj[prop];
      const obj = {};
      obj[prop] = tmp;
      await browser.storage.local.set(obj);
    }

    res.push(tmp);
  }

  return res;
};

getItemsOrSetDefault({
  pagePalette: ["rgb(255, 157, 118)", "rgb(235, 77, 85)", "rgb(51, 51, 102)"],
  textPalette: ["rgb(246, 225, 225)"],
  blacklist: ["about:blank", "moz-extension"],
  inverted: [],
}).then(
  ([storedPagePalette, storedTextPalette, storedBlacklist, storedInverted]) => {
    blacklist = storedBlacklist;
    pagePalette = storedPagePalette;
    textPalette = storedTextPalette;
    inverted = storedInverted;

    browser.webNavigation.onCommitted.addListener(onDOMCommitted);
    browser.webNavigation.onCompleted.addListener(onDOMCompleted);
  }
);
