import React, { useEffect, useState, useCallback, useMemo } from "react";
import { GoogleApi } from "../../api/googleApi";
import FileTree from "../FileTree/fileTree";
import { File, getCookie } from "../../api/fileApi";
import Loader from "../../components/Loader/loader";
import ExitBtn from "../../components/LogoutButton/exitBtn";
import { useNavigate } from "react-router-dom";
import "./fileExplorer.css";
import { InputModal } from "../InputModal/inputModal";

interface GoogleDriveExplorerProps {
  onFileDeleted: () => void;
}

export const GoogleDriveExplorer: React.FC<GoogleDriveExplorerProps> = ({
  onFileDeleted,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [openFolders, setOpenFolders] = useState<Set<string>>(() => {
    const savedOpenFolders = localStorage.getItem("googleOpenFolders");
    return savedOpenFolders ? new Set(JSON.parse(savedOpenFolders)) : new Set();
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlySupported, setShowOnlySupported] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState<{
    type: "file" | "folder";
    parentPath: string;
  } | null>(null);

  const oauthToken = getCookie("google_token");
  const navigate = useNavigate();
  const googleApi = useMemo(() => new GoogleApi(), []);

  const refreshFiles = useCallback(async () => {
    if (!oauthToken) return;
    
    try {
      setLoading(true);
      const workingFolder = await googleApi.getWorkingFolderContents(oauthToken);
      setFiles(workingFolder);
    } catch (error) {
      console.error("Error refreshing files:", error);
    } finally {
      setLoading(false);
    }
  }, [oauthToken, googleApi]);

  useEffect(() => {
    if (!isInitialized) {
      refreshFiles();
      setIsInitialized(true);
    }
  }, [isInitialized, refreshFiles]);

  useEffect(() => {
    localStorage.setItem(
      "googleOpenFolders",
      JSON.stringify(Array.from(openFolders))
    );
  }, [openFolders]);

  useEffect(() => {
    const checkFileExists = async () => {
      if (activeFilePath && oauthToken) {
        try {
          await googleApi.fetchFileMetadata(activeFilePath, oauthToken);
        } catch (error) {
          console.error("Файл не найден:", error);
          setActiveFilePath(null);
          navigate('/explorer/google');
        }
      }
    };

    checkFileExists();
  }, [activeFilePath, oauthToken, googleApi, navigate]);

  const handleFileClick = useCallback(
    (fileId: string) => {
      setActiveFilePath(fileId);
      navigate(`/explorer/google/${encodeURIComponent(fileId)}`);
    },
    [navigate]
  );

  const toggleFolder = useCallback((folderId: string) => {
    setOpenFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  }, []);

  const isSupportedFormat = useCallback(
    (fileName: string, mimeType: string) => {
      return mimeType === "text/plain" || fileName.endsWith(".txt");
    },
    []
  );

  const filterFiles = useCallback(
    (files: File[]): File[] => {
      return files
        .map((file) => {
          if (file.type === "dir") {
            const filteredChildren = filterFiles(file.children || []);
            return {
              ...file,
              children: filteredChildren.length > 0 ? filteredChildren : undefined,
            };
          }
          return file;
        })
        .filter((file) => {
          const matchesSearchQuery = file.name.toLowerCase().includes(searchQuery);
          if (file.type === "dir") {
            return (
              matchesSearchQuery || (file.children && file.children.length > 0)
            );
          }
          return (
            matchesSearchQuery &&
            (!showOnlySupported ||
              isSupportedFormat(file.name, file.mimeType || ""))
          );
        });
    },
    [searchQuery, showOnlySupported, isSupportedFormat]
  );

  const initiateDelete = useCallback((filePath: string) => {
    setFileToDelete(filePath);
    setShowDeleteDialog(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!oauthToken || !fileToDelete) return;

    try {
      setIsDeleting(true);
      const result = await googleApi.deleteFile(fileToDelete, oauthToken);
      if (result.success) {
        await refreshFiles();
        if (fileToDelete === activeFilePath) {
          setActiveFilePath(null);
          onFileDeleted();
        }
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setFileToDelete(null);
    }
  }, [oauthToken, googleApi, fileToDelete, activeFilePath, onFileDeleted, refreshFiles]);

  const handleRenameFile = useCallback(async (oldPath: string, newName: string) => {
    if (!oauthToken) return;

    try {
      setIsRenaming(true);
      const result = await googleApi.renameFile(oldPath, newName, oauthToken);
      if (result.success) {
        await refreshFiles();
      }
    } finally {
      setIsRenaming(false);
    }
  }, [oauthToken, googleApi, refreshFiles]);

  const handleMoveFile = useCallback(async (sourcePath: string, destinationPath: string) => {
    if (!oauthToken) return;

    try {
      setIsMoving(true);
      const result = await googleApi.moveFile(sourcePath, destinationPath, oauthToken);
      if (result.success) {
        await refreshFiles();
      }
    } finally {
      setIsMoving(false);
    }
  }, [oauthToken, googleApi, refreshFiles]);

  const handleCreateFolder = useCallback(async (parentPath: string) => {
    setShowCreateModal({ type: "folder", parentPath });
    return Promise.resolve();
  }, []);

  const handleCreateFile = useCallback(async (parentPath: string) => {
    setShowCreateModal({ type: "file", parentPath });
    return Promise.resolve();
  }, []);

  const handleCreateConfirm = useCallback(async (name: string) => {
    if (!showCreateModal || !oauthToken) return;

    try {
      setIsCreating(true);
      const fullPath = showCreateModal.parentPath === '/' 
        ? `/${name}` 
        : `${showCreateModal.parentPath}/${name}`;

      const result = await (showCreateModal.type === "folder" 
        ? googleApi.createFolder(fullPath, oauthToken)
        : googleApi.createFile(fullPath, oauthToken));
      
      if (result.success) {
        await refreshFiles();
      }
    } catch (error) {
      console.error(`Ошибка при создании ${showCreateModal.type === "file" ? "файла" : "папки"}:`, error);
    } finally {
      setIsCreating(false);
      setShowCreateModal(null);
    }
  }, [showCreateModal, oauthToken, googleApi, refreshFiles]);

  const filteredFiles = filterFiles(files);

  return (
    <div className="file-explorer">
      {loading || isRenaming || isMoving || isCreating ? (
        <Loader />
      ) : (
        <>
          <div className="header">
            <h1>Google Drive</h1>
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
            serviceType="google"
            files={filteredFiles}
            activeFilePath={activeFilePath}
            onFileClick={handleFileClick}
            openFolders={openFolders}
            toggleFolder={toggleFolder}
            onDeleteFile={initiateDelete}
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
            <div className="modal-buttons">
              <button 
                onClick={confirmDelete} 
                disabled={isDeleting}
                className="delete-button"
              >
                {isDeleting ? "Удаление..." : "Удалить"}
              </button>
              <button 
                onClick={() => {
                  setShowDeleteDialog(false);
                  setFileToDelete(null);
                }} 
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
          title={`Создать ${showCreateModal.type === "file" ? "файл" : "папку"}`}
          onConfirm={handleCreateConfirm}
          onCancel={() => setShowCreateModal(null)}
          isLoading={isCreating}
        />
      )}
    </div>
  );
};
