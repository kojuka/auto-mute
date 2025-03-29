import ListInfo from "./ListInfo";
import { ExtensionOptions, ListExpert as IListExpert, ListInfo as IListInfo } from './types';

interface UrlMatcher {
  urlPatternMatch(pattern: string, url: string): boolean;
  isExactUrlInList(list: string[], url: string): boolean;
  isDomainInList(list: string[], domain: string): boolean;
  urlsMatch(url1: string, url2: string): boolean;
  domainPattern(url: string): string;
}

class ListExpert implements IListExpert {
  #extensionOptions: ExtensionOptions;
  #urlMatcher: UrlMatcher;

  constructor(extensionOptions: ExtensionOptions, urlMatcher: UrlMatcher) {
    this.#extensionOptions = extensionOptions;
    this.#urlMatcher = urlMatcher;
  }

  async isInList(list: string[], url: string): Promise<boolean> {
    if (!url) {
      return false;
    }

    const matches = list.filter((entry) => {
      return this.#urlMatcher.urlPatternMatch(entry, url);
    });
    return matches.length > 0;
  }

  async isExactMatchInList(url: string): Promise<boolean> {
    const listInfo = await this.getListInfo();
    return this.#urlMatcher.isExactUrlInList(listInfo.listOfPages, url);
  }

  async isDomainInList(url: string): Promise<boolean> {
    const listInfo = await this.getListInfo();
    return this.#urlMatcher.isDomainInList(listInfo.listOfPages, url);
  }

  async getListInfo(): Promise<IListInfo> {
    const usingAllowAudioList =
      await this.#extensionOptions.getUsingAllowAudioList();
    const list = await this.#extensionOptions.getAllowOrBlockAudioList();
    return new ListInfo(usingAllowAudioList, list);
  }

  async addOrRemoveUrlInList(url: string): Promise<boolean> {
    const listInfo = await this.getListInfo();
    const isInList = this.#urlMatcher.isExactUrlInList(
      listInfo.listOfPages,
      url
    );
    await this.#addOrRemoveEntryInList(listInfo, url, isInList);
    return !isInList;
  }

  async addOrRemoveDomainInList(url: string): Promise<boolean> {
    const listInfo = await this.getListInfo();
    const domainPattern = this.#urlMatcher.domainPattern(url);
    const isInList = this.#urlMatcher.isDomainInList(
      listInfo.listOfPages,
      domainPattern
    );
    await this.#addOrRemoveEntryInList(listInfo, domainPattern, isInList);
    return !isInList;
  }

  async #addOrRemoveEntryInList(
    listInfo: IListInfo,
    entry: string,
    isInList: boolean
  ): Promise<IListInfo> {
    if (isInList) {
      const newListInfo = new ListInfo(
        listInfo.isAllowedAudioList,
        listInfo.listOfPages.filter(
          (_) => !this.#urlMatcher.urlsMatch(_, entry)
        )
      );
      await this.#setList(newListInfo);
      return newListInfo;
    } else {
      const list = listInfo.listOfPages;
      list.push(entry);
      const newListInfo = new ListInfo(listInfo.isAllowedAudioList, list);
      await this.#setList(newListInfo);
      return newListInfo;
    }
  }

  async #setList(listInfo: IListInfo): Promise<void> {
    await this.#extensionOptions.setAllowOrBlockAudioList(listInfo.listOfPages);
  }
}

export default ListExpert; 