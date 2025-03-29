import { ChromeInstance, ExtensionOptions, ListExpert, Logger, ListInfo, Tab } from './types';

export class TabTracker {
  #chrome: ChromeInstance;
  #extensionOptions: ExtensionOptions;
  #listExpert: ListExpert;
  #logger: Logger;
  #muteStateCache: Map<number, boolean>;
  #debounceTimeout: number;
  #isProcessing: boolean;
  #mutedTabs: Set<number>;
  #tabs: Map<number, string>;

  constructor(
    chromeInstance: ChromeInstance,
    extensionOptions: ExtensionOptions,
    listExpert: ListExpert,
    logger: Logger
  ) {
    this.#chrome = chromeInstance;
    this.#extensionOptions = extensionOptions;
    this.#listExpert = listExpert;
    this.#logger = logger;
    this.#muteStateCache = new Map();
    this.#debounceTimeout = 0;
    this.#isProcessing = false;
    this.#mutedTabs = new Set();
    this.#tabs = new Map();
  }

  async muteByApplicationLogic(tab: Tab): Promise<void> {
    if (!tab.id || !tab.url) return;
    const [enabled, listInfo] = await Promise.all([
      this.#extensionOptions.getEnabled(),
      this.#listExpert.getListInfo()
    ]);
    if (enabled) {
      const shouldMute = await this.#shouldMute(listInfo, tab.url);
      await this.#setMuteOnTab(tab.id, shouldMute, false);
    }
  }

  async muteAllTabsByApplicationLogic(): Promise<void> {
    await this.#muteAllTabs(false);
  }

  async muteAllTabsByUserRequest(): Promise<void> {
    await this.#muteAllTabs(true);
  }

  async toggleMuteOnCurrentTabByUserRequest(): Promise<void> {
    const tab = await this.#getCurrentTab();
    if (tab?.id && tab?.mutedInfo) {
      await this.#setMuteOnTab(tab.id, !tab.mutedInfo.muted, true);
    }
  }

  async muteOtherTabsByUserRequest(): Promise<void> {
    const tab = await this.#getCurrentTab();
    if (tab) {
      await this.#muteAllTabs(true, tab.id);
    } else {
      this.#logger.warn("Could not determine current tab");
      await this.#muteAllTabs(true);
    }
  }

  async onTabReplaced(addedTabId: number, removedTabId: number): Promise<void> {
    try {
      this.#mutedTabs.delete(removedTabId);
      await this.muteTab(addedTabId);
    } catch (error) {
      this.#logger.error(`Failed to handle tab replacement: ${error}`);
    }
  }

  async onTabUrlChanged(tabId: number): Promise<void> {
    await this.#muteById(tabId);
  }

  async addOrRemoveCurrentPageInList(): Promise<void> {
    const tab = await this.#getCurrentTab();
    if (!tab?.url) return;
    await this.#listExpert.addOrRemoveUrlInList(tab.url);
    await this.#unmuteAllTabs();
    await this.muteAllTabsByApplicationLogic();
  }

  async addOrRemoveCurrentDomainInList(): Promise<void> {
    const tab = await this.#getCurrentTab();
    if (!tab?.url) return;
    await this.#listExpert.addOrRemoveDomainInList(tab.url);
    await this.#unmuteAllTabs();
    await this.muteAllTabsByApplicationLogic();
  }

  async isCurrentTabMuted(): Promise<boolean> {
    const tab = await this.#getCurrentTab();
    return tab?.mutedInfo?.muted ?? false;
  }

  async isCurrentTabMutedByExtension(): Promise<boolean> {
    const tab = await this.#getCurrentTab();
    return (
      (tab?.mutedInfo?.muted ?? false) &&
      tab?.mutedInfo?.extensionId === this.#chrome.runtime.id
    );
  }

  async isDomainOfCurrentTabInList(): Promise<boolean> {
    const tab = await this.#getCurrentTab();
    if (!tab?.url) return false;
    return await this.#listExpert.isDomainInList(tab.url);
  }

  async isCurrentTabInList(): Promise<boolean> {
    const tab = await this.#getCurrentTab();
    if (!tab?.url) return false;
    return await this.#listExpert.isExactMatchInList(tab.url);
  }

  async updateSettings(settingsInfo: {
    initial?: { enabled?: boolean; allowOrBlockList?: string; usingAllowList?: boolean };
    current?: { enabled?: boolean; allowOrBlockList?: string; usingAllowList?: boolean };
  }): Promise<void> {
    if (!settingsInfo) {
      return;
    }

    if (settingsInfo.initial?.enabled !== settingsInfo.current?.enabled) {
      if (settingsInfo.current?.enabled) {
        await this.muteAllTabsByApplicationLogic();
      } else {
        await this.#unmuteAllTabs();
      }
    }

    if (
      settingsInfo.initial?.allowOrBlockList !==
      settingsInfo.current?.allowOrBlockList
    ) {
      await this.#unmuteAllTabs();
      await this.muteAllTabsByApplicationLogic();
    }

    if (
      settingsInfo.initial?.usingAllowList !==
      settingsInfo.current?.usingAllowList
    ) {
      await this.#unmuteAllTabs();
      await this.muteAllTabsByApplicationLogic();
    }
  }

