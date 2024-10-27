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
    mimeType: file.mimeType, // Изменено с mime_type на mimeType
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
    signal: AbortSignal
  ): Promise<string | undefined> {
    try {
      const response = await axios.get(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${oauthToken}`,
        },
        responseType: 'text',
        signal,
      });

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
    try {
      await axios.patch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, content, {
        headers: {
          "Content-Type": "text/plain",
          Authorization: `Bearer ${oauthToken}`,
        },
      });
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
      // Получаем текущих родителей исходного файла
      const sourceFile = await this.apiClient.get<GoogleDriveFileMetadata>(
        `/files/${sourceId}`,
        {
          headers: {
            Authorization: `Bearer ${oauthToken}`,
          },
          params: {
            fields: "parents",
          },
        }
      );

      const currentParents = sourceFile.data.parents || [];
      console.log("Current parents:", currentParents);

      // Если перемещаем в корень, используем "root" как идентификатор
      const targetParent = destinationId || "root";

      // Проверяем, не является ли файл уже в целевой папке
      if (currentParents.includes(targetParent)) {
        console.log("Файл уже находится в целевой папке.");
        return { success: true };
      }

      // Удаляем текущих родителей, чтобы переместить файл
      const removeParents = currentParents.join(",");
      console.log("Removing parents:", removeParents);
      console.log("Adding parent:", targetParent);

      // Отправляем запрос на перемещение файла
      const response = await this.apiClient.patch(
        `/files/${sourceId}`,
        null, // Поскольку мы не обновляем содержимое файла, тело запроса может быть null
        {
          headers: {
            Authorization: `Bearer ${oauthToken}`,
            "Content-Type": "application/json",
          },
          params: {
            addParents: targetParent,
            removeParents: removeParents,
            fields: "id, parents",
          },
        }
      );

      console.log("Move response:", response.data);

      // Проверяем, что файл действительно перемещен
      const updatedFile = await this.apiClient.get<GoogleDriveFileMetadata>(
        `/files/${sourceId}`,
        {
          headers: {
            Authorization: `Bearer ${oauthToken}`,
          },
          params: {
            fields: "parents",
          },
        }
      );

      console.log("Updated parents:", updatedFile.data.parents);

      return { success: response.status === 200 };
    } catch (error) {
      console.error("Ошибка при перемещении файла:", error);
      if (axios.isAxiosError(error) && error.response) {
        console.error("Response data:", error.response.data);
      }
      return { success: false };
    }
  }

  async createFolder(
    path: string,
    oauthToken: string
  ): Promise<{ success: boolean }> {
    try {
      // Разделяем путь на родительский ID и имя папки
      const [parentId, folderName] = path.split("/").reduce((acc, part, index, arr) => {
        if (index === arr.length - 1) {
          acc[1] = part; // Последний элемент - имя папки
        } else {
          acc[0] = acc[0] ? `${acc[0]}/${part}` : part; // Остальные - родительский путь
        }
        return acc;
      }, ["", ""]);

      const response = await this.apiClient.post(
        "/files",
        {
          name: folderName,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentId || "root"], // Используем "root", если parentId пуст
        },
        {
          headers: {
            Authorization: `Bearer ${oauthToken}`,
          },
        }
      );

      return { success: response.status === 200 };
    } catch (error) {
      console.error("Ошибка при создании папки:", error);
      return { success: false };
    }
  }

  async createFile(
    path: string,
    oauthToken: string,
    content: string = ""
  ): Promise<{ success: boolean }> {
    try {
      // Разделяем путь на родительский ID и имя файла
      const [parentId, fileName] = path.split("/").reduce((acc, part, index, arr) => {
        if (index === arr.length - 1) {
          acc[1] = part; // Последний элемент - имя файла
        } else {
          acc[0] = acc[0] ? `${acc[0]}/${part}` : part; // Остальные - родительский путь
        }
        return acc;
      }, ["", ""]);

      // Step 1: Create a file metadata
      const fileMetadata = {
        name: fileName,
        mimeType: "application/vnd.google-apps.document", // Указываем правильный MIME-тип
        parents: [parentId || "root"], // Используем "root", если parentId пуст
      };

      const createResponse = await this.apiClient.post(
        "/files",
        fileMetadata,
        {
          headers: {
            Authorization: `Bearer ${oauthToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const fileId = createResponse.data.id;

      // Step 2: Upload content to the file
      const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;

      await axios.patch(uploadUrl, content, {
        headers: {
          "Content-Type": "text/plain", // Указываем MIME-тип для содержимого
          Authorization: `Bearer ${oauthToken}`,
        },
      });

      return { success: true };
    } catch (error) {
      console.error("Ошибка при создании файла:", error);
      return { success: false };
    }
  }
}
