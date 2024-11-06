import axios from "axios";
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

export class GoogleApi implements IFileAPI {
  private apiClient = axios.create({
    baseURL: "https://www.googleapis.com/drive/v3",
    headers: {
      "Content-Type": "application/json",
    },
  });

  private readonly APP_FOLDER_NAME = "Text Editor Files";
  private appFolderId: string | null = null;

  async getWorkingFolderContents(oauthToken: string): Promise<File[]> {
    try {
      const folderId = await this.getOrCreateAppFolder(oauthToken);
      return this.fetchFiles(oauthToken, folderId);
    } catch (error) {
      console.error("Error getting working folder contents:", error);
      return [];
    }
  }

  public async getOrCreateAppFolder(oauthToken: string): Promise<string> {
    if (this.appFolderId) return this.appFolderId;

    try {
      const response = await this.apiClient.get<GoogleDriveResponse>("/files", {
        headers: {
          Authorization: `Bearer ${oauthToken}`,
        },
        params: {
          q: `name='${this.APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: "files(id, name)",
        },
      });

      if (response.data.files && response.data.files.length > 0) {
        this.appFolderId = response.data.files[0].id;
        return this.appFolderId;
      }

      const createResponse = await this.apiClient.post<{ id: string }>(
        "/files",
        {
          name: this.APP_FOLDER_NAME,
          mimeType: "application/vnd.google-apps.folder",
        },
        {
          headers: {
            Authorization: `Bearer ${oauthToken}`,
          },
        }
      );

      this.appFolderId = createResponse.data.id;
      return this.appFolderId;
    } catch (error) {
      console.error("Error in getOrCreateAppFolder:", error);
      throw error;
    }
  }

  async fetchFiles(oauthToken: string, path?: string): Promise<File[]> {
    try {
      if (!path) {
        return this.getWorkingFolderContents(oauthToken);
      }
      return this._fetchFiles(oauthToken, path);
    } catch (error) {
      console.error("Error in fetchFiles:", error);
      return [];
    }
  }

  private async _fetchFiles(
    oauthToken: string,
    folderId: string
  ): Promise<File[]> {
    try {
      const response = await this.apiClient.get<GoogleDriveResponse>("/files", {
        headers: {
          Authorization: `Bearer ${oauthToken}`,
        },
        params: {
          q: `'${folderId}' in parents and trashed = false`,
          fields: "files(id, name, mimeType)",
        },
      });

      const files = await Promise.all(
        response.data.files.map(async (file) => {
          const transformedFile = this.transformGoogleFile(file);
          if (file.mimeType === "application/vnd.google-apps.folder") {
            const children = await this._fetchFiles(oauthToken, file.id);
            return {
              ...transformedFile,
              children,
            };
          }
          return transformedFile;
        })
      );

      return files;
    } catch (error) {
      console.error("Error in _fetchFiles:", error);
      return [];
    }
  }

  private transformGoogleFile(file: GoogleDriveFile): File {
    return {
      name: file.name,
      path: file.id,
      type:
        file.mimeType === "application/vnd.google-apps.folder" ? "dir" : "file",
      mimeType: file.mimeType,
      children: [],
    };
  }

  private async isFileInAppFolder(
    fileId: string,
    oauthToken: string
  ): Promise<boolean> {
    try {
      const appFolderId = await this.getOrCreateAppFolder(oauthToken);
      const response = await this.apiClient.get(`/files/${fileId}`, {
        headers: {
          Authorization: `Bearer ${oauthToken}`,
        },
        params: {
          fields: "parents",
        },
      });

      const checkParents = async (parents: string[]): Promise<boolean> => {
        if (!parents || parents.length === 0) return false;
        if (parents.includes(appFolderId)) return true;

        for (const parentId of parents) {
          const parentResponse = await this.apiClient.get(
            `/files/${parentId}`,
            {
              headers: {
                Authorization: `Bearer ${oauthToken}`,
              },
              params: {
                fields: "parents",
              },
            }
          );
          if (await checkParents(parentResponse.data.parents)) return true;
        }
        return false;
      };

      return checkParents(response.data.parents);
    } catch (error) {
      console.error("Error checking file location:", error);
      return false;
    }
  }

  async deleteFile(
    fileId: string,
    oauthToken: string
  ): Promise<{ success: boolean }> {
    try {
      if (!(await this.isFileInAppFolder(fileId, oauthToken))) {
        throw new Error("File is not in app folder");
      }
      await this.apiClient.delete(`/files/${fileId}`, {
        headers: {
          Authorization: `Bearer ${oauthToken}`,
        },
      });
      return { success: true };
    } catch (error) {
      console.error("Error in deleteFile:", error);
      return { success: false };
    }
  }

  async fetchDocumentContent(
    fileId: string,
    oauthToken: string,
    signal: AbortSignal
  ): Promise<string | undefined> {
    try {
      const response = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${oauthToken}`,
          },
          responseType: "text",
          signal,
        }
      );

      return response.data;
    } catch (error) {
      console.error("Ошибка при загрузке содержимого файла:", error);
      return undefined;
    }
  }

