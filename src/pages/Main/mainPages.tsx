import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCookie } from "../../api/fileApi";

export const MainPages: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const yandexToken = getCookie("yandex_token");
    const googleToken = getCookie("google_token");

    if (yandexToken || googleToken) {
      navigate("/editor");
    }
  }, [navigate]);

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

  return (
    <div className="main-text">
      <h1>
        Это небольшой редактор тектовых
        <br />
        документов из Яндекс.Диск
      </h1>
      <p className="subtittle">
        Перед началом необходимо получить токены доступа, нажав на кнопку
      </p>
      <button className="start-btn" onClick={handleYandexLogin}>
        Войти через Яндекс
      </button>
      <button className="start-btn" onClick={handleGoogleLogin}>
        Войти через Google
      </button>
    </div>
  );
};
