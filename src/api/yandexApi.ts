import axios, { AxiosResponse } from "axios";
import { IFileAPI, File } from "./fileApi";

export interface YandexDiskResponse {
  items: File[];
}

export class YandexApi implements IFileAPI {
  private apiClient = axios.create({
    baseURL: "https://cloud-api.yandex.net/v1/disk",
    headers: {
      "Content-Type": "application/json",
    },
  });

  async fetchFiles(oauthToken: string): Promise<File[]> {
    try {
      const response: AxiosResponse<YandexDiskResponse> =
        await this.apiClient.get("/resources/files/", {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
        });
      return response.data.items.filter(
        (item) => item.mime_type === "text/plain"
      );
    } catch (error) {
      console.error("Error fetching files:", error);
      return [];
    }
  }

  async fetchDocumentContent(
    path: string,
    oauthToken: string
  ): Promise<string> {
    try {
      const response = await this.apiClient.get(
        `/resources/download?path=${encodeURIComponent(path)}`,
        {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
          maxRedirects: 0,
        }
      );

      if (response.status === 200 && response.data.href) {
        const fileResponse = await axios.get(response.data.href, {
          responseType: "arraybuffer",
        });

        const decoder = new TextDecoder("utf-8");
        const textContent = decoder.decode(fileResponse.data);
        return textContent;
      } else {
        throw new Error("Не удалось получить ссылку для скачивания");
      }
    } catch (error) {
      console.error("Ошибка при загрузке документа:", error);
      throw error;
    }
  }

  async saveDocumentContent(
    path: string,
    oauthToken: string,
    content: string
  ): Promise<void> {
    try {
      const response = await this.apiClient.get(
        `/resources/upload?path=${encodeURIComponent(path)}&overwrite=true`,
        {
          headers: {
            Authorization: `OAuth ${oauthToken}`,
          },
        }
      );

      const uploadUrl = response.data.href;

      const blob = new Blob([content], {
        type: "text/plain",
      });

      await axios.put(uploadUrl, blob, {
        headers: {
          "Content-Type": "text/plain",
        },
      });
    } catch (error) {
      console.error("Ошибка при сохранении содержимого документа:", error);
      throw error;
    }
  }
}
