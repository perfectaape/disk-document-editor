import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../store/store";
import {
  setFiles,
  deleteFile,
  setActiveFilePath,
} from "../../store/fileActions";
import { YandexApi } from "../../api/yandexApi";
import FileTree from "../FileTree/fileTree";
import { File, getCookie } from "../../api/fileApi";
import Loader from "../../components/Loader/loader";
import "./fileExplorer.css";
import { useNavigate } from "react-router-dom";

interface YandexDiskExplorerProps {
  onFileDeleted: () => void;
}

export const YandexDiskExplorer: React.FC<YandexDiskExplorerProps> = ({
  onFileDeleted,
}) => {
  const { files, activeFilePath } = useSelector(
    (state: RootState) => state.fileState
  );
  const dispatch = useDispatch();
  const [openFolders, setOpenFolders] = useState<Set<string>>(() => {
    const savedOpenFolders = localStorage.getItem("openFolders");
    return savedOpenFolders ? new Set(JSON.parse(savedOpenFolders)) : new Set();
  });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showOnlySupported, setShowOnlySupported] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const oauthToken = getCookie("yandex_token");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFiles = async () => {
      if (!oauthToken) {
        console.error("OAuth token is missing");
        setLoading(false);
        return;
      }

      const yandexApi = new YandexApi();
      const fetchedFiles = await yandexApi.fetchFiles(oauthToken, "/");
      dispatch(setFiles(fetchedFiles));
      setLoading(false);
    };

    fetchFiles();
  }, [oauthToken, dispatch]);

  // Сохраняем состояние открытых папок при изменении
  useEffect(() => {
    localStorage.setItem(
      "openFolders",
      JSON.stringify(Array.from(openFolders))
    );
  }, [openFolders]);

  const handleFileClick = useCallback(
    (filePath: string) => {
      dispatch(setActiveFilePath(filePath));
      navigate(`/explorer/yandex/${encodeURIComponent(filePath)}`);
    },
    [navigate, dispatch]
  );

  const toggleFolder = useCallback((folderPath: string) => {
    setOpenFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value.toLowerCase());
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowOnlySupported(e.target.checked);
  };

  const isSupportedFormat = (fileName: string) => {
    return fileName.endsWith(".txt");
  };

  const filterFiles = (files: File[]): File[] => {
    return files
      .map((file) => {
        if (file.type === "dir") {
          const filteredChildren = filterFiles(file.children || []);
          if (
            filteredChildren.length > 0 ||
            file.name.toLowerCase().includes(searchQuery)
          ) {
            return { ...file, children: filteredChildren };
          }
        } else if (
          file.name.toLowerCase().includes(searchQuery) &&
          (!showOnlySupported || isSupportedFormat(file.name))
        ) {
          return file;
        }
        return undefined;
      })
      .filter((file): file is File => file !== undefined);
  };

  const handleDeleteFile = (filePath: string) => {
    setFileToDelete(filePath);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (fileToDelete && oauthToken) {
      setIsDeleting(true);
      const yandexApi = new YandexApi();
      try {
        const folderContents = await yandexApi.fetchFiles(
          oauthToken,
          fileToDelete
        );

        for (const file of folderContents) {
          await yandexApi.deleteFile(file.path, oauthToken);
        }

        const response = await yandexApi.deleteFile(fileToDelete, oauthToken);

        if (response.success) {
          dispatch(deleteFile(fileToDelete));
          if (activeFilePath === fileToDelete) {
            dispatch(setActiveFilePath(null));
            onFileDeleted();
          }
          setShowDeleteDialog(false);
          setFileToDelete(null);
        } else {
          console.error("Ошибка при удалении файла на сервере");
        }
      } catch (error) {
        console.error("Ошибка при удалении файла:", error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleRenameFile = async (oldPath: string, newPath: string) => {
    if (!oauthToken) return;

    setIsRenaming(true);
    const yandexApi = new YandexApi();

    try {
      // Убедимся, что пути не содержат лишних префиксов
      const cleanOldPath = oldPath.replace(/^disk:\//g, "");
      const cleanNewPath = newPath.replace(/^disk:\//g, "");

      console.log("Old path:", cleanOldPath);
      console.log("New path:", cleanNewPath);

      const response = await yandexApi.renameFile(
        cleanOldPath,
        cleanNewPath,
        oauthToken
      );

      if (response.success) {
        const updatedFiles = await yandexApi.fetchFiles(oauthToken, "/");
        dispatch(setFiles(updatedFiles));
      } else {
        console.error("Ошибка при переименовании файла");
      }
    } catch (error) {
      console.error("Ошибка при переименовании файла:", error);
    } finally {
      setIsRenaming(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
    setFileToDelete(null);
  };

  const handleMoveFile = async (
    sourcePath: string,
    destinationPath: string
  ) => {
    if (!oauthToken) return;

    setLoading(true);
    const yandexApi = new YandexApi();

    try {
      // 1. Очищаем пути
      const cleanSourcePath = sourcePath
        .replace(/^disk:\//g, "")
        .replace(/^\/+/, "");
      const targetDir = destinationPath
        .replace(/^disk:\//g, "")
        .replace(/^\/+/, "");

      // 2. Разбираем исходный путь
      const sourcePathParts = cleanSourcePath.split("/");

      // 3. Проверяем, перемещаем ли мы файл вверх по дереву
      const isMovingUp =
        cleanSourcePath.includes("/") &&
        (!targetDir ||
          targetDir.split("/").length < sourcePathParts.length - 1);

      // 4. Формируем конечный путь
      const finalDestinationPath = isMovingUp
        ? targetDir // Если перемещаем вверх, используем только целевую директорию
        : `${targetDir}`; // Если вниз или на том же уровне

      console.log("Moving file - detailed info:");
      console.log("Source path:", cleanSourcePath);
      console.log("Target directory:", targetDir);
      console.log("Is moving up:", isMovingUp);
      console.log("Final destination:", finalDestinationPath);

      // Передаем destinationPath как есть, без добавления имени файла
      const response = await yandexApi.moveFile(
        cleanSourcePath,
        finalDestinationPath, // Можно пустой строкой
        oauthToken
      );

      if (response.success) {
        const updatedFiles = await yandexApi.fetchFiles(oauthToken, "/");
        dispatch(setFiles(updatedFiles));
      } else {
        console.error("Ошибка при перемещении файла:", response);
      }
    } catch (error) {
      console.error("Error moving file:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFiles = filterFiles(files);

  return (
    <div className="file-explorer">
      {loading || isRenaming ? (
        <Loader />
      ) : (
        <>
          <h1>Яндекс Диск</h1>
          <input
            type="text"
            placeholder="Поиск файлов..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="search-input"
          />
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showOnlySupported}
              onChange={handleCheckboxChange}
            />
            Показать только поддерживаемые файлы
          </label>
          <FileTree
            files={filteredFiles}
            activeFilePath={activeFilePath}
            onFileClick={handleFileClick}
            openFolders={openFolders}
            toggleFolder={toggleFolder}
            onDeleteFile={handleDeleteFile}
            onRenameFile={handleRenameFile}
            onMoveFile={handleMoveFile}
          />
        </>
      )}
      {showDeleteDialog && (
        <div className="modal">
          <div className="modal-content">
            <h2>Подтверждение удаления</h2>
            <p>Вы уверены, что хотите удалить этот файл?</p>
            <button onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? "Удаление..." : "Удалить"}
            </button>
            <button onClick={cancelDelete} disabled={isDeleting}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
