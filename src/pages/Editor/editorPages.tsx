// import React, { useEffect, useState, useCallback } from "react";
// import { useNavigate } from "react-router-dom";
// import Loader from "../../components/Loader/loader";
// import "./editorPages.css";
// import { getCookie, File, Service } from "../../api/fileApi";
// import { CloudServiceFactory } from "../../api/fileApi";
// import { PathUtils } from "../../utils/pathutils";
// import { DocumentHead } from "../../components/Documents/documentHead";
// import { DocumentBody } from "../../components/Documents/documentBody";

// export const EditorPages: React.FC = () => {
//   const [files, setFiles] = useState<File[]>([]);
//   const [loading, setLoading] = useState<boolean>(true);
//   const [error, setError] = useState<string | null>(null);
//   const [activeService, setActiveService] = useState<Service | null>(null);
//   const [currentPath, setCurrentPath] = useState<string>("root");
//   const [idToNameMap, setIdToNameMap] = useState<Record<string, string>>({});

//   const navigate = useNavigate();

//   const fetchAndSetFiles = useCallback(
//     async (token: string, service: Service, path: string) => {
//       setLoading(true);
//       try {
//         const api = CloudServiceFactory.create(service);
//         const fetchedFiles = await api.fetchFiles(token, path);
//         setFiles(fetchedFiles);

//         if (service === "google") {
//           const newMap = fetchedFiles.reduce((map, file) => {
//             if (file.id && file.name) {
//               map[file.id] = file.name;
//             }
//             return map;
//           }, {} as Record<string, string>);
//           setIdToNameMap((prevMap) => ({ ...prevMap, ...newMap }));
//         }

//         setCurrentPath(path);
//       } catch (error) {
//         console.error("Ошибка при загрузке файлов:", error);
//         setError(`Ошибка при загрузке файлов`);
//       } finally {
//         setLoading(false);
//       }
//     },
//     []
//   );

//   useEffect(() => {
//     const loadFiles = async () => {
//       const yandexToken = getCookie(`yandex_token`);
//       const googleToken = getCookie(`google_token`);

//       if (!yandexToken && !googleToken) {
//         navigate("/", { replace: true });
//         return;
//       }

//       const savedService = localStorage.getItem("activeService");
//       const service: Service =
//         savedService === "yandex" || savedService === "google"
//           ? savedService
//           : yandexToken
//           ? "yandex"
//           : "google";

//       setActiveService(service);
//       localStorage.setItem("activeService", service);

//       const token = service === "yandex" ? yandexToken : googleToken;
//       const initialPath = PathUtils.getRootPath(service);

//       if (token) {
//         await fetchAndSetFiles(token, service, initialPath);
//       } else {
//         redirectToAuth(service);
//       }
//     };

//     loadFiles();
//   }, [navigate, fetchAndSetFiles]);

//   const redirectToAuth = (service: Service) => {
//     const clientId =
//       service === "yandex"
//         ? import.meta.env.VITE_YANDEX_CLIENT_ID
//         : import.meta.env.VITE_GOOGLE_CLIENT_ID;
//     const redirectUri = import.meta.env.VITE_REDIRECT_URI;
//     const authUrl =
//       service === "yandex"
//         ? `https://oauth.yandex.ru/authorize?response_type=token&client_id=${clientId}&redirect_uri=${redirectUri}&state=yandex`
//         : `https://accounts.google.com/o/oauth2/v2/auth?response_type=token&client_id=${clientId}&redirect_uri=${redirectUri}&scope=https://www.googleapis.com/auth/drive&state=google`;

//     window.location.href = authUrl;
//   };

//   const goBackOneLevel = useCallback(async () => {
//     if (activeService) {
//       const token = getCookie(`${activeService}_token`);
//       if (token) {
//         const newPath = PathUtils.goBackOneLevel(currentPath, activeService);
//         await fetchAndSetFiles(token, activeService, newPath);
//       } else {
//         redirectToAuth(activeService);
//       }
//     }
//   }, [activeService, currentPath, fetchAndSetFiles]);

//   const handleServiceChange = (newService: Service) => {
//     setActiveService(newService);
//     localStorage.setItem("activeService", newService);
//     const token = getCookie(`${newService}_token`);
//     const initialPath = PathUtils.getRootPath(newService);
//     if (token) {
//       fetchAndSetFiles(token, newService, initialPath);
//     } else {
//       redirectToAuth(newService);
//     }
//   };

//   const handleFolderClick = async (folderPath: string) => {
//     if (activeService) {
//       const token = getCookie(`${activeService}_token`);
//       if (token) {
//         await fetchAndSetFiles(token, activeService, folderPath);
//       } else {
//         redirectToAuth(activeService);
//       }
//     }
//   };

//   if (loading) {
//     return <Loader />;
//   }

//   if (error) {
//     return <div className="error-message">{error}</div>;
//   }

//   return (
//     <div className="container-docs">
//       <h1>Список файлов</h1>
//       <div>
//         Current Path:{" "}
//         {PathUtils.formatPathForDisplay(
//           currentPath,
//           activeService!,
//           idToNameMap
//         )}
//       </div>
//       {currentPath !== PathUtils.getRootPath(activeService!) && (
//         <button onClick={goBackOneLevel}>Вернуться на уровень выше</button>
//       )}
//       <DocumentHead
//         handleServiceChange={handleServiceChange}
//         services={{
//           yandex: { title: "Yandex", status: "active" },
//           google: { title: "Google", status: "active" },
//         }}
//         activeService={activeService}
//       />
//       <DocumentBody
//         files={files}
//         activeService={activeService}
//         onFolderClick={handleFolderClick}
//       />
//     </div>
//   );
// };
