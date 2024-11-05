import axios, { AxiosInstance, AxiosResponse } from "axios";
import { IFileAPI, File } from "./fileApi";

export const yandexConfig = {
  clientId: import.meta.env.VITE_YANDEX_CLIENT_ID,
  scope: "cloud_api:disk.app_folder",
};

export class YandexApi implements IFileAPI {
  private apiClient: AxiosInstance;

  constructor() {
    this.apiClient = axios.create({
      baseURL: "https://cloud-api.yandex.net/v1/disk",
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  private ensureAppPath(path: string): string {
    const cleanPath = path
      .replace(/^(disk:|app:)\//, "")
      .replace(/^Приложения\/Тестовое-Диск\//, "")
      .replace(/disk:\/Приложения\/Тестовое-Диск\//g, "")
      .replace(/^\/+/, "")
      .trim();

    return cleanPath ? `app:/${cleanPath}` : "app:/";
  }

  async fetchFiles(
    oauthToken: string,
    path: string = "app:/"
  ): Promise<File[]> {
    try {
      const cleanPath = path === "app:/" ? path : this.ensureAppPath(path);

      const response = await this.apiClient.get("/resources", {
        headers: {
          Authorization: `OAuth ${oauthToken}`,
        },
        params: {
          path: cleanPath,
          limit: 100,
        },
      });

      const items = response.data._embedded?.items || [];

      const processedItems = await Promise.all(
        items.map(async (item: File) => {
          const processedItem: File = {
            name: item.name,
            path: item.path,
            type: item.type,
            mime_type: item.mime_type,
            children: [],
          };

          if (item.type === "dir") {
            processedItem.children = await this.fetchFiles(
              oauthToken,
              item.path
            );
          }

          return processedItem;
        })
      );

      return processedItems;
    } catch (error) {
      console.error("Error fetching files:", error);
      return [];
    }
  }

  async fetchFolderContents(
    oauthToken: string,
    folderPath: string
  ): Promise<File[]> {
    try {
      return await this.fetchFiles(oauthToken, folderPath);
    } catch (error) {
      console.error(`Error fetching folder contents for ${folderPath}:`, error);
      return [];
    }
  }

  async createFolder(
    path: string,
    oauthToken: string
  ): Promise<{ success: boolean }> {
    try {
      const cleanPath = this.ensureAppPath(path);
      const response = await this.apiClient.put("/resources", null, {
        headers: {
          Authorization: `OAuth ${oauthToken}`,
        },
        params: {
          path: cleanPath,
          type: "dir",
        },
      });

      return { success: response.status === 201 };
    } catch (error) {
      console.error("Error creating folder:", error);
      return { success: false };
    }
  }

  async createFile(
    path: string,
    oauthToken: string
  ): Promise<{ success: boolean }> {
    try {
      const cleanPath = this.ensureAppPath(path);
      const finalPath = cleanPath.endsWith(".txt")
        ? cleanPath
        : `${cleanPath}.txt`;

      const uploadUrlResponse = await this.apiClient.get("/resources/upload", {
        headers: {
          Authorization: `OAuth ${oauthToken}`,
        },
        params: {
          path: encodeURIComponent(finalPath),
          overwrite: true,
        },
      });

      const uploadUrl = uploadUrlResponse.data.href;
      if (uploadUrl) {
        await axios.put(uploadUrl, "", {
          headers: {
            "Content-Type": "text/plain",
          },
        });
        return { success: true };
      }

      return { success: false };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Неизвестная ошибка");
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
            path: this.ensureAppPath(path),
          },
        }
      );

      return { success: response.status === 204 };
    } catch (error) {
      console.error("Error deleting file:", error);
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
          path: this.ensureAppPath(path),
        },
        paramsSerializer: (params) => {
          const searchParams = new URLSearchParams();
          for (const key in params) {
            searchParams.append(key, params[key]);
          }
          return searchParams.toString();
        },
      });

      const data = response.data;
      return {
        name: data.name,
        path: this.ensureAppPath(data.path),
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
          path: this.ensureAppPath(path),
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
            path: this.ensureAppPath(path),
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

  async moveFile(
    sourcePath: string,
    destinationPath: string,
    oauthToken: string
  ): Promise<{ success: boolean }> {
    try {
      const cleanSourcePath = sourcePath
        .replace(/^(disk:|app:)\//, "")
        .replace(/^Приложения\/Тестовое-Диск\//, "")
        .replace(/^\/+/, "")
        .trim();

      const cleanDestPath = destinationPath
        .replace(/^(disk:|app:)\//, "")
        .replace(/^Приложения\/Тестовое-Диск\//, "")
        .replace(/^\/+/, "")
        .trim();

      const fileName = cleanSourcePath.split("/").pop();

      const fromPath = `app:/${cleanSourcePath}`;
      const toPath = cleanDestPath
        ? `app:/${cleanDestPath}/${fileName}`
        : `app:/${fileName}`;

      const response: AxiosResponse = await this.apiClient.post(
        "/resources/move",
        undefined,
        {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
          params: {
            from: fromPath,
            path: toPath,
            overwrite: false,
          },
        }
      );

      if (response.status === 202 && response.data.href) {
        await this.waitForOperation(response.data.href, oauthToken);
      }

      return { success: true };
    } catch (error) {
      console.error("Ошибка при перемещении файла:", error);
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
          `/resources/download?path=${encodeURIComponent(
            this.ensureAppPath(path)
          )}`,
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
      console.error("Ошибка при получении содежимого доумента:", error);
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
      "Превышено максимальное количество попыток провеки статуса операции"
    );
  }

  async renameFile(
    oldPath: string,
    newName: string,
    oauthToken: string
  ): Promise<{ success: boolean }> {
    try {
      const cleanOldPath = this.ensureAppPath(oldPath);
      const parentPath = cleanOldPath.split('/').slice(0, -1).join('/');
      const newPath = parentPath ? `${parentPath}/${newName}` : `app:/${newName}`;

      const response: AxiosResponse = await this.apiClient.post(
        "/resources/move",
        undefined,
        {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
          params: {
            from: cleanOldPath,
            path: newPath,
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

  async createResource(
    path: string,
    oauthToken: string,
    type: "file" | "dir"
  ): Promise<{ success: boolean }> {
    try {
      const cleanPath = path.startsWith("app:/") ? path : `app:/${path}`;

      const finalPath =
        type === "file" && !cleanPath.endsWith(".txt")
          ? `${cleanPath}.txt`
          : cleanPath;

      if (type === "dir") {
        const response = await this.apiClient.put("/resources", undefined, {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
          params: {
            path: finalPath,
          },
        });
        return { success: response.status === 201 };
      } else {
        const uploadUrlResponse = await this.apiClient.get(
          "/resources/upload",
          {
            headers: {
              Authorization: `OAuth ${oauthToken}`,
            },
            params: {
              path: finalPath,
              overwrite: true,
            },
          }
        );

        if (uploadUrlResponse.data.href) {
          const uploadResponse = await axios.put(
            uploadUrlResponse.data.href,
            "",
            {
              headers: {
                "Content-Type": "text/plain",
              },
            }
          );
          return {
            success:
              uploadResponse.status === 201 || uploadResponse.status === 200,
          };
        }
      }

      return { success: false };
    } catch (error) {
      console.error(`Error creating ${type}:`, error);
      throw error;
    }
  }
}
