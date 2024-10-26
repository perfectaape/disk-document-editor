import React, { useEffect, useState, useCallback } from "react";
import { GoogleApi } from "../../api/googleApi";
import FileTree from "../FileTree/fileTree";
import { File, getCookie } from "../../api/fileApi";
import Loader from "../../components/Loader/loader";
import "./fileExplorer.css";
import { useNavigate } from "react-router-dom";

interface GoogleDriveExplorerProps {
  onFileDeleted: () => void;
}

export const GoogleDriveExplorer: React.FC<GoogleDriveExplorerProps> = ({
  onFileDeleted,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showOnlySupported, setShowOnlySupported] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const oauthToken = getCookie("google_token");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFiles = async () => {
      if (!oauthToken) {
        console.error("OAuth token is missing");
        setLoading(false);
        return;
      }

      const googleApi = new GoogleApi();
      const fetchedFiles = await googleApi.fetchFiles(oauthToken, "root");
      setFiles(fetchedFiles);
      setLoading(false);
    };

    fetchFiles();
  }, [oauthToken]);

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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value.toLowerCase());
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowOnlySupported(e.target.checked);
  };

  const isSupportedFormat = (fileName: string, mimeType: string) => {
    return mimeType === "text/plain" || fileName.endsWith(".txt");
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
          (!showOnlySupported || isSupportedFormat(file.name, file.mime_type))
        ) {
          return file;
        }
        return undefined;
      })
      .filter((file): file is File => file !== undefined);
  };

  const handleDeleteFile = (fileId: string) => {
    setFileToDelete(fileId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (fileToDelete && oauthToken) {
      setIsDeleting(true); // Start the loading indicator
      const googleApi = new GoogleApi();
      try {
        await googleApi.deleteFile(fileToDelete, oauthToken);
        setFiles((prevFiles) =>
          prevFiles.filter((file) => file.path !== fileToDelete)
        );
        if (activeFilePath === fileToDelete) {
          setActiveFilePath(null);
          onFileDeleted(); // Notify that a file has been deleted
        }
        setShowDeleteDialog(false);
        setFileToDelete(null);
      } catch (error) {
        console.error("Ошибка при удалении файла:", error);
      } finally {
        setIsDeleting(false); // Stop the loading indicator
      }
    }
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
    setFileToDelete(null);
  };

  const filteredFiles = filterFiles(files);

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="file-explorer">
      <h1>Google Drive</h1>
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
      />
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
      {isDeleting && <Loader />} {/* Show loader during deletion */}
    </div>
  );
};
