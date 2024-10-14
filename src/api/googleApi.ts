import axios, { AxiosResponse } from "axios";
import { IFileAPI, File } from "./fileApi";

export interface GoogleDriveResponse {
  files: File[];
}

export class GoogleApi implements IFileAPI {
  private apiClient = axios.create({
    baseURL: "https://www.googleapis.com/drive/v3",
    headers: {
      "Content-Type": "application/json",
    },
  });

  async fetchFiles(oauthToken: string): Promise<File[]> {
    try {
      const response: AxiosResponse<GoogleDriveResponse> =
        await this.apiClient.get("/files", {
          headers: {
            Authorization: `Bearer ${oauthToken}`,
          },
          params: {
            q: "mimeType='text/plain'",
            fields: "files(id, name, mimeType)",
          },
        });

      if (response.data && response.data.files) {
        return response.data.files;
      } else {
        console.warn("No files found in the response.");
        return [];
      }
    } catch (error) {
      console.error("Error fetching files from Google Drive:", error);
      return [];
    }
  }

  async fetchDocumentContent(
    fileId: string,
    oauthToken: string
  ): Promise<string> {
    try {
      const response = await this.apiClient.get(`/files/${fileId}`, {
        headers: {
          Authorization: `Bearer ${oauthToken}`,
        },
        params: {
          alt: "media",
        },
        responseType: "arraybuffer",
      });

      const decoder = new TextDecoder("utf-8");
      return decoder.decode(response.data);
    } catch (error) {
      console.error("Ошибка при загрузке документа из Google Drive:", error);
      throw error;
    }
  }

  async saveDocumentContent(
    fileId: string,
    oauthToken: string,
    content: string
  ): Promise<void> {
    try {
      const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;

      const blob = new Blob([content], {
        type: "text/plain",
      });

      await axios.patch(uploadUrl, blob, {
        headers: {
          "Content-Type": "text/plain",
          Authorization: `Bearer ${oauthToken}`,
        },
      });
    } catch (error) {
      console.error(
        "Ошибка при сохранении содержимого документа в Google Drive:",
        error
      );
      throw error;
    }
  }
}
