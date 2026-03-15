import { blockRulesStorage } from "@/lib/storage";

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    await blockRulesStorage.getValue();
  });
});
