import { ChromeInstance, Logger } from './types';

export class IconSwitcher {
  #chrome: ChromeInstance;
  #logger: Logger;

  constructor(chrome: ChromeInstance, logger: Logger) {
    this.#chrome = chrome;
    this.#logger = logger;
  }

  async updateIcon(tabId: number, isMuted: boolean): Promise<void> {
    try {
      const path = isMuted ? 'icons/icon-muted.png' : 'icons/icon.png';
      await this.#chrome.action.setIcon({ path, tabId });
      this.#logger.log(`Icon updated for tab ${tabId} (muted: ${isMuted})`);
    } catch (error) {
      this.#logger.error(`Failed to update icon for tab ${tabId}: ${error}`);
    }
  }
} 