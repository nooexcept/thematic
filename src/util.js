/* eslint no-unused-vars: 0 */

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
