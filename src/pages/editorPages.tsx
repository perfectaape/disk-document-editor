import React, { useEffect, useState } from "react";
import { fetchFiles, getCookie, YandexDiskFile } from "../api/yandexApi";
import { useNavigate } from "react-router-dom";
import Loader from "../components/loader";
import "../styles/editorPages.css";

export const EditorPages: React.FC = () => {
  const [files, setFiles] = useState<YandexDiskFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = getCookie("yandex_token");
    if (!token) {
      navigate("/");
      return;
    }

    fetchAndSetFiles(token);
  }, [navigate]);

  const handleDocument = (filePath: string): void => {
    const encodedPath = encodeFilePath(filePath);
    navigate(`/editor/${encodedPath}`);
  };

  const encodeFilePath = (filePath: string): string => {
    return encodeURIComponent(filePath);
  };

  const fetchAndSetFiles = async (token: string) => {
    setLoading(true);
    try {
      const fetchedFiles = await fetchFiles(token);
      setFiles(fetchedFiles);
    } catch {
      setError("Ошибка при загрузке файлов.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="container">
      <h1>Список файлов</h1>
      <div className="desktop-icon-container">
        {files.map((file) => (
          <div
            onClick={() => handleDocument(file.path)}
            className="desktop-icon"
            key={file.path}
          >
            <div className="file-icon">
              <img src="/icons/doc.png" alt={file.name} />
            </div>
            {file.name}
          </div>
        ))}
      </div>
    </div>
  );
};
