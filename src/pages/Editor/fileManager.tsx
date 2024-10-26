import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { GoogleDriveExplorer } from "../../components/Explorer/googleDriveExplorer";
import { YandexDiskExplorer } from "../../components/Explorer/yandexDiskExplorer";
import { Editor } from "./editor";
import { getCookie } from "../../api/fileApi";
import Loader from "../../components/Loader/loader";
import "./fileManager.css";

export const FileManager: React.FC = () => {
  const { service, filePath } = useParams<{
    service: "google" | "yandex";
    filePath?: string;
  }>();
  const [showModal, setShowModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFileDeleted, setIsFileDeleted] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    const yandexToken = getCookie("yandex_token");
    const googleToken = getCookie("google_token");

    if (
      (service === "yandex" && !yandexToken) ||
      (service === "google" && !googleToken)
    ) {
      setShowModal(true);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [service]);

  const handleCloseModal = () => {
    setShowModal(false);
    navigate("/");
  };

  const handleYandexLogin = (): void => {
    const clientId: string = import.meta.env.VITE_YANDEX_CLIENT_ID;
    const redirectUri: string = import.meta.env.VITE_REDIRECT_URI;
    const authUrl: string = `https://oauth.yandex.ru/authorize?response_type=token&client_id=${clientId}&redirect_uri=${redirectUri}&state=yandex`;
    window.location.href = authUrl;
  };

  const handleGoogleLogin = (): void => {
    const clientId: string = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri: string = import.meta.env.VITE_REDIRECT_URI;
    const authUrl: string = `https://accounts.google.com/o/oauth2/v2/auth?response_type=token&client_id=${clientId}&redirect_uri=${redirectUri}&scope=https://www.googleapis.com/auth/drive&state=google`;
    window.location.href = authUrl;
  };

  const handleFileDeleted = () => {
    setIsFileDeleted(true);
  };

  useEffect(() => {
    if (filePath) {
      setIsFileDeleted(false); // Reset the deleted state when a new file is opened
    }
  }, [filePath]);

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="file-manager">
      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Ошибка аутентификации</h2>
            <p>Токен доступа отсутствует. Пожалуйста, войдите в систему.</p>
            <button className="start-btn" onClick={handleYandexLogin}>
              Войти через Яндекс
            </button>
            <button className="start-btn" onClick={handleGoogleLogin}>
              Войти через Google
            </button>
            <button onClick={handleCloseModal}>Закрыть</button>
          </div>
        </div>
      )}
      <div className="explorer-container">
        {service === "google" ? (
          <GoogleDriveExplorer onFileDeleted={handleFileDeleted} />
        ) : (
          <YandexDiskExplorer onFileDeleted={handleFileDeleted} />
        )}
      </div>
      <div>
        {filePath ? (
          <Editor isFileDeleted={isFileDeleted} />
        ) : (
          <div className="select-file-message">
            Выберите файл для редактирования
          </div>
        )}
      </div>
    </div>
  );
};
