/// <reference types="chrome"/>

export interface ListInfo {
  listOfPages: string[];
  isAllowedAudioList: boolean;
}

export interface ExtensionOptions {
  getEnabled(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
  getUsingAllowAudioList(): Promise<boolean>;
  getAllowOrBlockAudioList(): Promise<string[]>;
  setAllowOrBlockAudioList(list: string[]): Promise<void>;
  switchListType(): Promise<void>;
}

export interface Logger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface ChromeInstance {
  runtime: {
    id: string;
    lastError: { message: string };
    onMessage: chrome.events.Event<(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => boolean | void>;
    sendMessage: (message: any) => Promise<any>;
  };
  tabs: {
    query: (queryInfo: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>;
    get: (tabId: number) => Promise<chrome.tabs.Tab>;
    update: (tabId: number, updateProperties: chrome.tabs.UpdateProperties) => Promise<chrome.tabs.Tab>;
    create: (createProperties: chrome.tabs.CreateProperties) => Promise<chrome.tabs.Tab>;
    onCreated: chrome.events.Event<(tab: chrome.tabs.Tab) => void>;
    onReplaced: chrome.events.Event<(addedTabId: number, removedTabId: number) => void>;
    onUpdated: chrome.events.Event<(tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => void>;
    onActivated: chrome.events.Event<(activeInfo: chrome.tabs.TabActiveInfo) => void>;
  };
  windows: {
    onFocusChanged: chrome.events.Event<(windowId: number) => void>;
  };
  commands: {
    onCommand: chrome.events.Event<(command: string) => void>;
  };
  storage: {
    sync: {
      get(keys: { [key: string]: any } | string): Promise<{ [key: string]: any }>;
      set(items: { [key: string]: any }): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
      getKeys(): Promise<string[]>;
    };
  };
  notifications: {
    create(notificationId: string, options: chrome.notifications.NotificationOptions): Promise<string>;
  };
  action: {
    setIcon: (details: { path: string; tabId?: number }) => Promise<void>;
  };
}

export type Tab = chrome.tabs.Tab;

export interface ListExpert {
  getListInfo(): Promise<ListInfo>;
  isInList(list: string[], url: string): Promise<boolean>;
  isDomainInList(url: string): Promise<boolean>;
  isExactMatchInList(url: string): Promise<boolean>;
  addOrRemoveUrlInList(url: string): Promise<boolean>;
  addOrRemoveDomainInList(url: string): Promise<boolean>;
} 