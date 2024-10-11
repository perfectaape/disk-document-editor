import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchDocumentContent,
  getCookie,
  saveDocumentContent,
} from "../../api/yandexApi";
import mammoth from "mammoth";
import Loader from "../../components/Loader/loader";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { debounce } from "lodash";
import "./editor.css";

export const Editor: React.FC = () => {
  const { filePath } = useParams<{ filePath?: string }>();
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const navigate = useNavigate();

  const checkToken = useCallback(() => {
    const token = getCookie("yandex_token");
    if (!token) {
      navigate("/");
      return null;
    }
    return token;
  }, [navigate]);

  const handleFetchDocumentContent = useCallback(
    async (fileName: string, oauthToken: string) => {
      setLoading(true);
      try {
        const arrayBuffer = await fetchDocumentContent(fileName, oauthToken);
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
    []
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
        await saveDocumentContent(filePath!, token, await blob.arrayBuffer());
      } catch (error) {
        console.error("Ошибка при сохранении содержимого документа:", error);
      } finally {
        setSaving(false);
      }
    },
    [filePath, checkToken]
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
      <button onClick={() => handleSaveDocument(content)}>Сохранить</button>
    </div>
  );
};
