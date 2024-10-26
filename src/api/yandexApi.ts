import axios, { AxiosInstance, AxiosResponse } from "axios";
import { IFileAPI, File } from "./fileApi";

export class YandexApi implements IFileAPI {
  private apiClient: AxiosInstance;

  constructor() {
    this.apiClient = axios.create({
      baseURL: "https://cloud-api.yandex.net/v1/disk",
    });
  }

  async fetchFiles(oauthToken: string, path: string = "/"): Promise<File[]> {
    try {
      const response: AxiosResponse<File> = await this.apiClient.get(
        "/resources",
        {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
          params: {
            path: path,
            limit: 1000,
          },
        }
      );

      if (
        response.data &&
        response.data._embedded &&
        response.data._embedded.items
      ) {
        const items = response.data._embedded.items;

        // Рекурсивно загружаем содержимое для каждой папки
        const filesWithChildren = await Promise.all(
          items.map(async (item: File) => {
            if (item.type === "dir") {
              const children = await this.fetchFiles(oauthToken, item.path);
              return { ...item, children };
            }
            return item;
          })
        );

        return filesWithChildren;
      } else {
        console.error("Нет данных о файлах в ответе");
        return [];
      }
    } catch (error) {
      console.error("Ошибка при получении файлов:", error);
      return [];
    }
  }

  async fetchDocumentContent(
    path: string,
    oauthToken: string,
    signal?: AbortSignal
  ): Promise<string | undefined> {
    // Указываем, что функция может вернуть undefined
    try {
      const response = await this.apiClient.get(
        `/resources/download?path=${encodeURIComponent(path)}`,
        {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
          maxRedirects: 0,
          signal, // Используем AbortSignal здесь
        }
      );

      if (response.status === 200 && response.data.href) {
        const fileResponse = await axios.get(response.data.href, {
          responseType: "arraybuffer",
          signal, // Используем AbortSignal здесь
        });

        const decoder = new TextDecoder("utf-8");
        const textContent = decoder.decode(fileResponse.data);
        return textContent;
      } else {
        throw new Error("Не удалось получить ссылку для скачивания");
      }
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log("Запрос был отменен");
      } else {
        console.error("Ошибка при загрузке документа:", error);
      }
      return undefined; // Возвращаем undefined в случае ошибки
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async fetchFileMetadata(path: string, oauthToken: string): Promise<any> {
    try {
      const response = await this.apiClient.get(`/resources`, {
        headers: {
          Authorization: `OAuth ${oauthToken}`,
        },
        params: {
          path: path,
          fields: "name, mime_type, created, modified",
        },
      });

      return response.data;
    } catch (error) {
      console.error("Error fetching file metadata from Yandex Disk:", error);
      throw error;
    }
  }

  async saveDocumentContent(
    path: string,
    oauthToken: string,
    content: string
  ): Promise<void> {
    try {
      // Получаем URL для загрузки
      const uploadLinkResponse = await this.apiClient.get(
        `/resources/upload?path=${encodeURIComponent(path)}&overwrite=true`,
        {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
        }
      );

      if (uploadLinkResponse.status === 200 && uploadLinkResponse.data.href) {
        // Загружаем содержимое файла
        await axios.put(uploadLinkResponse.data.href, content, {
          headers: {
            "Content-Type": "text/plain",
          },
        });
      } else {
        throw new Error("Не удалось получить ссылку для загрузки");
      }
    } catch (error) {
      console.error("Ошибка при сохранении содержимого документа:", error);
      throw error;
    }
  }
  async deleteFile(path: string, oauthToken: string): Promise<void> {
    try {
      await this.apiClient.delete(`/resources`, {
        headers: {
          Authorization: `OAuth ${oauthToken}`,
        },
        params: {
          path: path,
        },
      });
      console.log(`File at path ${path} deleted successfully.`);
    } catch (error) {
      console.error("Ошибка при удалении файла:", error);
      throw error;
    }
  }
}
