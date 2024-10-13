import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Loader from "../../components/Loader/loader";
import "./editorPages.css";
import { getCookie, File } from "../../api/fileApi";
import { YandexApi } from "../../api/yandexApi";
import { GoogleApi } from "../../api/googleApi";
import { DocumentHead } from "../../components/Documents/documentHead";
import { DocumentBody } from "../../components/Documents/documentBody";

export type Service = "yandex" | "google";

export interface ServiceInfo {
  title: string;
  status: string;
}

export const EditorPages: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<Record<Service, ServiceInfo>>({
    yandex: { title: "Яндекс", status: "disabled" },
    google: { title: "Google", status: "disabled" },
  });
  const [activeService, setActiveService] = useState<Service | null>(null);

  const yandexApi = useMemo(() => new YandexApi(), []);
  const googleApi = useMemo(() => new GoogleApi(), []);
  const navigate = useNavigate();

  const fetchAndSetFiles = useCallback(
    async (token: string, service: Service) => {
      setLoading(true);
      try {
        const fetchedFiles =
          service === "yandex"
            ? await yandexApi.fetchFiles(token)
            : await googleApi.fetchFiles(token);
        setFiles(fetchedFiles);
      } catch (error) {
        console.error("Ошибка при загрузке файлов:", error);
        setError(`Ошибка при загрузке файлов`);
      } finally {
        setLoading(false);
      }
    },
    [yandexApi, googleApi]
  );

  useEffect(() => {
    const loadFiles = async () => {
      const yandexToken = getCookie(`yandex_token`);
      const googleToken = getCookie(`google_token`);

      if (!yandexToken && !googleToken) {
        navigate("/");
        return;
      }

      const service = yandexToken ? "yandex" : "google";
      setActiveService(service);
      const token = yandexToken || googleToken;

      setServices((prevServices) => ({
        yandex: {
          ...prevServices.yandex,
          status: yandexToken ? "active" : "disabled",
        },
        google: {
          ...prevServices.google,
          status: googleToken ? "active" : "disabled",
        },
      }));

      if (token) {
        await fetchAndSetFiles(token, service);
      } else {
        setError("Отсутствует токен для активного сервиса.");
      }
    };

    loadFiles();
  }, [navigate, fetchAndSetFiles]);

  const handleServiceChange = useCallback(
    async (newService: Service) => {
      const token = getCookie(`${newService}_token`);
      if (!token) {
        const clientId: string = import.meta.env[
          `VITE_${newService.toUpperCase()}_CLIENT_ID`
        ];
        const redirectUri: string = import.meta.env.VITE_REDIRECT_URI;
        const authUrl: string =
          newService === "yandex"
            ? `https://oauth.yandex.ru/authorize?response_type=token&client_id=${clientId}&redirect_uri=${redirectUri}&state=yandex`
            : `https://accounts.google.com/o/oauth2/v2/auth?response_type=token&client_id=${clientId}&redirect_uri=${redirectUri}&scope=https://www.googleapis.com/auth/drive&state=google`;
        window.location.href = authUrl;
      } else {
        try {
          setServices((prevServices) => ({
            ...prevServices,
            [newService]: { ...prevServices[newService], status: "active" },
          }));
          setActiveService(newService);
          await fetchAndSetFiles(token, newService);
        } catch (error) {
          console.error(
            `Ошибка при загрузке файлов для сервиса ${newService}:`,
            error
          );
          setError(`Ошибка при загрузке файлов для сервиса ${newService}.`);
        }
      }
    },
    [fetchAndSetFiles]
  );

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="container-docs">
      <h1>Список файлов</h1>
      <DocumentHead
        handleServiceChange={handleServiceChange}
        services={services}
        activeService={activeService}
      />
      <DocumentBody files={files} activeService={activeService} />
    </div>
  );
};
