import React, { useEffect, useState, useCallback } from "react";
import { GoogleApi } from "../../api/googleApi";
import FileTree from "../FileTree/fileTree";
import { File, getCookie } from "../../api/fileApi";
import "./fileExplorer.css";
import { useNavigate } from "react-router-dom";

export const GoogleDriveExplorer: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showOnlySupported, setShowOnlySupported] = useState<boolean>(false);
  const oauthToken = getCookie("google_token");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFiles = async () => {
      if (!oauthToken) {
        console.error("OAuth token is missing");
        return;
      }

      const googleApi = new GoogleApi();
      const fetchedFiles = await googleApi.fetchFiles(oauthToken, "root");
      setFiles(fetchedFiles);
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
        return null;
      })
      .filter((file) => file !== null) as File[];
  };

  const filteredFiles = filterFiles(files);

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
      />
    </div>
  );
};
