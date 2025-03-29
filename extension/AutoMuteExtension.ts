import { ChromeInstance, ExtensionOptions, Logger } from './types';
import { TabTracker } from './TabTracker';
import { IconSwitcher } from './IconSwitcher';

interface MessageData {
  scheme?: string;
  initial?: { enabled?: boolean; allowOrBlockList?: string; usingAllowList?: boolean };
  current?: { enabled?: boolean; allowOrBlockList?: string; usingAllowList?: boolean };
}

export class AutoMuteExtension {
  #chrome: ChromeInstance;
  #extensionOptions: ExtensionOptions;
  #tabTracker: TabTracker;
  #iconSwitcher: IconSwitcher;
  #logger: Logger;
  #lastUrls: Map<number, string>;

  constructor(
    chrome: ChromeInstance,
    extensionOptions: ExtensionOptions,
    tabTracker: TabTracker,
    iconSwitcher: IconSwitcher,
    logger: Logger
  ) {
    this.#chrome = chrome;
    this.#extensionOptions = extensionOptions;
    this.#tabTracker = tabTracker;
    this.#iconSwitcher = iconSwitcher;
    this.#logger = logger;
    this.#lastUrls = new Map();
  }

  async start(): Promise<void> {
    try {
      // Set up tab event listeners
      this.#chrome.tabs.onCreated.addListener((tab: chrome.tabs.Tab) => {
        this.#logger.log(`Tab created: ${tab.id}`);
        this.#tabTracker.handleTabCreated(tab);
      });

      this.#chrome.tabs.onReplaced.addListener((addedTabId: number, removedTabId: number) => {
        this.#logger.log(`Tab replaced: ${removedTabId} -> ${addedTabId}`);
        this.#tabTracker.onTabReplaced(addedTabId, removedTabId);
      });

      this.#chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (changeInfo.url) {
          this.#logger.log(`Tab ${tabId} URL updated: ${changeInfo.url}`);
          this.#lastUrls.set(tabId, changeInfo.url);
          this.#tabTracker.handleTabUpdated(tabId, changeInfo.url);
          this.#iconSwitcher.updateIcon(tabId, this.#tabTracker.isTabMuted(tabId));
        }
      });

      this.#chrome.tabs.onActivated.addListener((activeInfo: chrome.tabs.TabActiveInfo) => {
        this.#logger.log(`Tab activated: ${activeInfo.tabId}`);
        this.#tabTracker.handleTabActivated(activeInfo.tabId);
        this.#iconSwitcher.updateIcon(activeInfo.tabId, this.#tabTracker.isTabMuted(activeInfo.tabId));
      });

      this.#chrome.windows.onFocusChanged.addListener((windowId: number) => {
        this.#logger.log(`Window focus changed: ${windowId}`);
        this.#tabTracker.handleWindowFocusChanged(windowId);
      });

      // Set up command listener
      this.#chrome.commands.onCommand.addListener((command: string) => {
        this.#logger.log(`Command received: ${command}`);
        this.#handleCommand(command);
      });

      // Set up message listener
      this.#chrome.runtime.onMessage.addListener((request: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => {
        return this.#handleMessage(request, sender, sendResponse);
      });

      // Initial mute all tabs
      await this.#tabTracker.muteAllTabs();
    } catch (error) {
      this.#logger.error(`Failed to start extension: ${error}`);
    }
  }

  #handleMessage(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void): boolean {
    switch (request.command) {
      case 'mute-tab':
        this.#tabTracker.toggleMuteOnCurrentTabByUserRequest();
        return false;

      case 'mute-all':
        this.#tabTracker.muteAllTabs();
        return false;

      case 'mute-other':
        this.#tabTracker.muteOtherTabsByUserRequest();
        return false;

      case 'list-page':
        this.#tabTracker.addOrRemoveCurrentPageInList();
        return false;

      case 'list-domain':
        this.#tabTracker.addOrRemoveCurrentDomainInList();
        return false;

      case 'query-current-muted':
        this.#tabTracker.isCurrentTabMuted().then(muted => {
          sendResponse({ muted });
        });
        return true;

      case 'query-using-should-allow-list':
        this.#extensionOptions.getUsingAllowAudioList().then(usingAllowAudioList => {
          sendResponse({ usingAllowAudioList });
        });
        return true;

      case 'query-page-listed':
        this.#tabTracker.isCurrentTabInList().then(listed => {
          sendResponse({ listed });
        });
        return true;

      case 'query-domain-listed':
        this.#tabTracker.isDomainOfCurrentTabInList().then(listed => {
          sendResponse({ listed });
        });
        return true;

      case 'queryMutedState':
        if (sender.tab?.id) {
          sendResponse({ isMuted: this.#tabTracker.isTabMuted(sender.tab.id) });
        }
        return false;

      case 'isCurrentTabListed':
        if (sender.tab?.id) {
          const url = this.#lastUrls.get(sender.tab.id);
          if (url) {
            this.#extensionOptions.getAllowOrBlockAudioList().then(list => {
              sendResponse({ isListed: list.includes(url) });
            });
            return true;
          }
        }
        sendResponse({ isListed: false });
        return false;

      case 'updateSettings':
        this.#extensionOptions.getEnabled().then(enabled => {
          if (enabled) {
            this.#tabTracker.muteAllTabs();
          } else {
            this.#tabTracker.unmuteAllTabs();
          }
        });
        return false;
    }
    return false;
  }

  async #handleCommand(command: string): Promise<void> {
    try {
      switch (command) {
        case 'applyMute':
          await this.#tabTracker.muteAllTabs();
          break;

        case 'muteAllTabs':
          await this.#tabTracker.muteAllTabs();
          break;

        case 'toggleMuteCurrentTab':
          const [currentTab] = await this.#chrome.tabs.query({ active: true, currentWindow: true });
          if (currentTab?.id) {
            await this.#tabTracker.toggleTabMute(currentTab.id);
          }
          break;
      }
    } catch (error) {
      this.#logger.error(`Failed to handle command ${command}: ${error}`);
    }
  }
} 