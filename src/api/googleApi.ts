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
    mime_type: file.mimeType,
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

      if (response.data && response.data.files) {
        const files = response.data.files.map((file: GoogleDriveFile) =>
          transformGoogleFile(file)
        );

        const filesWithChildren = await Promise.all(
          files.map(async (file) => {
            if (file.type === "dir") {
              const children = await this.fetchFiles(oauthToken, file.path);
              return { ...file, children };
            }
            return file;
          })
        );

        return filesWithChildren;
      } else {
        console.warn("No files found in response.");
        return [];
      }
    } catch (error) {
      console.error("Error fetching files from Google Drive:", error);
      if (axios.isAxiosError(error) && error.response) {
        console.error("Google API response:", error.response.data);
      }
      return [];
    }
  }

  async fetchFileMetadata(
    fileId: string,
    oauthToken: string
  ): Promise<GoogleDriveFile> {
    try {
      const response = await this.apiClient.get(`/files/${fileId}`, {
        headers: {
          Authorization: `Bearer ${oauthToken}`,
        },
        params: {
          fields: "id, name, mimeType",
        },
      });

      return response.data;
    } catch (error) {
      console.error("Error fetching file metadata from Google Drive:", error);
      throw error;
    }
  }

  async fetchDocumentContent(
    fileId: string,
    oauthToken: string,
    signal?: AbortSignal
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
        signal,
      });

      const decoder = new TextDecoder("utf-8");
      return decoder.decode(response.data);
    } catch (error) {
      console.error(
        "Error fetching document content from Google Drive:",
        error
      );
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
      console.error("Error saving document content to Google Drive:", error);
      throw error;
    }
  }

  async deleteFile(fileId: string, oauthToken: string): Promise<void> {
    try {
      await this.apiClient.delete(`/files/${fileId}`, {
        headers: {
          Authorization: `Bearer ${oauthToken}`,
        },
      });
      console.log(`File with ID ${fileId} deleted successfully.`);
    } catch (error) {
      console.error("Error deleting file from Google Drive:", error);
      if (axios.isAxiosError(error) && error.response) {
        console.error("Google API response:", error.response.data);
      }
      throw error;
    }
  }
}
