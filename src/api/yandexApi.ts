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
  async deleteFile(
    filePath: string,
    oauthToken: string
  ): Promise<{ success: boolean }> {
    try {
      const response = await axios.delete(
        `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(
          filePath
        )}`,
        {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
        }
      );
      // Assuming a successful response means the file was deleted
      return { success: response.status === 204 }; // 204 No Content indicates success
    } catch (error) {
      console.error("Ошибка при удалении файла:", error);
      return { success: false };
    }
  }

  async renameFile(
    oldPath: string,
    newPath: string,
    oauthToken: string
  ): Promise<{ success: boolean }> {
    try {
      // Шаг 1: Копируем файл или папку
      const copyResponse = await this.apiClient.post(
        `/resources/copy?from=${encodeURIComponent(
          oldPath
        )}&path=${encodeURIComponent(newPath)}`,
        null,
        {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
        }
      );

      // Проверяем, получили ли мы ссылку на операцию
      if (copyResponse.status === 202 && copyResponse.data.href) {
        // Ждем завершения операции копирования
        await this.waitForOperation(copyResponse.data.href, oauthToken);
      } else if (copyResponse.status !== 201) {
        throw new Error("Не удалось скопировать файл или папку");
      }

      // Шаг 2: Удаляем оригинал
      const deleteResponse = await this.apiClient.delete(
        `/resources?path=${encodeURIComponent(oldPath)}`,
        {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
        }
      );

      // Проверяем, получили ли мы ссылку на операцию удаления
      if (deleteResponse.status === 202 && deleteResponse.data.href) {
        // Ждем завершения операции удаления
        await this.waitForOperation(deleteResponse.data.href, oauthToken);
      } else if (deleteResponse.status !== 204) {
        throw new Error("Не удалось удалить оригинальный файл или папку");
      }

      return { success: true };
    } catch (error) {
      console.error("Ошибка при переименовании:", error);
      return { success: false };
    }
  }

  // Добавляем новый метод для ожидания завершения операции
  private async waitForOperation(
    operationHref: string,
    oauthToken: string,
    maxAttempts: number = 10
  ): Promise<void> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(operationHref, {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
        });

        if (response.data.status === "success") {
          return;
        } else if (response.data.status === "failed") {
          throw new Error("Операция завершилась с ошибкой");
        }

        // Ждем 1 секунду перед следующей проверкой
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
      } catch (error) {
        console.error("Ошибка при проверке статуса операции:", error);
        throw error;
      }
    }

    throw new Error(
      "Превышено максимальное количество попыток проверки статуса операции"
    );
  }
}
