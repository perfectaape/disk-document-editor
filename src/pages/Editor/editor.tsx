import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { YandexApi } from "../../api/yandexApi";
import { GoogleApi } from "../../api/googleApi";
import mammoth from "mammoth";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { debounce } from "lodash";
import "./editor.css";
import { getCookie } from "../../api/fileApi";
import Loader from "../../components/Loader/loader";

export const Editor: React.FC = () => {
  const { service, filePath } = useParams<{
    service: "yandex" | "google";
    filePath?: string;
  }>();
  const [content, setContent] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
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

  const handleFetchDocumentContent = useCallback(
    async (fileName: string, oauthToken: string) => {
      setLoading(true);
      try {
        const arrayBuffer =
          service === "yandex"
            ? await yandexApi.fetchDocumentContent(fileName, oauthToken)
            : await googleApi.fetchDocumentContent(fileName, oauthToken);
        const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        setContent(doc.body.innerText);
      } catch (error) {
        console.error("Ошибка при получении содержимого документа:", error);
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
      handleFetchDocumentContent(decodedPath, token);
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
        const doc = new Document({
          sections: [
            {
              properties: {},
              children: [
                new Paragraph({
                  children: [new TextRun(text)],
                }),
              ],
            },
          ],
        });
        const blob = await Packer.toBlob(doc);
        if (service === "yandex") {
          await yandexApi.saveDocumentContent(
            filePath!,
            token,
            await blob.arrayBuffer()
          );
        } else {
          await googleApi.saveDocumentContent(
            filePath!,
            token,
            await blob.arrayBuffer()
          );
        }
      } catch (error) {
        console.error("Ошибка при сохранении содержимого документа:", error);
      } finally {
        setSaving(false);
      }
    },
    [filePath, checkToken, service, yandexApi, googleApi]
  );

  const debouncedSaveDocument = useRef(
    debounce((text: string) => handleSaveDocument(text), 2000)
  ).current;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setContent(newText);
    debouncedSaveDocument(newText);
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="container">
      <button onClick={handleBack} className="back-button">
        Назад
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
