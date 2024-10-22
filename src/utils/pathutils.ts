import { Service } from "../api/fileApi";

export class PathUtils {
  static getRootPath(service: Service): string {
    return service === "yandex" ? "disk:/" : "root";
  }

  static goBackOneLevel(currentPath: string, service: Service): string {
    const pathSegments = currentPath.split("/").filter((segment) => segment);

    if (service === "yandex") {
      if (pathSegments[0] === "disk:") {
        pathSegments.shift();
      }
    }

    if (pathSegments.length > 0) {
      pathSegments.pop();
    }

    if (service === "yandex") {
      return pathSegments.length > 0
        ? "disk:/" + pathSegments.join("/")
        : "disk:/";
    } else {
      return pathSegments.length > 0 ? pathSegments.join("/") : "root";
    }
  }

  static formatPathForDisplay(
    currentPath: string,
    service: Service,
    idToNameMap: Record<string, string>
  ): string {
    if (service === "yandex") {
      return currentPath.replace(/^disk:\//, "/");
    } else {
      if (currentPath === "root") {
        return "/";
      }
      const pathSegments = currentPath.split("/");
      return pathSegments
        .map((segment) => idToNameMap[segment] || segment)
        .join("/");
    }
  }
}
