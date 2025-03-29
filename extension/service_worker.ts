import NotificationsExpert from "./NotificationsExpert";
import ExtensionOptions from "./ExtensionOptions";
import ListExpert from "./ListExpert";
import UrlMatcher from "./UrlMatcher";
import { TabTracker } from "./TabTracker";
import { AutoMuteExtension } from "./AutoMuteExtension";
import UpgradeCoordinator from "./UpgradeCoordinator";
import { IconSwitcher } from "./IconSwitcher";
import { ChromeInstance, Logger } from "./types";

(function (_chrome: ChromeInstance, _console: Logger) {
  new UpgradeCoordinator(_chrome, _console).upgrade().then(() => {
    const extensionOptions = new ExtensionOptions(_chrome);
    const urlMatcher = new UrlMatcher(_console);
    const listExpert = new ListExpert(extensionOptions, urlMatcher);

    const tabTracker = new TabTracker(
      _chrome,
      extensionOptions,
      listExpert,
      _console
    );

    const iconSwitcher = new IconSwitcher(_chrome, _console);

    const extension = new AutoMuteExtension(
      _chrome,
      extensionOptions,
      tabTracker,
      iconSwitcher,
      _console
    );

    extension.start().then(async () => {
      const notificationsExpert = new NotificationsExpert(_chrome);
      notificationsExpert.start();
    });
  });
})(chrome as unknown as ChromeInstance, console as Logger); 