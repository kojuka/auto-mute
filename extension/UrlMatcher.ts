import { Logger } from './types';

interface UrlParts {
  protocol?: string;
  username?: string;
  password?: string;
  host?: string;
  port?: string;
  path?: string;
  parameters?: string;
  hash?: string;
}

class UrlMatcher {
  #logger: Logger;

  constructor(logger: Logger) {
    this.#logger = logger;
  }

  stripProtocol(url: string): string {
    return url.replace(/^\w+:\/+/, "");
  }

  urlsMatch(a: string, b: string): boolean {
    return this.stripProtocol(a) === this.stripProtocol(b);
  }

  urlPatternMatch(pattern: string, url: string): boolean {
    // If the pattern is surrounded by '`' backticks, it's a regex
    const useRegex = pattern.startsWith("`") && pattern.endsWith("`");
    if (useRegex) {
      pattern = pattern.substring(1, pattern.length - 1);
    }

    let hostnameRegex = this.#getHostnameOf(pattern);
    let pathRegex = this.#getPathOf(pattern) || "/";
    let portRegex = this.#getPortOf(pattern) || "";
    const hostname = this.#getHostnameOf(url);
    const path = this.#getPathOf(url) || "/";
    const port = this.#getPortOf(url) || "";

    if (!useRegex) {
      hostnameRegex = this.#toRegex(hostnameRegex);
      pathRegex = this.#toRegex(pathRegex);
      portRegex = this.#toRegex(portRegex);
    }

    return (
      new RegExp(`^${hostnameRegex}$`).test(this.stripProtocol(hostname)) &&
      new RegExp(`^${pathRegex}$`).test(path) &&
      new RegExp(`^${portRegex}$`).test(port)
    );
  }

  isExactUrlInList(list: string[], url: string): boolean {
    return list.filter((_) => this.urlsMatch(_, url)).length > 0;
  }

  isDomainInList(list: string[], url: string): boolean {
    const domPattern = this.domainPattern(url);
    return (
      list.filter((listItem) => this.urlsMatch(listItem, domPattern)).length > 0
    );
  }

  domainPattern(url: string): string {
    return this.#getHostnameOf(url) + "/*";
  }

  #getUrlParts(url: string): UrlParts {
    const protoRx = "(?:(.+):\\/+)?";
    const userPassRx = "(?:([^:]+):?([^@]+)?@)?";
    const hostRx = "([^:\\/]+)";
    const portRx = "(?::([^\\/]+))?";
    const pathRx = "(\\/[^?]*)?";
    const paramRx = "(?:\\?([^#]+))?";
    const hashRx = "(?:#(.*))?";
    const urlRegEx = `${protoRx}${userPassRx}${hostRx}${portRx}${pathRx}${paramRx}${hashRx}`;
    const match = url.match(urlRegEx);
    if (!match) {
      this.#logger.log(`Failed to parse URL: ${url}`);
      return {};
    }

    return {
      protocol: match[1],
      username: match[2],
      password: match[3],
      host: match[4],
      port: match[5],
      path: match[6],
      parameters: match[7],
      hash: match[8],
    };
  }

  #getHostnameOf(url: string): string {
    return this.#getUrlParts(url)["host"] ?? "";
  }

  #getPathOf(url: string): string {
    return this.#getUrlParts(url)["path"] ?? "";
  }

  #getPortOf(url: string): string {
    return this.#getUrlParts(url)["port"] ?? "";
  }

  #toRegex(pattern: string): string {
    let regex = pattern.replace(/[-[\]{}()+?.,\\^$|#\s]/g, "\\$&");
    regex = regex.replace(/\*/g, "[^ ]*");
    return regex;
  }
}

export default UrlMatcher; 