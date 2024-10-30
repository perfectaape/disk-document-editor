import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { YandexApi } from "../../api/yandexApi";
import { GoogleApi } from "../../api/googleApi";
import { debounce } from "lodash";
import "./editor.css";
import { getCookie } from "../../api/fileApi";
import Loader from "../../components/Loader/loader";
import { AxiosError } from "axios";

interface EditorProps {
  isFileDeleted: boolean;
}

interface FileMetadata {
  name: string;
  size: number;
  createdDate: string;
  modifiedDate: string;
  path?: string;
  owner?: string;
}

// Добавляем функцию форматирования даты
const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const Editor: React.FC<EditorProps> = React.memo(({ isFileDeleted }) => {
  const { service, filePath } = useParams<{
    service: "yandex" | "google";
    filePath?: string;
  }>();
  const [content, setContent] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [unsupportedFormat, setUnsupportedFormat] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null);
  const navigate = useNavigate();
  const yandexApi = useMemo(() => new YandexApi(), []);
  const googleApi = useMemo(() => new GoogleApi(), []);
  const [isContentLoading, setIsContentLoading] = useState<boolean>(true);

  const checkToken = useCallback(() => {
    const yandexToken = getCookie("yandex_token");
    const googleToken = getCookie("google_token");
    if (!yandexToken && !googleToken) {
      navigate("/");
      return null;
    }
    return service === "yandex" ? yandexToken : googleToken;
  }, [navigate, service]);

  const isSupportedFormat = useCallback(
    (mimeType: string, fileName: string) => {
      const supportedMimeTypes = [
        "text/plain",
        "text/plain; charset=utf-8",
        "text/plain; charset=utf-16",
        "application/x-empty",
      ];

      if (service === "google") {
        return supportedMimeTypes.includes(mimeType.toLowerCase());
      }

      return (
        supportedMimeTypes.includes(mimeType.toLowerCase()) &&
        fileName.toLowerCase().endsWith(".txt")
      );
    },
    [service]
  );

  const handleFetchDocumentContent = useCallback(
    async (fileName: string, oauthToken: string, signal: AbortSignal) => {
      setIsContentLoading(true);
      try {
        const fileMetadata =
          service === "yandex"
            ? await yandexApi.fetchFileMetadata(fileName, oauthToken)
            : await googleApi.fetchFileMetadata(fileName, oauthToken);

        const mimeType =
          service === "yandex" ? fileMetadata.mime_type : fileMetadata.mimeType;

        if (!isSupportedFormat(mimeType || "", fileName)) {
          setUnsupportedFormat(true);
          return;
        }

        const content =
          service === "yandex"
            ? await yandexApi.fetchDocumentContent(fileName, oauthToken, signal)
            : await googleApi.fetchDocumentContent(
                fileName,
                oauthToken,
                signal
              );

        if (content === undefined || content === null) {
          console.error("Ошибка получения содержимого документа");
          setUnsupportedFormat(true);
        } else {
          setContent(content);
          setUnsupportedFormat(false);
        }
      } catch (error) {
        const axiosError = error as AxiosError;
        if (axiosError.name !== "AbortError") {
          console.error(
            "Ошибка при получении содержимого документа:",
            axiosError.message
          );
          setUnsupportedFormat(true);
        }
      } finally {
        setIsContentLoading(false);
      }
    },
    [service, yandexApi, googleApi, isSupportedFormat]
  );

  useEffect(() => {
    const token = checkToken();
    if (token && filePath) {
      const decodedPath = decodeURIComponent(filePath);
      const controller = new AbortController();
      handleFetchDocumentContent(decodedPath, token, controller.signal);

      return () => {
        controller.abort();
      };
    } else {
      console.error("Имя файла не определено");
      navigate("/");
    }
  }, [navigate, filePath, checkToken, handleFetchDocumentContent]);

  const handleSaveDocument = useCallback(
    async (text: string) => {
      const token = checkToken();
      if (!token || isFileDeleted) return;

      setSaving(true);
      try {
        if (service === "yandex") {
          await yandexApi.saveDocumentContent(filePath!, token, text);
        } else {
          await googleApi.saveDocumentContent(filePath!, token, text);
        }
      } catch (error) {
        const axiosError = error as AxiosError;
        console.error(
          "Ошибка при сохранении содержимого документа:",
          axiosError.message
        );
        alert("Не удалось сохранить документ. Попробуйте еще раз.");
      } finally {
        setSaving(false);
      }
    },
    [filePath, checkToken, service, yandexApi, googleApi, isFileDeleted]
  );

  const debouncedSaveDocument = useMemo(
    () => debounce((text: string) => handleSaveDocument(text), 2000),
    [handleSaveDocument]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setContent(newText);
      debouncedSaveDocument(newText);
    },
    [debouncedSaveDocument]
  );

  const handleClose = useCallback(() => {
    navigate(`/explorer/${service}`);
  }, [navigate, service]);

  const updateFileMetadata = useCallback(async () => {
    const token = checkToken();
    if (token && filePath) {
      const decodedPath = decodeURIComponent(filePath);
      try {
        const metadata =
          service === "yandex"
            ? await yandexApi.fetchFileMetadata(decodedPath, token)
            : await googleApi.fetchFileMetadata(decodedPath, token);

        setFileMetadata({
          name: metadata.name,
          size: metadata.size || 0,
          createdDate: metadata.created || "",
          modifiedDate: metadata.modified || "",
          path: service === "yandex" ? metadata.path : undefined,
          owner: service === "google" ? metadata.owner : undefined,
        });
      } catch (error) {
        console.error("Ошибка при обновлении метаданных файла:", error);
      }
    }
  }, [service, filePath, checkToken, yandexApi, googleApi]);

  const toggleModal = () => {
    if (!isModalOpen) {
      updateFileMetadata();
    }
    setIsModalOpen(!isModalOpen);
  };

  if (isContentLoading) {
    return <Loader />;
  }

  if (unsupportedFormat) {
    return (
      <div className="container">
        <button onClick={handleClose} className="close-button">
          Закрыть
        </button>
        <h1>Неподдерживаемый формат файла</h1>
        <p>Этот файл не поддерживается для редактирования</p>
      </div>
    );
  }

  return (
    <div className={`container ${isFileDeleted ? "editor-disabled" : ""}`}>
      <button onClick={handleClose} className="close-button">
        Закрыть
      </button>
      <h1>Редактор</h1>
      <textarea
        className="textarea-editor"
        value={content}
        onChange={handleChange}
        rows={10}
        cols={50}
        disabled={isFileDeleted}
        placeholder="Начните вводить текст..."
      />
      <div className="editor-buttons">
        <button
          className="start-btn"
          onClick={() => handleSaveDocument(content)}
          disabled={isFileDeleted}
        >
          Сохранить
        </button>
        <button
          onClick={toggleModal}
          style={{ marginLeft: "20px" }}
          className="start-btn"
        >
          Инфо
        </button>
      </div>
      {saving && <div className="loading-indicator"></div>}

      {isModalOpen && fileMetadata && (
        <div className="modal">
          <div className="modal-content">
            <h2>Инфо</h2>
            <ul>
              <li>Имя файла: {fileMetadata.name}</li>
              <li>Размер: {fileMetadata.size || 0} байт</li>
  
              {service === "yandex" && (
                <li>Создан: {formatDate(fileMetadata.createdDate)}</li>
              )}
              {service === "google" && (
                <>
                  <li>Создан: {formatDate(fileMetadata.createdDate)}</li>
                  <li>Изменён: {formatDate(fileMetadata.modifiedDate)}</li>
                </>
              )}
              {service === "yandex" && <li>Путь: {fileMetadata.path}</li>}
              {service === "google" && <li>Владелец: {fileMetadata.owner}</li>}
            </ul>
            <button onClick={toggleModal} className="close-modal-btn">
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
