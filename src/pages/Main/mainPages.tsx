import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCookie } from "../../api/yandexApi";

export const MainPages: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (getCookie("yandex_token")) navigate("/editor");
  }, [navigate]);

  const handleLogin = (): void => {
    const clientId: string = import.meta.env.VITE_YANDEX_CLIENT_ID;
    const redirectUri: string = import.meta.env.VITE_YANDEX_REDIRECT_URI;
    const authUrl: string = `https://oauth.yandex.ru/authorize?response_type=token&client_id=${clientId}&redirect_uri=${redirectUri}`;
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
        Перед началом необходимо получить токены доступа, нажам на кнопку
      </p>
      <button className="start-btn" onClick={handleLogin}>
        Войти
      </button>
    </div>
  );
};
