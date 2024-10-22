import axios, { AxiosResponse } from "axios";
import { IFileAPI, File } from "./fileApi";

export interface GoogleDriveResponse {
  files: GoogleDriveFile[];
}

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
}

function transformGoogleFile(file: GoogleDriveFile): File {
  return {
    name: file.name,
    path: file.id,
    mime_type: file.mimeType, // Convert mimeType to mime_type
    type:
      file.mimeType === "application/vnd.google-apps.folder" ? "dir" : "file",
  };
}

export class GoogleApi implements IFileAPI {
  private apiClient = axios.create({
    baseURL: "https://www.googleapis.com/drive/v3",
    headers: {
      "Content-Type": "application/json",
    },
  });

  async fetchFiles(
    oauthToken: string,
    folderId: string = "root"
  ): Promise<File[]> {
    try {
      const response: AxiosResponse<GoogleDriveResponse> =
        await this.apiClient.get("/files", {
          headers: {
            Authorization: `Bearer ${oauthToken}`,
          },
          params: {
            q: `'${folderId}' in parents and trashed = false`,
            fields: "files(id, name, mimeType)",
          },
        });

      console.log("Ответ от Google API:", response.data);

      if (response.data && response.data.files) {
        return response.data.files.map((file: GoogleDriveFile) =>
          transformGoogleFile(file)
        );
      } else {
        console.warn("Нет файлов в ответе.");
        return [];
      }
    } catch (error) {
      console.error("Ошибка при получении файлов из Google Drive:", error);
      if (axios.isAxiosError(error) && error.response) {
        console.error("Ответ от Google API:", error.response.data);
      }
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
