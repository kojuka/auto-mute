import { ListInfo as IListInfo } from './types';

class ListInfo implements IListInfo {
  #isAllowedAudioList: boolean;
  #listOfPages: string[];

  constructor(isAllowedAudioList: boolean, listOfPages: string[]) {
    this.#isAllowedAudioList = isAllowedAudioList;
    this.#listOfPages = listOfPages;
  }

  get isAllowedAudioList(): boolean {
    return this.#isAllowedAudioList;
  }

  get listOfPages(): string[] {
    return this.#listOfPages;
  }
}

export default ListInfo; 