  async fetchFileMetadata(fileId: string, oauthToken: string): Promise<File> {
    const response = await this.apiClient.get(`/files/${fileId}`, {
      headers: {
        Authorization: `Bearer ${oauthToken}`,
      },
      params: {
        fields: "id, name, mimeType, size, createdTime, modifiedTime, owners",
      },
    });

    return {
      name: response.data.name,
      path: response.data.id,
      mimeType: response.data.mimeType,
      type:
        response.data.mimeType === "application/vnd.google-apps.folder"
          ? "dir"
          : "file",
      size: parseInt(response.data.size || "0"),
      created: response.data.createdTime,
      modified: response.data.modifiedTime,
      owner: response.data.owners?.[0]?.displayName || "",
      createdDate: response.data.createdTime,
      modifiedDate: response.data.modifiedTime,
    };
  }

  async saveDocumentContent(
    fileId: string,
    oauthToken: string,
    content: string
  ): Promise<void> {
    try {
      await axios.patch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        content,
        {
          headers: {
            "Content-Type": "text/plain",
            Authorization: `Bearer ${oauthToken}`,
          },
        }
      );
    } catch (error) {
      console.error("Ошибка при сохранении содержимого файла:", error);
      throw error;
    }
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
      if (!(await this.isFileInAppFolder(sourceId, oauthToken))) {
        throw new Error("Source file is not in app folder");
      }

      // Получаем текущего родителя файла
      const fileResponse = await this.apiClient.get(`/files/${sourceId}`, {
        headers: {
          Authorization: `Bearer ${oauthToken}`,
        },
        params: {
          fields: "parents",
        },
      });

      const currentParents = fileResponse.data.parents?.join(',') || '';

      // Перемещаем файл
      const response = await this.apiClient.patch(`/files/${sourceId}`, null, {
        headers: {
          Authorization: `Bearer ${oauthToken}`,
        },
        params: {
          addParents: destinationId,
          removeParents: currentParents,
          fields: "id, parents",
        },
      });

      return { success: response.status === 200 };
    } catch (error) {
      console.error("Error in moveFile:", error);
      return { success: false };
    }
  }

  async createFolder(path: string, oauthToken: string): Promise<{ success: boolean }> {
    try {
      const cleanPath = path.replace(/^app:\//, '').replace(/^\/+/, '');
      const parts = cleanPath.split('/').filter(p => p);
      const folderName = parts[parts.length - 1] || 'New Folder';
      
      let parentFolderId: string;
      if (!parts.length || parts.length === 1) {
        parentFolderId = await this.getOrCreateAppFolder(oauthToken);
      } else {
        parentFolderId = parts[parts.length - 2];
        const isInAppFolder = await this.isFileInAppFolder(parentFolderId, oauthToken);
        if (!isInAppFolder) {
          throw new Error("Parent folder is not in app folder");
        }
      }

      const response = await this.apiClient.post(
        "/files",
        {
          name: folderName,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentFolderId],
        },
        {
          headers: {
            Authorization: `Bearer ${oauthToken}`,
          },
        }
      );

      return { success: !!response.data.id };
    } catch (error) {
      console.error("Error in createFolder:", error);
      return { success: false };
    }
  }

  async createFile(path: string, oauthToken: string, content: string = ""): Promise<{ success: boolean }> {
    try {
      const cleanPath = path.replace(/^app:\//, '').replace(/^\/+/, '');
      const parts = cleanPath.split('/').filter(p => p);
      const fileName = parts[parts.length - 1] || 'New File.txt';
      
      let parentFolderId: string;
      if (!parts.length || parts.length === 1) {
        parentFolderId = await this.getOrCreateAppFolder(oauthToken);
      } else {
        parentFolderId = parts[parts.length - 2];
        const isInAppFolder = await this.isFileInAppFolder(parentFolderId, oauthToken);
        if (!isInAppFolder) {
          throw new Error("Parent folder is not in app folder");
        }
      }

      const fileMetadata = {
        name: fileName,
        mimeType: "text/plain",
        parents: [parentFolderId],
      };

      const createResponse = await this.apiClient.post("/files", fileMetadata, {
        headers: {
          Authorization: `Bearer ${oauthToken}`,
        },
      });

      if (content) {
        const fileId = createResponse.data.id;
        const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
        await axios.patch(uploadUrl, content, {
          headers: {
            "Content-Type": "text/plain",
            Authorization: `Bearer ${oauthToken}`,
          },
        });
      }

      return { success: !!createResponse.data.id };
    } catch (error) {
      console.error("Error in createFile:", error);
      return { success: false };
    }
  }
}
