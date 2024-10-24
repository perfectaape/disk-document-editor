import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { YandexApi } from "../../api/yandexApi";
import { GoogleApi } from "../../api/googleApi";
import { debounce } from "lodash";
import "./editor.css";
import { getCookie } from "../../api/fileApi";
import Loader from "../../components/Loader/loader";
import { AxiosError } from "axios";

export const Editor: React.FC = () => {
  const { service, filePath } = useParams<{
    service: "yandex" | "google";
    filePath?: string;
  }>();
  const [content, setContent] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [unsupportedFormat, setUnsupportedFormat] = useState<boolean>(false);
  const navigate = useNavigate();
  const yandexApi = useMemo(() => new YandexApi(), []);
  const googleApi = useMemo(() => new GoogleApi(), []);

  const checkToken = useCallback(() => {
    const yandexToken = getCookie("yandex_token");
    const googleToken = getCookie("google_token");
    if (!yandexToken && !googleToken) {
      navigate("/");
      return null;
    }
    return service === "yandex" ? yandexToken : googleToken;
  }, [navigate, service]);

  const isSupportedFormat = (fileName: string, mimeType: string) => {
    return mimeType === "text/plain" || fileName.endsWith(".txt");
  };

  const handleFetchDocumentContent = useCallback(
    async (fileName: string, oauthToken: string, signal: AbortSignal) => {
      try {
        const fileMetadata =
          service === "yandex"
            ? { mimeType: "text/plain" } // Предположим, что у нас есть способ получить MIME-тип для Яндекса
            : await googleApi.fetchFileMetadata(fileName, oauthToken);

        if (!isSupportedFormat(fileName, fileMetadata.mimeType)) {
          setUnsupportedFormat(true);
          setLoading(false);
          return;
        }

        setLoading(true);
        setUnsupportedFormat(false);

        const content =
          service === "yandex"
            ? await yandexApi.fetchDocumentContent(fileName, oauthToken, signal)
            : await googleApi.fetchDocumentContent(
                fileName,
                oauthToken,
                signal
              );

        if (content !== undefined) {
          setContent(content);
        } else {
          console.error("Получено пустое содержимое документа");
          alert(
            "Не удалось загрузить содержимое документа. Попробуйте еще раз."
          );
        }
      } catch (error) {
        const axiosError = error as AxiosError;
        if (axiosError.name !== "AbortError") {
          console.error(
            "Ошибка при получении содержимого документа:",
            axiosError.message
          );
          alert(
            "Не удалось загрузить содержимое документа. Попробуйте еще раз."
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [service, yandexApi, googleApi]
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
      if (!token) return;

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
    [filePath, checkToken, service, yandexApi, googleApi]
  );

  const debouncedSaveDocument = useMemo(
    () => debounce((text: string) => handleSaveDocument(text), 2000),
    [handleSaveDocument]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setContent(newText);
    debouncedSaveDocument(newText);
  };

  const handleClose = () => {
    navigate(`/explorer/${service}`);
  };

  if (loading) {
    return <Loader />;
  }

  if (unsupportedFormat) {
    return (
      <div className="container">
        <button onClick={handleClose} className="close-button">
          Закрыть
        </button>
        <h1>Неизвестный формат файла</h1>
        <p>
          Этот файл не поддерживается для редактирования. Пожалуйста, выберите
          текстовый файл.
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      <button onClick={handleClose} className="close-button">
        Закрыть
      </button>
      <h1>Содержимое документа</h1>
      <textarea
        className="textarea-editor"
        value={content}
        onChange={handleChange}
        rows={10}
        cols={50}
      />
      {saving && <div className="loading-indicator"></div>}
      <button className="start-btn" onClick={() => handleSaveDocument(content)}>
        Сохранить
      </button>
    </div>
  );
};
