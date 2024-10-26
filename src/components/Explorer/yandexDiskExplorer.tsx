import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../store/store";
import {
  setFiles,
  deleteFile,
  setActiveFilePath,
  renameFile,
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
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
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
      setIsDeleting(true); // Start the loading indicator
      const yandexApi = new YandexApi();
      try {
        // Fetch the folder contents if it's a directory
        const folderContents = await yandexApi.fetchFiles(
          oauthToken,
          fileToDelete
        );

        // Delete all files inside the folder
        for (const file of folderContents) {
          await yandexApi.deleteFile(file.path, oauthToken);
        }

        // Now delete the folder itself
        const response = await yandexApi.deleteFile(fileToDelete, oauthToken);

        if (response.success) {
          dispatch(deleteFile(fileToDelete));
          if (activeFilePath === fileToDelete) {
            dispatch(setActiveFilePath(null));
            onFileDeleted(); // Notify that a file has been deleted
          }
          setShowDeleteDialog(false); // Close the modal
          setFileToDelete(null);
        } else {
          console.error("Ошибка при удалении файла на сервере");
        }
      } catch (error) {
        console.error("Ошибка при удалении файла:", error);
      } finally {
        setIsDeleting(false); // Stop the loading indicator
      }
    }
  };

  const handleRenameFile = async (oldPath: string, newName: string) => {
    if (!oauthToken) return;

    setIsRenaming(true);
    const yandexApi = new YandexApi();

    try {
      const response = await yandexApi.renameFile(oldPath, newName, oauthToken);

      if (response.success) {
        // Используем Redux action для обновления состояния
        dispatch(
          renameFile({
            oldPath: oldPath,
            newPath: newName,
          })
        );

        // Опционально: можно обновить состояние с сервера
        // для синхронизации с актуальными данными
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
            onRenameFile={handleRenameFile} // Pass the rename handler
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
