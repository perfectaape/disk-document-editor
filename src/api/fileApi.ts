export interface IFileAPI {
  fetchFiles(oauthToken: string, path?: string): Promise<File[]>;
  fetchDocumentContent(
    path: string,
    oauthToken: string,
    signal?: AbortSignal
  ): Promise<string | undefined>;
  saveDocumentContent(
    path: string,
    oauthToken: string,
    content: string
  ): Promise<void>;
  deleteFile(path: string, oauthToken: string): Promise<void>;
}

export interface File {
  name: string;
  path: string;
  mime_type: string;
  type: string;
  _embedded?: {
    items: File[];
  };
  children?: File[];
}

export function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : undefined;
}

import { YandexApi } from "./yandexApi";
import { GoogleApi } from "./googleApi";

export type Service = "yandex" | "google";

export class CloudServiceFactory {
  static create(service: Service): IFileAPI {
    switch (service) {
      case "yandex":
        return new YandexApi();
      case "google":
        return new GoogleApi();
      default:
        throw new Error("Unsupported service");
    }
  }
}
