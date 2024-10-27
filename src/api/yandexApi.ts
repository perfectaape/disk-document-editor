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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response: AxiosResponse<any> = await this.apiClient.get(
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
    try {
      const response = await this.apiClient.get(
        `/resources/download?path=${encodeURIComponent(path)}`,
        {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
          maxRedirects: 0,
          signal,
        }
      );

      if (response.status === 200 && response.data.href) {
        const fileResponse = await axios.get(response.data.href, {
          responseType: "arraybuffer",
          signal,
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
      return undefined;
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
      const uploadLinkResponse = await this.apiClient.get(
        `/resources/upload?path=${encodeURIComponent(path)}&overwrite=true`,
        {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
        }
      );

      if (uploadLinkResponse.status === 200 && uploadLinkResponse.data.href) {
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
      return { success: response.status === 204 };
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

      if (copyResponse.status === 202 && copyResponse.data.href) {
        await this.waitForOperation(copyResponse.data.href, oauthToken);
      } else if (copyResponse.status !== 201) {
        throw new Error("Не удалось скопировать файл или папку");
      }

      const deleteResponse = await this.apiClient.delete(
        `/resources?path=${encodeURIComponent(oldPath)}`,
        {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
        }
      );

      if (deleteResponse.status === 202 && deleteResponse.data.href) {
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

  async moveFile(
    sourcePath: string,
    destinationPath: string,
    oauthToken: string
  ): Promise<{ success: boolean }> {
    try {
      const fileName = sourcePath.split("/").pop();
      if (!fileName) {
        return { success: false };
      }

      const finalPath = destinationPath
        ? `${destinationPath}/${fileName}`
        : fileName;

      const response = await this.apiClient.post("/resources/move", null, {
        headers: {
          Authorization: `OAuth ${oauthToken}`,
        },
        params: {
          from: sourcePath,
          path: finalPath,
          overwrite: false,
        },
      });

      if (response.status === 202 && response.data.href) {
        await this.waitForOperation(response.data.href, oauthToken);
      }

      return { success: true };
    } catch (error) {
      console.error("Error moving file:", error);
      return { success: false };
    }
  }
}