  async #muteAllTabs(byUserRequest: boolean, excludeId?: number): Promise<void> {
    const listInfo = await this.#listExpert.getListInfo();
    const tabs = await this.#getAllTabs();
    if (!tabs) {
      return;
    }
    for (const tab of tabs) {
      if (!tab.id) continue;
      if (tab.id === excludeId) continue;
      if (byUserRequest) {
        await this.#setMuteOnTab(tab.id, true, true);
      } else {
        await this.#mute(listInfo, tab);
      }
    }
  }

  async #unmuteAllTabs(): Promise<void> {
    const extensionId = this.#chrome.runtime.id;
    const tabs = await this.#getAllTabs();
    if (!tabs) {
      return;
    }
    for (const tab of tabs) {
      if (tab.mutedInfo?.extensionId === extensionId && tab.id) {
        await this.#setMuteOnTab(tab.id, false, true);
      }
    }
  }

  async #setMuteOnTab(tabId: number, muted: boolean, byUser: boolean): Promise<void> {
    if (!tabId) return;
    try {
      await this.#chrome.tabs.update(tabId, { muted });
      if (muted) {
        this.#mutedTabs.add(tabId);
      } else {
        this.#mutedTabs.delete(tabId);
      }
      if (byUser) {
        this.#logger.log(`Tab ${tabId} ${muted ? 'muted' : 'unmuted'} by user`);
      }
    } catch (error) {
      this.#logger.error(`Failed to ${muted ? 'mute' : 'unmute'} tab ${tabId}: ${error}`);
    }
  }

  async #mute(listInfo: ListInfo, tab: Tab): Promise<void> {
    if (!tab.url || !tab.id) return;
    const shouldMute = await this.#shouldMute(listInfo, tab.url);
    await this.#setMuteOnTab(tab.id, shouldMute, false);
  }

  async #getTabById(tabId: number): Promise<Tab | null> {
    return await this.#chrome.tabs.get(tabId);
  }

  async #getCurrentTab(): Promise<Tab | null> {
    const tabs = await this.#chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    return tabs?.length ? tabs[0] : null;
  }

  async #getAllTabs(): Promise<Tab[] | null> {
    return await this.#chrome.tabs.query({});
  }

  async #shouldMute(listInfo: ListInfo, url: string): Promise<boolean> {
    this.#logger.log(`Checking ${url} against ${listInfo.listOfPages}`);
    const inList = await this.#listExpert.isInList(listInfo.listOfPages, url);
    return (
      (!listInfo.isAllowedAudioList && inList) ||
      (listInfo.isAllowedAudioList && !inList)
    );
  }

  async #muteById(tabId: number): Promise<void> {
    const tab = await this.#getTabById(tabId);
    if (tab) {
      await this.muteByApplicationLogic(tab);
    } else {
      this.#logger.log(this.#chrome.runtime.lastError?.message ?? 'Unknown error');
    }
  }

  async handleTabCreated(tab: Tab): Promise<void> {
    if (!tab.id || !tab.url) return;
    this.#logger.log(`Handling new tab creation: ${tab.id} with URL: ${tab.url}`);
    await this.muteByApplicationLogic(tab);
    this.#tabs.set(tab.id, tab.url);
  }

  async handleTabUpdated(tabId: number, url: string): Promise<void> {
    if (!url) return;
    const tab = { id: tabId, url } as Tab;
    await this.muteByApplicationLogic(tab);
  }

  async handleTabActivated(tabId: number): Promise<void> {
    if (!tabId) return;
    const url = this.#tabs.get(tabId);
    if (!url) return;
    await this.handleTabUpdated(tabId, url);
  }

  async handleWindowFocusChanged(windowId: number): Promise<void> {
    if (!windowId) return;
    const tab = await this.#getCurrentTab();
    if (!tab?.id || !tab?.url) return;
    await this.handleTabUpdated(tab.id, tab.url);
  }

  async muteAllTabs(): Promise<void> {
    try {
      const tabs = await this.#chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id) {
          await this.muteTab(tab.id);
        }
      }
    } catch (error) {
      this.#logger.error(`Failed to mute all tabs: ${error}`);
    }
  }

  async unmuteAllTabs(): Promise<void> {
    try {
      const tabs = await this.#chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id) {
          await this.unmuteTab(tab.id);
        }
      }
    } catch (error) {
      this.#logger.error(`Failed to unmute all tabs: ${error}`);
    }
  }

  async toggleTabMute(tabId: number): Promise<void> {
    if (!tabId) return;
    const tab = await this.#chrome.tabs.get(tabId);
    if (!tab?.mutedInfo) return;
    await this.#setMuteOnTab(tabId, !tab.mutedInfo.muted, true);
  }

  isTabMuted(tabId: number): boolean {
    return this.#mutedTabs.has(tabId);
  }

  async muteTab(tabId: number): Promise<void> {
    if (!tabId) return;
    await this.#setMuteOnTab(tabId, true, false);
  }

  async unmuteTab(tabId: number): Promise<void> {
    if (!tabId) return;
    await this.#setMuteOnTab(tabId, false, false);
  }
} 