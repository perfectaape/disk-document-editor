import React, { memo, useState, useRef, useEffect, useCallback } from "react";
import { File, getCookie } from "../../api/fileApi";
import "./fileTree.css";
import { YandexApi } from "../../api/yandexApi";

interface FileTreeProps {
  files: File[];
  activeFilePath: string | null;
  onFileClick: (filePath: string) => void;
  openFolders: Set<string>;
  toggleFolder: (folderPath: string) => void;
  onDeleteFile: (filePath: string) => void;
  onRenameFile: (oldPath: string, newPath: string) => void;
  onMoveFile: (sourcePath: string, destinationPath: string) => Promise<void>;
  onCreateFolder: (parentPath: string) => Promise<void>;
  onCreateFile: (parentPath: string) => Promise<void>;
  serviceType: "google" | "yandex";
}

const FileTree: React.FC<FileTreeProps> = ({
  files,
  activeFilePath,
  onFileClick,
  openFolders,
  toggleFolder,
  onDeleteFile,
  onRenameFile,
  onMoveFile,
  onCreateFolder,
  onCreateFile,
  serviceType,
}) => {
  const [menuFilePath, setMenuFilePath] = useState<string | null>(null);
  const [draggedOver, setDraggedOver] = useState<string | null>(null);

  const rootFile: File = {
    name: "Ваш диск",
    path: "app:/",
    type: "dir",
    mime_type: "directory",
    children: files,
  };

  return (
    <div className="file-explorer">
      <FileNode
        file={rootFile}
        activeFilePath={activeFilePath}
        onFileClick={onFileClick}
        openFolders={openFolders}
        toggleFolder={toggleFolder}
        onDeleteFile={onDeleteFile}
        onRenameFile={onRenameFile}
        onMoveFile={onMoveFile}
        onCreateFolder={onCreateFolder}
        onCreateFile={onCreateFile}
        menuFilePath={menuFilePath}
        setMenuFilePath={setMenuFilePath}
        draggedOver={draggedOver}
        setDraggedOver={setDraggedOver}
        isRootNode={true}
        serviceType={serviceType}
      />
    </div>
  );
};

interface FileNodeProps {
  file: File;
  activeFilePath: string | null;
  onFileClick: (filePath: string) => void;
  openFolders: Set<string>;
  toggleFolder: (folderPath: string) => void;
  onDeleteFile: (filePath: string) => void;
  onRenameFile: (oldPath: string, newPath: string) => void;
  onMoveFile: (sourcePath: string, destinationPath: string) => Promise<void>;
  onCreateFolder: (parentPath: string) => Promise<void>;
  onCreateFile: (parentPath: string) => Promise<void>;
  menuFilePath: string | null;
  setMenuFilePath: (filePath: string | null) => void;
  draggedOver: string | null;
  setDraggedOver: (filePath: string | null) => void;
  isRootNode?: boolean;
  serviceType: "google" | "yandex";
}

