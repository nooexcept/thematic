const statusTextEl = document.getElementById("status-text");
const siteEnabledCheckboxEl = document.getElementById("siteEnableCheckbox");
const siteInvertedCheckboxEl = document.getElementById("siteInvertCheckbox");

const getDomain = (url) => {
  let formattedURL = url;

  let idx;
  if ((idx = formattedURL.indexOf("www.")) !== -1) {
    formattedURL = formattedURL.substring(idx + 4);
  } else if ((idx = formattedURL.indexOf("//")) !== -1) {
    formattedURL = formattedURL.substring(idx + 2);
  }

  if ((idx = formattedURL.indexOf("/")) !== -1)
    formattedURL = formattedURL.substring(0, idx);

  return formattedURL;
};

browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
  /* Use the active tab url from the array */
  const activeTabURL = tabs[0].url;
  const activeTabID = tabs[0].id;

  if (activeTabURL.startsWith("http") || activeTabURL.startsWith("ftp")) {
    const domainURL = getDomain(activeTabURL);

    /* Set the domain as the status text, as it is more readable */
    statusTextEl.textContent = domainURL;

    const backgroundWindow = browser.extension.getBackgroundPage();
    /* Check the URL blacklist using the domain */
    siteEnabledCheckboxEl.checked = !backgroundWindow.isBlacklisted(domainURL);
    siteInvertedCheckboxEl.checked = backgroundWindow.isInverted(domainURL);

    siteEnabledCheckboxEl.addEventListener("change", (e) => {
      /* Update the URL blacklist based in the checkbox status */
      if (e.target.checked) {
        backgroundWindow.blacklist = backgroundWindow.blacklist.filter(
          (url) => url !== domainURL
        );
      } else {
        backgroundWindow.blacklist.push(domainURL);
      }

      browser.storage.local.set({ blacklist: backgroundWindow.blacklist });
      browser.tabs.reload(activeTabID);
    });

    siteInvertedCheckboxEl.addEventListener("change", (e) => {
      if (e.target.checked) {
        backgroundWindow.inverted.push(domainURL);
      } else {
        backgroundWindow.inverted = backgroundWindow.inverted.filter(
          (url) => url !== domainURL
        );
      }
      browser.storage.local.set({ inverted: backgroundWindow.inverted });
      browser.tabs.reload(activeTabID);
    });
  } else {
    /* Hide the page-status element if the page url is not valid */
    const pageStatusEl = document.getElementById("page-status");
    pageStatusEl.style.display = "none";
  }
});

document.getElementById("options-btn").onclick = () => {
  browser.tabs.create({
    url: "../../pages/options.html",
  });
};
