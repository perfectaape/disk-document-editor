import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../store/store";
import { setFiles, setActiveFilePath } from "../../store/fileActions";
import { YandexApi } from "../../api/yandexApi";
import FileTree from "../FileTree/fileTree";
import { File as CustomFile, getCookie } from "../../api/fileApi";
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
  const [filteredFileList, setFilteredFileList] = useState<CustomFile[]>([]);
  const [showCreateModal, setShowCreateModal] = useState<{
    type: "file" | "folder";
    parentPath: string;
  } | null>(null);
  const [showRenameModal, setShowRenameModal] = useState<{
    path: string;
    currentName: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

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
    (files: CustomFile[]): CustomFile[] => {
      const filter = (items: CustomFile[]): CustomFile[] => {
        return items.reduce((acc: CustomFile[], file) => {
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

  const handleRenameFile = useCallback((oldPath: string, currentName: string) => {
    setShowRenameModal({ path: oldPath, currentName });
  }, []);

  const handleRenameConfirm = useCallback(async (newName: string) => {
    if (!showRenameModal || !oauthToken) return;

    try {
      setIsRenaming(true);
      const response = await yandexApi.renameFile(
        showRenameModal.path,
        newName,
        oauthToken
      );

      if (response.success) {
        const event = new CustomEvent("clearFolderCache", {
          detail: { path: showRenameModal.path },
        });
        window.dispatchEvent(event);

        if (activeFilePath === showRenameModal.path) {
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
      setShowRenameModal(null);
    }
  }, [showRenameModal, oauthToken, yandexApi, activeFilePath, dispatch, navigate, onFileDeleted]);

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

  const handleUploadFile = useCallback(async (parentPath: string, file: globalThis.File) => {
    if (!oauthToken) return;

    try {
      setIsUploading(true);
      const result = await yandexApi.uploadFile(oauthToken, parentPath, file);
      
      if (result.success) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const updatedFiles = await yandexApi.fetchFiles(oauthToken, "app:/");
        dispatch(setFiles(updatedFiles));
      }
    } catch (error) {
      console.error("Error uploading file:", error);
    } finally {
      setIsUploading(false);
    }
  }, [oauthToken, yandexApi, dispatch]);

  return (
    <div className="file-explorer">
      {loading || isRenaming || isCreating || isDeleting || isUploading ? (
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
            onUploadFile={handleUploadFile}
            serviceType="yandex"
          />
        </>
      )}
      {showDeleteDialog && (
        <div className="modal">
          <div className="modal-content">
            <h2>Подтверждение удаления</h2>
            <p>Вы уверены, что хотите удалить этот файл?</p>
            <div className="modal-buttons">
              <button 
                onClick={confirmDelete} 
                disabled={isDeleting}
                className="delete-button"
              >
                {isDeleting ? "Удаление..." : "Удалить"}
              </button>
              <button 
                onClick={cancelDelete} 
                disabled={isDeleting}
                className="cancel-button"
              >
                Отмена
              </button>
            </div>
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
      {showRenameModal && (
        <InputModal
          title="Переименовать файл"
          defaultValue={showRenameModal.currentName}
          onConfirm={handleRenameConfirm}
          onCancel={() => setShowRenameModal(null)}
          isLoading={isRenaming}
        />
      )}
    </div>
  );
};
