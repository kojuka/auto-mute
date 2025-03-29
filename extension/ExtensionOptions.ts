import { ChromeInstance, ExtensionOptions as IExtensionOptions } from './types';

class ExtensionOptions implements IExtensionOptions {
  #chrome: ChromeInstance;

  constructor(chromeInstance: ChromeInstance) {
    this.#chrome = chromeInstance;
  }

  async getEnabled(): Promise<boolean> {
    return (await this.#chrome.storage.sync.get({ enabled: true })).enabled;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await this.#chrome.storage.sync.set({ enabled });
  }

  async getUsingAllowAudioList(): Promise<boolean> {
    return (await this.#chrome.storage.sync.get({ usingAllowList: true }))
      .usingAllowList;
  }

  async getAllowOrBlockAudioList(): Promise<string[]> {
    return this.#stringToListOfStrings(
      (await this.#chrome.storage.sync.get({ allowOrBlockList: "" }))
        .allowOrBlockList
    );
  }

  async setAllowOrBlockAudioList(list: string[]): Promise<void> {
    await this.#chrome.storage.sync.set({
      allowOrBlockList: this.#listOfStringsToString(list),
    });
  }

  async switchListType(): Promise<void> {
    const usingAllowAudioList = await this.getUsingAllowAudioList();
    await this.#chrome.storage.sync.set({
      usingAllowList: !usingAllowAudioList,
    });
  }

  #stringToListOfStrings(list: string): string[] {
    return this.#cleanList(list.split("\n"));
  }

  #cleanList(list: string[]): string[] {
    return list.map((_) => _.trim()).filter((_) => !!_);
  }

  #listOfStringsToString(list: string[]): string {
    return this.#cleanList(list).join("\n");
  }
}

export default ExtensionOptions; 