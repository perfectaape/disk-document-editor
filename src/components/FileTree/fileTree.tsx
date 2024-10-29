import React, { memo, useState, useRef, useEffect, useCallback } from "react";
import { File } from "../../api/fileApi";
import "./fileTree.css";

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
}) => {
  const [menuFilePath, setMenuFilePath] = useState<string | null>(null);
  const [draggedOver, setDraggedOver] = useState<string | null>(null);

  const rootFile: File = {
    name: "Ваш диск",
    path: "disk:/",
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
}) => {
  const isOpen = openFolders.has(file.path);
  const isActive = activeFilePath === file.path;
  const nodeRef = useRef<HTMLLIElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

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
    onCreateFolder(file.path);
    setMenuFilePath(null);
  }, [file.path, onCreateFolder, setMenuFilePath]);

  const handleCreateFile = useCallback(() => {
    onCreateFile(file.path);
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
        .replace(/^disk:\//g, "");
      if (!sourcePath) return;

      if (isRootNode || file.path === "disk:/") {
        const fileName = sourcePath.split("/").pop();
        if (!fileName) return;

        await onMoveFile(sourcePath, "");
        setDraggedOver(null);
        return;
      }

      const targetDir = file.path.replace(/^disk:\//g, "");

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

  const handleRenameClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const newName = prompt("Введите новое имя файла:", file.name);
      if (newName && newName !== file.name) {
        const currentPath = file.path.replace(/^disk:\//g, "");
        const parentPath = currentPath.substring(
          0,
          currentPath.lastIndexOf("/")
        );
        const newPath = parentPath ? `${parentPath}/${newName}` : newName;
        onRenameFile(currentPath, newPath);
      }
      setMenuFilePath(null);
    },
    [file.path, file.name, onRenameFile, setMenuFilePath]
  );

  return (
    <li
      ref={nodeRef}
      className={`file-node ${isRootNode ? "root-node" : ""} ${
        isActive ? "active" : ""
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
              <div className="context-menu-item" onClick={handleRenameClick}>
                Переименовать
              </div>
              <div className="context-menu-item" onClick={handleDeleteClick}>
                Удалить
              </div>
            </>
          )}
          {(isRootNode || file.type === "dir") && (
            <>
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
      {isOpen && file.children && file.children.length > 0 && (
        <ul className="file-tree">
          {file.children.map((childFile) => (
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
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export default memo(FileTree);
