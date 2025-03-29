import { ChromeInstance } from './types';

interface SettingsInfo {
  initial?: {
    enabled?: boolean;
    allowOrBlockList?: string;
    usingAllowList?: boolean;
    iconTheme?: string;
  };
  current?: {
    enabled?: boolean;
    allowOrBlockList?: string;
    usingAllowList?: boolean;
    iconTheme?: string;
  };
}

(function (_chrome: ChromeInstance) {
  let initialEnabled: boolean | undefined;
  let initialList: string | undefined;
  let initialUsingAllowList: boolean | undefined;
  let initialIconTheme: string | undefined;

  function setControlsEnabled(enabled: boolean) {
    const elements = [
      "check-enabled",
      "radio-allow",
      "radio-block",
      "url-list",
      "save"
    ];
    elements.forEach(id => {
      const element = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement;
      if (element) {
        element.disabled = !enabled;
      }
    });
  }

  async function saveOptions() {
    setControlsEnabled(false);

    const enabled = (document.getElementById("check-enabled") as HTMLInputElement).checked;
    const list = (document.getElementById("url-list") as HTMLTextAreaElement)
      .value.split("\n")
      .map((line) => line.trim())
      .filter((line) => !!line)
      .join("\n");
    const usingAllowList = (document.getElementById("radio-allow") as HTMLInputElement).checked;
    const iconTheme = (document.querySelector('input[name="icon-theme"]:checked') as HTMLInputElement).value;

    await _chrome.storage.sync.set({
      enabled,
      allowOrBlockList: list,
      usingAllowList,
      iconTheme,
    });

    const statusElement = document.getElementById("status");
    if (statusElement) {
      statusElement.innerHTML = "Options saved.";
    }

    // We want to show the status for a bit before closing the options page
    setTimeout(function () {
      // Clear the status after 750ms
      if (statusElement) {
        statusElement.innerHTML = "";
      }

      // Re-enable the controls
      setControlsEnabled(true);

      // Close the options page
      window.close();
    }, 750);

    // Notify the background script of the changes
    await _chrome.runtime.sendMessage({
      command: "update-settings",
      data: {
        initial: {
          enabled: initialEnabled,
          allowOrBlockList: initialList,
          usingAllowList: initialUsingAllowList,
          iconTheme: initialIconTheme,
        },
        current: {
          enabled,
          allowOrBlockList: list,
          usingAllowList,
          iconTheme,
        },
      } as SettingsInfo,
    });
  }

  async function initializeOptions() {
    const items = await _chrome.storage.sync.get({
      enabled: true,
      allowOrBlockList: "",
      usingAllowList: true,
      iconTheme: "system",
    });

    initialEnabled = items.enabled;
    initialList = items.allowOrBlockList;
    initialUsingAllowList = items.usingAllowList;
    initialIconTheme = items.iconTheme;

    const elements = {
      "check-enabled": items.enabled,
      "url-list": items.allowOrBlockList,
      "radio-allow": items.usingAllowList,
      "radio-block": !items.usingAllowList,
      [`radio-${items.iconTheme}`]: true,
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement;
      if (element) {
        if (element instanceof HTMLInputElement) {
          element.checked = value as boolean;
        } else {
          element.value = value as string;
        }
      }
    });

    const allowDescription = document.getElementById("allow-description");
    const blockDescription = document.getElementById("block-description");
    if (allowDescription && blockDescription) {
      if (items.usingAllowList) {
        allowDescription.style.display = "block";
        blockDescription.style.display = "none";
      } else {
        allowDescription.style.display = "none";
        blockDescription.style.display = "block";
      }
    }

    setControlsEnabled(true);

    const radioAllow = document.getElementById("radio-allow") as HTMLInputElement;
    if (radioAllow) {
      radioAllow.addEventListener("change", () => {
        if (allowDescription && blockDescription) {
          allowDescription.style.display = "block";
          blockDescription.style.display = "none";
        }
      });
    }

    const radioBlock = document.getElementById("radio-block") as HTMLInputElement;
    if (radioBlock) {
      radioBlock.addEventListener("change", () => {
        if (allowDescription && blockDescription) {
          allowDescription.style.display = "none";
          blockDescription.style.display = "block";
        }
      });
    }

    const saveButton = document.getElementById("save") as HTMLButtonElement;
    if (saveButton) {
      saveButton.addEventListener("click", saveOptions);
    }
  }

  document.addEventListener("DOMContentLoaded", initializeOptions);
})(chrome as unknown as ChromeInstance); 