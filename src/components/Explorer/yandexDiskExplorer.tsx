import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../store/store";
import { setFiles, setActiveFilePath } from "../../store/fileActions";
import { YandexApi } from "../../api/yandexApi";
import FileTree from "../FileTree/fileTree";
import { File, getCookie } from "../../api/fileApi";
import Loader from "../../components/Loader/loader";
import ExitBtn from "../../components/LogoutButton/exitBtn";
import "./fileExplorer.css";
import { useNavigate } from "react-router-dom";
import { InputModal } from "../InputModal/inputModal";

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
  const [filteredFileList, setFilteredFileList] = useState<File[]>([]);
  const [showCreateModal, setShowCreateModal] = useState<{
    type: "file" | "folder";
    parentPath: string;
  } | null>(null);

  const cleanPath = (path: string): string => {
    if (!path || path === "/") return "app:/";

    const cleanPath = path
      .replace(/^.*Приложения\/Тестовое-Диск\/?/, "")
      .replace(/^\/+/, "");

    if (cleanPath.startsWith("app:/")) {
      return cleanPath;
    }

    return `app:/${cleanPath}`;
  };

  const fetchFiles = useCallback(async () => {
    if (!oauthToken) {
      setLoading(false);
      return;
    }

    try {
      const fetchedFiles = await yandexApi.fetchFiles(oauthToken, "app:/");
      dispatch(setFiles([...fetchedFiles]));
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
          navigate("/explorer/yandex");
        }
      }
    };

    checkFileExists();
  }, [activeFilePath, oauthToken, yandexApi, navigate, dispatch]);

  const handleFileClick = useCallback(
    (filePath: string) => {
      const cleanedPath = cleanPath(filePath);
      dispatch(setActiveFilePath(cleanedPath));
      navigate(`/explorer/yandex/${encodeURIComponent(cleanedPath)}`);
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

  const isSupportedFormat = useCallback(
    (fileName: string, mime_type: string) => {
      return mime_type === "text/plain" || fileName.endsWith(".txt");
    },
    []
  );

  const filterFiles = useCallback(
    (files: File[]): File[] => {
      const filter = (items: File[]): File[] => {
        return items.reduce((acc: File[], file) => {
          const normalizedSearchQuery = searchQuery.trim().toLowerCase();
          const normalizedFileName = file.name.trim().toLowerCase();

          const matchesSearch =
            !normalizedSearchQuery ||
            normalizedFileName.includes(normalizedSearchQuery);

          const isSupported =
            !showOnlySupported ||
            file.type === "dir" ||
            isSupportedFormat(file.name, file.mime_type || "");

          if (
            file.type === "dir" &&
            file.children &&
            file.children.length > 0
          ) {
            const filteredChildren = filter(file.children);
            if (filteredChildren.length > 0) {
              acc.push({
                ...file,
                children: filteredChildren,
              });
            }
          } else if (matchesSearch && isSupported) {
            acc.push(file);
          }

          return acc;
        }, []);
      };

      return filter(files);
    },
    [searchQuery, showOnlySupported, isSupportedFormat]
  );

  useEffect(() => {
    const filtered = filterFiles(files);
    setFilteredFileList(filtered);
  }, [files, searchQuery, showOnlySupported, filterFiles]);

  const handleDeleteFile = useCallback((filePath: string) => {
    setFileToDelete(cleanPath(filePath));
    setShowDeleteDialog(true);
    const event = new CustomEvent("clearFolderCache", {
      detail: { path: filePath },
    });
    window.dispatchEvent(event);
  }, []);

  const confirmDelete = async () => {
    if (fileToDelete && oauthToken) {
      setIsDeleting(true);
      try {
        const folderContents = await yandexApi.fetchFiles(
          oauthToken,
          cleanPath(fileToDelete)
        );

        for (const file of folderContents) {
          await yandexApi.deleteFile(cleanPath(file.path), oauthToken);
        }

        const response = await yandexApi.deleteFile(
          cleanPath(fileToDelete),
          oauthToken
        );

        if (response.success) {
          if (activeFilePath === fileToDelete) {
            dispatch(setActiveFilePath(null));
            onFileDeleted();
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));

          const updatedFiles = await yandexApi.fetchFiles(oauthToken, "app:/");
          dispatch(setFiles(updatedFiles));

          setShowDeleteDialog(false);
          setFileToDelete(null);
        }
      } catch (error) {
        console.error("Ошибка при удалении файла:", error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleRenameFile = useCallback(
    async (oldPath: string, newPath: string) => {
      if (!oauthToken) return;

      setIsRenaming(true);
      try {
        const response = await yandexApi.renameFile(
          oldPath,
          newPath,
          oauthToken
        );

        if (response.success) {
          const event = new CustomEvent("clearFolderCache", {
            detail: { path: oldPath },
          });
          window.dispatchEvent(event);

          if (activeFilePath === oldPath) {
            dispatch(setActiveFilePath(null));
            onFileDeleted();
            navigate("/explorer/yandex");
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
          const updatedFiles = await yandexApi.fetchFiles(oauthToken, "app:/");
          dispatch(setFiles([...updatedFiles]));
        }
      } catch (error) {
        console.error("Ошибка при переименовании файла:", error);
      } finally {
        setIsRenaming(false);
      }
    },
    [oauthToken, yandexApi, activeFilePath, dispatch, navigate, onFileDeleted]
  );

  const handleMoveFile = useCallback(
    async (sourcePath: string, destinationPath: string) => {
      if (!oauthToken) return;

      setLoading(true);
      try {
        const response = await yandexApi.moveFile(
          sourcePath,
          destinationPath,
          oauthToken
        );

        if (response.success) {
          const event = new CustomEvent("clearFolderCache", {
            detail: {
              path: sourcePath,
              destinationPath: destinationPath,
            },
          });
          window.dispatchEvent(event);

          const updatedFiles = await yandexApi.fetchFiles(oauthToken, "app:/");
          dispatch(setFiles([...updatedFiles]));
        }
      } catch (error) {
        console.error("Error moving file:", error);
      } finally {
        setLoading(false);
      }
    },
    [oauthToken, yandexApi, dispatch]
  );

  const handleCreateFolder = async (parentPath: string) => {
    setShowCreateModal({ type: "folder", parentPath });
  };

  const handleCreateFile = async (parentPath: string) => {
    setShowCreateModal({ type: "file", parentPath });
  };

  const handleCreateConfirm = async (name: string) => {
    if (!showCreateModal || !oauthToken) return;

    try {
      setIsCreating(true);
      const basePath = cleanPath(showCreateModal.parentPath);
      const newPath =
        basePath === "app:/" ? `app:/${name}` : `${basePath}/${name}`;

      const response = await yandexApi.createResource(
        newPath,
        oauthToken,
        showCreateModal.type === "folder" ? "dir" : "file"
      );

      if (response.success) {
        const updatedFiles = await yandexApi.fetchFiles(oauthToken, "app:/");
        dispatch(setFiles(updatedFiles));
      }
    } catch (error) {
      console.error(
        `Ошибка при создании ${
          showCreateModal.type === "file" ? "файла" : "папки"
        }:`,
        error
      );
    } finally {
      setIsCreating(false);
      setShowCreateModal(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
    setFileToDelete(null);
  };

  return (
    <div className="file-explorer">
      {loading || isRenaming || isCreating || isDeleting ? (
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
            onChange={(e) => setSearchQuery(e.target.value.toLowerCase())}
            className="search-input"
          />
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showOnlySupported}
              onChange={(e) => setShowOnlySupported(e.target.checked)}
            />
            Показать только поддерживаемые файлы
          </label>
          <FileTree
            files={filteredFileList}
            activeFilePath={activeFilePath}
            onFileClick={handleFileClick}
            openFolders={openFolders}
            toggleFolder={toggleFolder}
            onDeleteFile={handleDeleteFile}
            onRenameFile={handleRenameFile}
            onMoveFile={handleMoveFile}
            onCreateFolder={handleCreateFolder}
            onCreateFile={handleCreateFile}
            serviceType="yandex"
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
      {showCreateModal && (
        <InputModal
          title={`Создать ${
            showCreateModal.type === "file" ? "файл" : "папку"
          }`}
          onConfirm={handleCreateConfirm}
          onCancel={() => setShowCreateModal(null)}
          isLoading={isCreating}
        />
      )}
    </div>
  );
};
