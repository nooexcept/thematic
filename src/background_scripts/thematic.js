/*global transformSheets*/
"use strict";

var blacklist = [];
var pagePalette = [];
var textPalette = [];
var inverted = [];

var isBlacklisted = (url) => blacklist.some((e) => url.indexOf(e) !== -1);
var isInverted = (url) => inverted.some((e) => url.indexOf(e) !== -1);

const onTabChanged = (tabId, changeInfo, tab, pagePalette, textPalette) => {
  /* We can't access a stylesheet that is still loading, so only run the script when the status is complete. */
  if (changeInfo.status !== "complete") return;
  const url = tab.url;
  if (isBlacklisted(url)) return;
  if (pagePalette.length === 0 || textPalette.length === 0) return;

  /* Run the script individually in all frames */
  browser.webNavigation.getAllFrames({ tabId }).then((frameInfo) => {
    for (let i = 0; i < frameInfo.length; i += 1) {
      const frame = frameInfo[i];
      if (frame.errorOccurred) {
        console.log(frame.errorOccurred);
        return;
      }

      browser.tabs
        .executeScript(tabId, {
          file: "/src/content_scripts/transformPage.js",
          frameId: frame.frameId,
          runAt: "document_idle",
        })
        .then(() => {
          return browser.tabs.sendMessage(
            tabId,
            {
              type: "request-sheets",
            },
            { frameId: frame.frameId }
          );
        })
        .then(async (res) => {
          if (!res) return;

          const transformedSheets = await transformSheets(res, isInverted(url));
          browser.tabs.insertCSS(tabId, {
            code: transformedSheets,
            frameId: frame.frameId,
          });
        });
    }
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

    const filter = {
      properties: ["status"],
    };

    browser.tabs.onUpdated.addListener(
      (tabId, changeInfo, tab) =>
        onTabChanged(tabId, changeInfo, tab, pagePalette, textPalette),
      filter
    );
  }
);
