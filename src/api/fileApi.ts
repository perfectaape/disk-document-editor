export interface IFileAPI {
  fetchFiles(oauthToken: string, path?: string): Promise<File[]>;
  deleteFile(path: string, oauthToken: string): Promise<{ success: boolean }>;
  fetchDocumentContent(
    path: string,
    oauthToken: string,
    signal?: AbortSignal
  ): Promise<string | undefined>;
  fetchFileMetadata(path: string, oauthToken: string): Promise<File>;
  saveDocumentContent(
    path: string,
    oauthToken: string,
    content: string
  ): Promise<void>;
  renameFile(
    fileId: string,
    newName: string,
    oauthToken: string
  ): Promise<{ success: boolean }>;
  moveFile(
    sourcePath: string,
    destinationPath: string,
    oauthToken: string
  ): Promise<{ success: boolean }>;
  createFolder(path: string, oauthToken: string): Promise<{ success: boolean }>; // Добавлен метод createFolder
}

export interface File {
  mimeType?: string;
  name: string;
  path: string;
  mime_type?: string;
  type: string;
  size?: number;
  created?: string;
  modified?: string;
  owner?: string;
  createdDate?: string;
  modifiedDate?: string;
  _embedded?: {
    items: File[];
  };
  children?: File[];
}

export interface FileMetadata {
  createdDate: string;
  modifiedDate: string;
  author: string;
  mimeType: string;
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
