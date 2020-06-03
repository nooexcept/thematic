(function () {
  "use strict";

  /**
   *  Block attempts to execute this script again,
   *  otherwise the page may interact to messages more than once.
   */
  if (window.hasThematicRun) return;
  window.hasThematicRun = true;

  const fetchLoad = (url) => {
    return new Promise((resolve, reject) => {
      fetch(url, {
        method: "GET",
        mode: "cors",
        cache: "no-cache",
        credentials: "include",
        referrerPolicy: "no-referrer",
      })
        .then((response) => response.text())
        .then((result) => {
          resolve(result);
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  /* Listen to the background script, giving CSS text to be transformed */
  browser.runtime.onMessage.addListener(async (request) => {
    if (request.type === "request-sheets") {
      const origin = window.location.origin;

      /* Transform styleSheets into an array, map them into CSS Rules texts */
      const sheets = await Promise.all(
        [...document.styleSheets].map(async (s) => {
          if (!s.href || s.href.startsWith(origin)) {
            try {
              return [...s.cssRules].reduce((a, v) => a + v.cssText, "");
            } catch (e) {
              console.log(e);
              return "";
            }
          } else {
            try {
              const downloadedCSS = await fetchLoad(s.href);
              return downloadedCSS;
            } catch (e) {
              console.log(
                "Thematic couldn't download a blocked CSS stylesheet",
                e
              );
              return "";
            }
          }
        })
      );
      return Promise.resolve(sheets);
    }

    return true;
  });
})();
