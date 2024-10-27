import React, { useEffect, useState, useCallback, useMemo } from "react";
import { GoogleApi } from "../../api/googleApi";
import FileTree from "../FileTree/fileTree";
import { File, getCookie } from "../../api/fileApi";
import Loader from "../../components/Loader/loader";
import { useNavigate } from "react-router-dom";
import "./fileExplorer.css";

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

  const oauthToken = getCookie("google_token");
  const navigate = useNavigate();
  const googleApi = useMemo(() => new GoogleApi(), []);

  const fetchFiles = useCallback(async () => {
    if (!oauthToken) {
      setLoading(false);
      return;
    }

    try {
      const fetchedFiles = await googleApi.fetchFiles(oauthToken, "root");
      setFiles(fetchedFiles);
    } finally {
      setLoading(false);
    }
  }, [googleApi, oauthToken]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Сохраняем состояние открытых папок при изменении
  useEffect(() => {
    localStorage.setItem(
      "googleOpenFolders",
      JSON.stringify(Array.from(openFolders))
    );
  }, [openFolders]);

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
            if (
              filteredChildren.length > 0 ||
              file.name.toLowerCase().includes(searchQuery)
            ) {
              return { ...file, children: filteredChildren };
            }
          } else if (
            file.name.toLowerCase().includes(searchQuery) &&
            (!showOnlySupported || isSupportedFormat(file.name, file.mime_type))
          ) {
            return file;
          }
          return undefined;
        })
        .filter((file): file is File => file !== undefined);
    },
    [searchQuery, showOnlySupported, isSupportedFormat]
  );

  const handleDeleteFile = useCallback((fileId: string) => {
    setFileToDelete(fileId);
    setShowDeleteDialog(true);
  }, []);

  const handleRenameFile = useCallback(
    async (fileId: string, newName: string) => {
      if (!oauthToken || isRenaming) return;

      setIsRenaming(true);
      try {
        const response = await googleApi.renameFile(
          fileId,
          newName,
          oauthToken
        );

        if (response.success) {
          const updatedFiles = await googleApi.fetchFiles(oauthToken, "root");
          setFiles(updatedFiles);
        }
      } finally {
        setIsRenaming(false);
      }
    },
    [oauthToken, isRenaming, googleApi]
  );

  const handleMoveFile = useCallback(
    async (sourceId: string, destinationId: string) => {
      if (!oauthToken || isMoving) return;

      setIsMoving(true);
      try {
        const response = await googleApi.moveFile(
          sourceId,
          destinationId,
          oauthToken
        );

        if (response.success) {
          const updatedFiles = await googleApi.fetchFiles(oauthToken, "root");
          setFiles(updatedFiles);
        }
      } finally {
        setIsMoving(false);
      }
    },
    [oauthToken, isMoving, googleApi]
  );

  const confirmDelete = useCallback(async () => {
    if (!fileToDelete || !oauthToken) return;

    setIsDeleting(true);
    try {
      const folderContents = await googleApi.fetchFiles(
        oauthToken,
        fileToDelete
      );

      await Promise.all(
        folderContents.map((file) =>
          googleApi.deleteFile(file.path, oauthToken)
        )
      );

      await googleApi.deleteFile(fileToDelete, oauthToken);

      setFiles((prevFiles) =>
        prevFiles.filter((file) => file.path !== fileToDelete)
      );

      if (activeFilePath === fileToDelete) {
        setActiveFilePath(null);
        onFileDeleted();
      }

      setShowDeleteDialog(false);
      setFileToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  }, [fileToDelete, oauthToken, googleApi, activeFilePath, onFileDeleted]);

  const cancelDelete = useCallback(() => {
    setShowDeleteDialog(false);
    setFileToDelete(null);
  }, []);

  const filteredFiles = filterFiles(files);

  return (
    <div className="file-explorer">
      {loading || isRenaming || isMoving ? (
        <Loader />
      ) : (
        <>
          <h1>Google Drive</h1>
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
            <p>Вы увере��ы, что хотите удалить этот файл?</p>
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
