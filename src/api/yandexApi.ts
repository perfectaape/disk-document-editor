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
      const response: AxiosResponse<{ _embedded: { items: File[] } }> =
        await this.apiClient.get("/resources", {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
          params: {
            path: path,
            limit: 1000,
          },
        });

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

  async createFolder(
    path: string,
    oauthToken: string
  ): Promise<{ success: boolean }> {
    try {
      const normalizedPath = path.startsWith("disk:/") ? path : `disk:/${path}`;
      const response: AxiosResponse = await this.apiClient.put(
        "/resources",
        null,
        {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
          params: {
            path: normalizedPath, // Используем нормализованный путь
          },
        }
      );

      return { success: response.status === 201 };
    } catch (error) {
      console.error("Ошибка при создании папки:", error);
      return { success: false };
    }
  }

  async deleteFile(
    path: string,
    oauthToken: string
  ): Promise<{ success: boolean }> {
    try {
      const response: AxiosResponse = await this.apiClient.delete(
        "/resources",
        {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
          params: {
            path: path,
          },
        }
      );

      return { success: response.status === 204 };
    } catch (error) {
      console.error("Ошибка при удалении файла:", error);
      return { success: false };
    }
  }

  async fetchFileMetadata(path: string, oauthToken: string): Promise<File> {
    try {
      const response = await this.apiClient.get("/resources", {
        headers: {
          Authorization: `OAuth ${oauthToken}`,
        },
        params: {
          path: path,
        },
      });

      const data = response.data;
      return {
        name: data.name,
        path: data.path,
        type: data.type,
        mime_type: data.mime_type,
        size: data.size,
        created: data.custom_properties?.original_created || data.created,
        modified: data.modified,
        createdDate: data.custom_properties?.original_created || data.created,
        modifiedDate: data.modified,
      };
    } catch (error) {
      console.error("Ошибка при получении метаданных файла:", error);
      throw error;
    }
  }

  async saveDocumentContent(
    path: string,
    oauthToken: string,
    content: string
  ): Promise<void> {
    try {
      const fileMetadata = await this.fetchFileMetadata(path, oauthToken);
      const createdDate = fileMetadata.created || fileMetadata.createdDate;

      const uploadLinkResponse = await this.apiClient.get("/resources/upload", {
        headers: {
          Authorization: `OAuth ${oauthToken}`,
        },
        params: {
          path: path,
          overwrite: true,
        },
      });

      await axios.put(uploadLinkResponse.data.href, content, {
        headers: {
          "Content-Type": "text/plain",
        },
      });

      await this.apiClient.patch(
        "/resources",
        {},
        {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
          params: {
            path: path,
            custom_properties: {
              original_created: createdDate,
            },
          },
        }
      );
    } catch (error) {
      console.error("Ошибка при сохранении документа:", error);
      throw error;
    }
  }

  async renameFile(
    fileId: string,
    newName: string,
    oauthToken: string
  ): Promise<{ success: boolean }> {
    try {
      const response: AxiosResponse = await this.apiClient.post(
        "/resources/move",
        null,
        {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
          params: {
            from: fileId,
            path: newName,
            overwrite: false,
          },
        }
      );

      if (response.status === 202 && response.data.href) {
        await this.waitForOperation(response.data.href, oauthToken);
      }

      return { success: true };
    } catch (error) {
      console.error("Ошибка при переименовании файла:", error);
      return { success: false };
    }
  }

  async moveFile(
    sourcePath: string,
    destinationPath: string,
    oauthToken: string
  ): Promise<{ success: boolean }> {
    try {
      const fileName = sourcePath.split("/").pop();
      if (!fileName) {
        console.error("Invalid file name");
        return { success: false };
      }

      const finalPath = destinationPath
        ? `${destinationPath}/${fileName}`
        : fileName;

      const response: AxiosResponse = await this.apiClient.post(
        "/resources/move",
        null,
        {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
          params: {
            from: sourcePath,
            path: finalPath,
            overwrite: false,
          },
        }
      );

      if (response.status === 202 && response.data.href) {
        await this.waitForOperation(response.data.href, oauthToken);
      }

      return { success: true };
    } catch (error) {
      console.error("Error moving file:", error);
      return { success: false };
    }
  }

  async fetchDocumentContent(
    path: string,
    oauthToken: string,
    signal?: AbortSignal
  ): Promise<string | undefined> {
    try {
      const response: AxiosResponse<{ href: string }> =
        await this.apiClient.get(
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
        return decoder.decode(fileResponse.data);
      }
    } catch (error) {
      console.error("Ошибка при получении содержимого документа:", error);
    }
    return undefined;
  }

  private async waitForOperation(
    operationHref: string,
    oauthToken: string,
    maxAttempts: number = 20,
    delay: number = 500
  ): Promise<void> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response: AxiosResponse<{ status: string }> = await axios.get(
          operationHref,
          {
            headers: {
              Authorization: `OAuth ${oauthToken}`,
            },
          }
        );

        if (response.data.status === "success") {
          return;
        } else if (response.data.status === "failed") {
          throw new Error("Операция завершилась с ошибкой");
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
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

  async createFile(
    path: string,
    oauthToken: string,
    content: string = ""
  ): Promise<{ success: boolean }> {
    try {
      const normalizedPath = path.startsWith("disk:/") ? path : `disk:/${path}`;
      const uploadLinkResponse: AxiosResponse<{ href: string }> =
        await this.apiClient.get("/resources/upload", {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
          params: {
            path: normalizedPath,
            overwrite: true,
          },
        });

      await axios.put(uploadLinkResponse.data.href, content, {
        headers: {
          "Content-Type": "text/plain",
        },
      });

      return { success: true };
    } catch (error) {
      console.error("Ошибка при создании файла:", error);
      return { success: false };
    }
  }
}
