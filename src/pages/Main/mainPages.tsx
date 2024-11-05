import React from "react";

export const MainPages: React.FC = () => {
  const handleYandexLogin = (): void => {
    const clientId: string = import.meta.env.VITE_YANDEX_CLIENT_ID;
    const redirectUri: string = import.meta.env.VITE_REDIRECT_URI;
    const scope: string = "cloud_api:disk.app_folder";
    const authUrl: string = `https://oauth.yandex.ru/authorize?response_type=token&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=yandex`;
    window.location.href = authUrl;
  };

  const handleGoogleLogin = (): void => {
    const clientId: string = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri: string = import.meta.env.VITE_REDIRECT_URI;

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

    const params = {
      response_type: "token",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "https://www.googleapis.com/auth/drive.file",
      state: "google",
      include_granted_scopes: "false",
      prompt: "consent",
      access_type: "online",
    };

    Object.entries(params).forEach(([key, value]) => {
      authUrl.searchParams.append(key, value);
    });

    window.location.href = authUrl.toString();
  };

  return (
    <div className="main-text">
      <h1>Это небольшой редактор тектовых файлов</h1>
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
