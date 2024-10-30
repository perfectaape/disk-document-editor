import React, { useEffect, useState, useCallback, useMemo } from "react";
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
import ExitBtn from "../../components/LogoutButton/exitBtn";
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
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const oauthToken = getCookie("yandex_token");
  const navigate = useNavigate();
  const yandexApi = useMemo(() => new YandexApi(), []);

  const fetchFiles = useCallback(async () => {
    if (!oauthToken) {
      setLoading(false);
      return;
    }

    try {
      const fetchedFiles = await yandexApi.fetchFiles(oauthToken, "disk:/");
      dispatch(setFiles(fetchedFiles));
    } finally {
      setLoading(false);
    }
  }, [yandexApi, oauthToken, dispatch]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    localStorage.setItem(
      "openFolders",
      JSON.stringify(Array.from(openFolders))
    );
  }, [openFolders]);

  useEffect(() => {
    const checkFileExists = async () => {
      if (activeFilePath && oauthToken) {
        try {
          await yandexApi.fetchFileMetadata(
            activeFilePath.replace(/^disk:\//g, ""),
            oauthToken
          );
        } catch (error) {
          console.error("Файл не найден:", error);
          dispatch(setActiveFilePath(null));
          navigate('/explorer/yandex');
        }
      }
    };

    checkFileExists();
  }, [activeFilePath, oauthToken, yandexApi, navigate, dispatch]);

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

  const isSupportedFormat = useCallback(
    (fileName: string, mime_type: string) => {
      return mime_type === "text/plain" || fileName.endsWith(".txt");
    },
    []
  );

  const filterFiles = useCallback(
    (files: File[]): File[] => {
      return files
        .map((file) => {
          if (file.type === "dir") {
            const filteredChildren = filterFiles(file.children || []);
            return filteredChildren.length > 0 ? { ...file, children: filteredChildren } : null;
          }
          return file;
        })
        .filter((file): file is File => {
          if (!file) return false;
          const matchesSearchQuery = file.name.toLowerCase().includes(searchQuery);
          if (file.type === "dir") {
            return matchesSearchQuery || ((file.children ?? []).length > 0);
          }
          return (
            matchesSearchQuery &&
            (!showOnlySupported || isSupportedFormat(file.name, file.mime_type || ""))
          );
        });
    },
    [isSupportedFormat, showOnlySupported, searchQuery]
  );

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
      const cleanOldPath = oldPath.replace(/^disk:\//g, "");
      const cleanNewPath = newPath.replace(/^disk:\//g, "");

      const response = await yandexApi.renameFile(
        cleanOldPath,
        cleanNewPath,
        oauthToken
      );

      if (response.success) {
        if (activeFilePath === `disk:/${cleanOldPath}`) {
          dispatch(setActiveFilePath(null));
          onFileDeleted();
          navigate('/explorer/yandex');
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
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

  const handleMoveFile = async (
    sourcePath: string,
    destinationPath: string
  ) => {
    if (!oauthToken) return;

    setLoading(true);
    const yandexApi = new YandexApi();

    try {
      const cleanSourcePath = sourcePath
        .replace(/^disk:\//g, "")
        .replace(/^\/+/, "");
      const targetDir = destinationPath
        .replace(/^disk:\//g, "")
        .replace(/^\/+/, "");

      const isMovingUp =
        cleanSourcePath.includes("/") &&
        (!targetDir ||
          targetDir.split("/").length < cleanSourcePath.split("/").length - 1);

      const finalDestinationPath = isMovingUp ? targetDir : `${targetDir}`;

      const response = await yandexApi.moveFile(
        cleanSourcePath,
        finalDestinationPath,
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

  const handleCreateFolder = async (parentPath: string) => {
    if (!oauthToken) return;

    const yandexApi = new YandexApi();
    try {
      const folderName = prompt("Введите имя новой папки:");
      if (folderName) {
        setIsCreating(true);
        const newFolderPath =
          parentPath === "disk:/"
            ? `disk:/${folderName}`
            : `${parentPath}/${folderName}`;
        const response = await yandexApi.createFolder(
          newFolderPath,
          oauthToken
        );
        if (response.success) {
          const updatedFiles = await yandexApi.fetchFiles(oauthToken, "/");
          dispatch(setFiles(updatedFiles));
        } else {
          console.error("Ошибка при создании папки");
        }
      }
    } catch (error) {
      console.error("Ошибка при создании папки:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateFile = async (parentPath: string) => {
    if (!oauthToken) return;

    const yandexApi = new YandexApi();
    try {
      const fileName = prompt("Введите имя нового файла (.txt):");
      if (fileName && fileName.endsWith(".txt")) {
        setIsCreating(true);
        const newFilePath =
          parentPath === "disk:/"
            ? `disk:/${fileName}`
            : `${parentPath}/${fileName}`;
        const response = await yandexApi.createFile(newFilePath, oauthToken);
        if (response.success) {
          const updatedFiles = await yandexApi.fetchFiles(oauthToken, "/");
          dispatch(setFiles(updatedFiles));
        } else {
          console.error("Ошибка при создании файла");
        }
      } else {
        alert("Имя файла должно заканчиваться на .txt");
      }
    } catch (error) {
      console.error("Ошибка при создании файла:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
    setFileToDelete(null);
  };

  const filteredFiles = filterFiles(files);

  return (
    <div className="file-explorer">
      {loading || isRenaming || isCreating ? (
        <Loader />
      ) : (
        <>
          <div className="header">
            <h1>Яндекс Диск</h1>
            <ExitBtn />
          </div>
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
            onCreateFolder={handleCreateFolder}
            onCreateFile={handleCreateFile}
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
