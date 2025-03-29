import { ChromeInstance, Logger } from './types';

class UpgradeCoordinator {
  #chrome: ChromeInstance;
  #logger: Logger;

  constructor(chromeInstance: ChromeInstance, logger: Logger) {
    this.#chrome = chromeInstance;
    this.#logger = logger;
  }

  async upgrade(): Promise<void> {
    const keys = await this.#chrome.storage.sync.getKeys();

    // We don't want to use the terms "whitelist" and "blacklist" anymore.
    // We want to use "allowlist" and "blocklist" instead. Also, it doesn't
    // make sense to store the two lists separately. We should store a single
    // list and a flag indicating whether it's an allowlist or a blocklist.
    if (keys.includes("usingWhitelist")) {
      const usingAllowList = await this.#chrome.storage.sync.get(
        "usingWhitelist"
      );
      let list;
      if (usingAllowList) {
        list = await this.#chrome.storage.sync.get("whitelist");
      } else {
        list = await this.#chrome.storage.sync.get("blacklist");
      }

      await this.#chrome.storage.sync.remove("usingWhitelist");
      await this.#chrome.storage.sync.remove("whitelist");
      await this.#chrome.storage.sync.remove("blacklist");

      await this.#chrome.storage.sync.set({
        allowOrBlockList: list,
        usingAllowList,
      });
    }
  }
}

export default UpgradeCoordinator; 