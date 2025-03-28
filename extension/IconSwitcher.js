class IconSwitcher {
  /** @member {Object} */
  #chrome;
  /** @member {TabTracker} */
  #tabTracker;
  /** @member {Object} */
  #logger;
  /** @member {'dark' | 'light' | 'unset'} */
  #systemColorScheme;

  /**
   * @param {Object} chromeInstance
   * @param {TabTracker} tabTracker
   * @param {Object} logger
   */
  constructor(chromeInstance, tabTracker, logger) {
    this.#chrome = chromeInstance;
    this.#tabTracker = tabTracker;
    this.#logger = logger;
    this.#systemColorScheme = "dark";
    this.#setSystemColorScheme("dark");
  }

  /**
   * @returns {Promise<void>}
   */
  async start() {
    if (!(await this.#chrome.offscreen.hasDocument())) {
      this.#logger.log("Creating offscreen document");
      await this.#chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["MATCH_MEDIA"],
        justification: "Detect system color scheme",
      });
    }
  }

  /**
   * @param {'dark' | 'light'} scheme
   * @returns {Promise<void>}
   */
  async setSystemColorScheme(scheme) {
    this.#logger.log(`System color scheme changed to ${scheme}`);
    await this.#setSystemColorScheme(scheme);
    await this.updateIcon();
    return scheme;
  }

  /**
   * @param {'dark' | 'light'} scheme
   * @returns {Promise<void>}
   */
  async #setSystemColorScheme(scheme) {
    // We need to set the system color scheme in the storage to persist it
    // because the service worker is not always running, so in-memory state
    // will sometimes be lost.
    await this.#chrome.storage.local.set({
      systemColorScheme: scheme,
    });
    this.#systemColorScheme = scheme;
  }

  /**
   * @returns {Promise<'dark' | 'light' | 'unset'>}
   */
  async #getSystemColorScheme() {
    // If the system color scheme is unset, we need to fetch it from storage
    // because the service worker is not always running, so in-memory state
    // will sometimes be lost.
    if (this.#systemColorScheme === "unset") {
      this.#logger.log("Fetching system color scheme from storage");
      this.#systemColorScheme = (
        await this.#chrome.storage.local.get({
          systemColorScheme: "unset",
        })
      ).systemColorScheme;
      this.#logger.log(
        `System color scheme fetched from storage: ${this.#systemColorScheme}`
      );
    }
    return this.#systemColorScheme || "unset";
  }

  /**
   * @returns {Promise<void>}
   */
  async updateIcon() {
    const onOrOff = (await this.#tabTracker.isCurrentTabMutedByExtension())
      ? "off"
      : "on";

    // Get the user's icon theme preference
    const { iconTheme = "system" } = await this.#chrome.storage.sync.get({ iconTheme: "system" });
    
    // If user has chosen a specific theme, use it
    let theme = iconTheme;
    if (theme === "system") {
      theme = await this.#getSystemColorScheme();
      if (theme === "unset") {
        theme = "light";  // Default to light if system theme is unset
      }
    }

    const path = `images/${theme}_${onOrOff}_16.png`;
    this.#logger.log(`Setting icon to ${path}`);
    await this.#chrome.action.setIcon({
      path,
    });
  }
}

export default IconSwitcher;
