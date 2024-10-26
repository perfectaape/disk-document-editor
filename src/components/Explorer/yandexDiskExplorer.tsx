import React, { useEffect, useState, useCallback } from "react";
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
  const [files, setFiles] = useState<File[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showOnlySupported, setShowOnlySupported] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
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
      setFiles(fetchedFiles);
      setLoading(false);
    };

    fetchFiles();
  }, [oauthToken]);

  const handleFileClick = useCallback(
    (filePath: string) => {
      setActiveFilePath(filePath);
      navigate(`/explorer/yandex/${encodeURIComponent(filePath)}`);
    },
    [navigate]
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
      setIsDeleting(true); // Start the loading indicator
      const yandexApi = new YandexApi();
      try {
        await yandexApi.deleteFile(fileToDelete, oauthToken);
        setFiles((prevFiles) => {
          const updatedFiles = prevFiles.filter(
            (file) => file.path !== fileToDelete
          );
          console.log("Updated files after deletion:", updatedFiles);
          return updatedFiles;
        });
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

  useEffect(() => {
    console.log("Filtered files:", filteredFiles);
  }, [filteredFiles]);

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="file-explorer">
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
      {isDeleting && <Loader />}
    </div>
  );
};
