import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchDocumentContent,
  getCookie,
  saveDocumentContent,
} from "../api/yandexApi";
import mammoth from "mammoth";
import Loader from "../components/loader";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { debounce } from "lodash";
import "../styles/editor.css";

export const Editor: React.FC = () => {
  const { filePath } = useParams<{ filePath?: string }>();
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = getCookie("yandex_token");
    if (!token) {
      navigate("/");
      return;
    }
    if (filePath) {
      const decodedPath = decodeURIComponent(filePath);
      handleFetchDocumentContent(decodedPath, token);
    } else {
      console.error("Имя файла не определено");
      navigate("/");
    }
  }, [navigate, filePath]);

  const handleFetchDocumentContent = async (
    fileName: string,
    oauthToken: string
  ) => {
    setLoading(true);
    try {
      const arrayBuffer = await fetchDocumentContent(fileName, oauthToken);
      const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const plainText = doc.body.innerText;
      setContent(plainText);
    } catch (error) {
      console.error("Ошибка при получении содержимого документа:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDocument = async (text: string) => {
    const token = getCookie("yandex_token");
    if (!token) {
      console.error("OAuth токен не найден");
      return;
    }
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
  };

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
        style={{ width: "100%", height: "200px" }}
      />
      {saving && <div className="loading-indicator"></div>}
      <button onClick={() => handleSaveDocument(content)}>Сохранить</button>
    </div>
  );
};
