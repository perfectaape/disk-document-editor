import axios, { AxiosResponse } from "axios";
import { IFileAPI, File } from "./fileApi";

export interface GoogleDriveResponse {
  files: GoogleDriveFile[];
}

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  modifiedTime?: string;
}

interface GoogleDriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  createdTime?: string;
  modifiedTime?: string;
}

interface GoogleDriveFileList {
  files: GoogleDriveFileMetadata[];
  nextPageToken?: string;
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
      const files = response.data.files.map(transformGoogleFile);

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
    }
    return [];
  }

  async deleteFile(
    fileId: string,
    oauthToken: string
  ): Promise<{ success: boolean }> {
    await this.apiClient.delete(`/files/${fileId}`, {
      headers: {
        Authorization: `Bearer ${oauthToken}`,
      },
    });
    return { success: true };
  }

  async fetchDocumentContent(
    fileId: string,
    oauthToken: string,
    signal?: AbortSignal
  ): Promise<string | undefined> {
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
  }

  async fetchFileMetadata(fileId: string, oauthToken: string): Promise<File> {
    const response = await this.apiClient.get(`/files/${fileId}`, {
      headers: {
        Authorization: `Bearer ${oauthToken}`,
      },
      params: {
        fields: "id, name, mimeType, createdTime, modifiedTime",
      },
    });

    return response.data;
  }

  async saveDocumentContent(
    fileId: string,
    oauthToken: string,
    content: string
  ): Promise<void> {
    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;

    await axios.patch(uploadUrl, content, {
      headers: {
        "Content-Type": "text/plain",
        Authorization: `Bearer ${oauthToken}`,
      },
    });
  }
  async renameFile(
    fileId: string,
    newName: string,
    oauthToken: string
  ): Promise<{ success: boolean }> {
    try {
      const response = await this.apiClient.patch<GoogleDriveFileMetadata>(
        `/files/${fileId}`,
        {
          name: newName,
        },
        {
          headers: {
            Authorization: `Bearer ${oauthToken}`,
            "Content-Type": "application/json; charset=utf-8",
            Accept: "application/json",
          },
          params: {
            fields: "id, name, mimeType",
          },
        }
      );

      // Для папок обновляем вложенные файлы
      if (response.data.mimeType === "application/vnd.google-apps.folder") {
        const filesInFolder = await this.apiClient.get<GoogleDriveFileList>(
          "/files",
          {
            headers: {
              Authorization: `Bearer ${oauthToken}`,
            },
            params: {
              q: `'${fileId}' in parents and trashed = false`,
              fields: "files(id, name, mimeType, parents)",
            },
          }
        );

        if (filesInFolder.data.files) {
          await Promise.all(
            filesInFolder.data.files.map((file) =>
              this.updateFileMetadata(file.id, oauthToken)
            )
          );
        }
      }

      return { success: true };
    } catch (error) {
      console.error("Error in renameFile:", error);
      return { success: false };
    }
  }

  private async updateFileMetadata(
    fileId: string,
    oauthToken: string
  ): Promise<void> {
    await this.apiClient.get<GoogleDriveFileMetadata>(`/files/${fileId}`, {
      headers: {
        Authorization: `Bearer ${oauthToken}`,
      },
      params: {
        fields: "id, name, mimeType, parents",
      },
    });
  }
  async moveFile(
    sourceId: string,
    destinationId: string,
    oauthToken: string
  ): Promise<{ success: boolean }> {
    try {
      const response = await this.apiClient.patch(
        `/files/${sourceId}`,
        {
          addParents: destinationId,
          removeParents: "root",
        },
        {
          headers: {
            Authorization: `Bearer ${oauthToken}`,
          },
          params: {
            fields: "id, parents",
          },
        }
      );

      return { success: response.status === 200 };
    } catch (error) {
      console.error("Error moving file:", error);
      return { success: false };
    }
  }
}