const FileNode: React.FC<FileNodeProps> = ({
  file,
  activeFilePath,
  onFileClick,
  openFolders,
  toggleFolder,
  onDeleteFile,
  onRenameFile,
  onMoveFile,
  onCreateFolder,
  onCreateFile,
  menuFilePath,
  setMenuFilePath,
  draggedOver,
  setDraggedOver,
  isRootNode = false,
  serviceType,
}) => {
  const isOpen = openFolders.has(file.path);
  const [folderContents, setFolderContents] = useState<File[]>(
    file.children || []
  );
  const [isLoading, setIsLoading] = useState(false);
  const nodeRef = useRef<HTMLLIElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [folderCache, setFolderCache] = useState<Map<string, File[]>>(
    new Map()
  );

  useEffect(() => {
    if (isRootNode) {
      setFolderContents(file.children || []);
    }
  }, [file.children, isRootNode]);

  useEffect(() => {
    const loadFolderContents = async () => {
      if (!isRootNode && file.type === "dir" && isOpen) {
        if (file.children && file.children.length > 0) {
          setFolderContents(file.children);
          return;
        }

        if (folderCache.has(file.path)) {
          setFolderContents(folderCache.get(file.path) || []);
          return;
        }

        try {
          setIsLoading(true);

          if (serviceType === "yandex") {
            const yandexApi = new YandexApi();
            const oauthToken = getCookie("yandex_token");
            if (oauthToken) {
              const contents = await yandexApi.fetchFolderContents(
                oauthToken,
                file.path
              );
              setFolderCache((prev) => new Map(prev).set(file.path, contents));
              setFolderContents(contents);
            }
          } else if (serviceType === "google") {
            setFolderContents(file.children || []);
          }
        } catch (error) {
          console.error("Error loading folder contents:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadFolderContents();
  }, [
    file.path,
    file.type,
    isOpen,
    folderCache,
    isRootNode,
    file.children,
    serviceType,
  ]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuFilePath(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [setMenuFilePath]);

  const handleMenuToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      if (menuFilePath === file.path) {
        setMenuFilePath(null);
      } else {
        setMenuFilePath(file.path);
        const menu = menuRef.current;
        if (menu) {
          const rect = (e.target as HTMLElement).getBoundingClientRect();
          menu.style.top = `${rect.top}px`;
          menu.style.left = `${rect.right + 5}px`;
        }
      }
    },
    [file.path, menuFilePath, setMenuFilePath]
  );

  const handleCreateFolder = useCallback(() => {
    const cleanedPath = file.path.startsWith("app:/")
      ? file.path
      : `app:/${file.path}`;
    onCreateFolder(cleanedPath);
    setMenuFilePath(null);
  }, [file.path, onCreateFolder, setMenuFilePath]);

  const handleCreateFile = useCallback(() => {
    const cleanedPath = file.path.startsWith("app:/")
      ? file.path
      : `app:/${file.path}`;
    onCreateFile(cleanedPath);
    setMenuFilePath(null);
  }, [file.path, onCreateFile, setMenuFilePath]);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.stopPropagation();
      e.dataTransfer.setData("text/plain", file.path);
      setIsDragging(true);
    },
    [file.path]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDraggedOver(null);
  }, [setDraggedOver]);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (file.type === "dir") {
        setDraggedOver(file.path);
        e.dataTransfer.dropEffect = "move";
      }
    },
    [file.path, file.type, setDraggedOver]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDraggedOver(null);
    },
    [setDraggedOver]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const sourcePath = e.dataTransfer
        .getData("text/plain")
        .replace(/^(disk:|app:)\/+/, "")
        .replace(/^\/+/, "");

      if (!sourcePath) return;

      if (isRootNode || file.path === "app:/") {
        try {
          await onMoveFile(sourcePath, "");
          setDraggedOver(null);
        } catch (error) {
          console.error("Error moving file to root:", error);
        }
        return;
      }

      const targetDir = file.path
        .replace(/^(disk:|app:)\/+/, "")
        .replace(/^\/+/, "");

      if (sourcePath === targetDir) return;
      if (targetDir.startsWith(sourcePath + "/")) return;
      if (file.type !== "dir") return;

      try {
        await onMoveFile(sourcePath, targetDir);
        setDraggedOver(null);
      } catch (error) {
        console.error("Error moving file:", error);
      }
    },
    [file, onMoveFile, setDraggedOver, isRootNode]
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDeleteFile(file.path);
      setMenuFilePath(null);
    },
    [file.path, onDeleteFile, setMenuFilePath]
  );

  const handleRename = async (file: File) => {
    if (onRenameFile) {
      onRenameFile(file.path, file.name);
    }
  };

  const handleRefreshFolder = useCallback(async () => {
    if (file.type !== "dir") return;

    setIsLoading(true);
    try {
      setFolderCache((prev) => {
        const newCache = new Map(prev);
        const pathsToRemove = Array.from(newCache.keys()).filter((cachedPath) =>
          cachedPath.startsWith(file.path)
        );
        pathsToRemove.forEach((path) => newCache.delete(path));
        return newCache;
      });

      if (isOpen) {
        const yandexApi = new YandexApi();
        const oauthToken = getCookie("yandex_token");
        if (oauthToken) {
          const contents = await yandexApi.fetchFolderContents(
            oauthToken,
            file.path
          );
          setFolderCache((prev) => new Map(prev).set(file.path, contents));
          setFolderContents(contents);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      setMenuFilePath(null);
    } catch (error) {
      console.error("Error refreshing folder:", error);
    } finally {
      setIsLoading(false);
    }
  }, [file.path, file.type, isOpen, setMenuFilePath]);

  const isActive = useCallback(() => {
    if (!activeFilePath || !file.path) return false;

    const cleanPath = (path: string): string => {
      let cleaned = path
        .replace(/^(app:|disk):\//, "")
        .replace(/^Приложения\/Тестовое-Диск\//, "")
        .replace(/^\/+/, "")
        .replace(/\/$/, "")
        .trim();

      if (cleaned.startsWith("app:/")) {
        cleaned = cleaned.substring(5);
      }

      return cleaned;
    };

    const normalizedActivePath = cleanPath(activeFilePath);
    const normalizedFilePath = cleanPath(file.path);

    return normalizedActivePath === normalizedFilePath;
  }, [activeFilePath, file.path]);

  const isActiveNode = isActive();

  return (
    <li
      ref={nodeRef}
      className={`file-node ${isRootNode ? "root-node" : ""} ${
        isActiveNode ? "active" : ""
      } ${isDragging ? "dragging" : ""} ${
        draggedOver === file.path ? "drag-over" : ""
      }`}
      draggable={!isRootNode}
      onDragStart={!isRootNode ? handleDragStart : undefined}
      onDragEnd={!isRootNode ? handleDragEnd : undefined}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-type={file.type}
      data-path={file.path}
    >
      <div
        className={isActiveNode ? "active" : ""}
        onClick={() => {
          if (file.type === "dir") {
            toggleFolder(file.path);
          } else {
            onFileClick(file.path);
          }
        }}
      >
        <span>
          {isRootNode
            ? "💾"
            : file.type === "dir"
            ? isOpen
              ? "📂"
              : "📁"
            : "📄"}{" "}
          {file.name}
          {isLoading && file.type === "dir" && " ●"}
        </span>
        <span className="more-options" onClick={handleMenuToggle}>
          ⋯
        </span>
      </div>
      {menuFilePath === file.path && (
        <div
          ref={menuRef}
          className="context-menu"
          onClick={(e) => e.stopPropagation()}
        >
          {!isRootNode && (
            <>
              <div className="context-menu-item" onClick={() => handleRename(file)}>
                Переименовать
              </div>
              <div className="context-menu-item" onClick={handleDeleteClick}>
                Удалить
              </div>
            </>
          )}
          {(isRootNode || file.type === "dir") && (
            <>
              <div className="context-menu-item" onClick={handleRefreshFolder}>
                Обновить
              </div>
              <div className="context-menu-item" onClick={handleCreateFolder}>
                Создать папку
              </div>
              <div className="context-menu-item" onClick={handleCreateFile}>
                Создать файл
              </div>
            </>
          )}
        </div>
      )}
      {isOpen && file.type === "dir" && (
        <ul className="file-tree">
          {!isLoading ? (
            folderContents.map((childFile) => (
              <FileNode
                key={childFile.path}
                file={childFile}
                activeFilePath={activeFilePath}
                onFileClick={onFileClick}
                openFolders={openFolders}
                toggleFolder={toggleFolder}
                onDeleteFile={onDeleteFile}
                onRenameFile={onRenameFile}
                onMoveFile={onMoveFile}
                onCreateFolder={onCreateFolder}
                onCreateFile={onCreateFile}
                menuFilePath={menuFilePath}
                setMenuFilePath={setMenuFilePath}
                draggedOver={draggedOver}
                setDraggedOver={setDraggedOver}
                serviceType={serviceType}
              />
            ))
          ) : (
            <li className="loading-item">Загрузка...</li>
          )}
        </ul>
      )}
    </li>
  );
};

export default memo(FileTree);
