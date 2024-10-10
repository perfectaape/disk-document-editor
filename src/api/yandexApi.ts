import axios, { AxiosResponse } from "axios";

export function getCookie(name: string): string | undefined {
  const value: string = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift();
  }
  return undefined;
}

export interface YandexDiskFile {
  name: string;
  path: string;
  mime_type: string;
}

export interface YandexDiskResponse {
  items: YandexDiskFile[];
}

export const fetchFiles = async (
  oauthToken: string
): Promise<YandexDiskFile[]> => {
  try {
    const response: AxiosResponse<YandexDiskResponse> = await axios.get(
      "https://cloud-api.yandex.net/v1/disk/resources/files/",
      {
        headers: {
          Authorization: `OAuth ${oauthToken}`,
        },
      }
    );
    const textFiles = response.data.items.filter(
      (item) =>
        item.mime_type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    return textFiles;
  } catch (error) {
    console.error("Error fetching files:", error);
    return [];
  }
};

export const fetchDocumentContent = async (
  path: string,
  oauthToken: string
): Promise<ArrayBuffer> => {
  try {
    const response = await axios.get(
      `https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(
        path
      )}`,
      {
        headers: {
          Authorization: `OAuth ${oauthToken}`,
        },
        maxRedirects: 0,
      }
    );

    if (response.status === 200 && response.data.href) {
      const downloadUrl = response.data.href;

      const fileResponse = await axios.get(downloadUrl, {
        responseType: "arraybuffer",
      });

      return fileResponse.data;
    } else {
      throw new Error("Не удалось получить ссылку для скачивания");
    }
  } catch (error) {
    console.error("Ошибка при загрузке документа:", error);
    throw error;
  }
};

export const saveDocumentContent = async (
  path: string,
  oauthToken: string,
  content: ArrayBuffer
): Promise<void> => {
  try {
    const response = await axios.get(
      `https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(
        path
      )}&overwrite=true`,
      {
        headers: {
          Authorization: `OAuth ${oauthToken}`,
        },
      }
    );

    const uploadUrl = response.data.href;

    const blob = new Blob([content], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    await axios.put(uploadUrl, blob, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });
  } catch (error) {
    console.error("Ошибка при сохранении содержимого документа:", error);
    throw error;
  }
};
