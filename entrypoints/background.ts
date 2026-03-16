import { blockRulesStorage } from "@/lib/storage";

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    await blockRulesStorage.getValue();
  });

  // Notify content scripts when the URL changes within a tab (SPA navigations)
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
      browser.tabs.sendMessage(tabId, { type: "url-changed", url: changeInfo.url }).catch(() => {
        // Content script may not be ready yet — ignore
      });
    }
  });
});
