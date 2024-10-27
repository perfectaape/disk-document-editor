import React, { memo, useState, useRef, useEffect, useCallback } from "react";
import { File } from "../../api/fileApi";

interface FileTreeProps {
  files: File[];
  activeFilePath: string | null;
  onFileClick: (filePath: string) => void;
  openFolders: Set<string>;
  toggleFolder: (folderPath: string) => void;
  onDeleteFile: (filePath: string) => void;
  onRenameFile: (oldPath: string, newPath: string) => void;
}

const FileTree: React.FC<FileTreeProps> = ({
  files,
  activeFilePath,
  onFileClick,
  openFolders,
  toggleFolder,
  onDeleteFile,
  onRenameFile,
}) => {
  const [menuFilePath, setMenuFilePath] = useState<string | null>(null);

  const isSupportedFormat = (fileName: string) => {
    return fileName.endsWith(".txt");
  };

  return (
    <ul className="file-tree">
      {files.map((file) => (
        <MemoizedFileNode
          key={file.path}
          file={file}
          activeFilePath={activeFilePath}
          onFileClick={onFileClick}
          openFolders={openFolders}
          toggleFolder={toggleFolder}
          onDeleteFile={onDeleteFile}
          onRenameFile={onRenameFile}
          isSupportedFormat={
            file.type === "file" && isSupportedFormat(file.name)
          }
          menuFilePath={menuFilePath}
          setMenuFilePath={setMenuFilePath}
        />
      ))}
    </ul>
  );
};

const FileNode: React.FC<{
  file: File;
  activeFilePath: string | null;
  onFileClick: (filePath: string) => void;
  openFolders: Set<string>;
  toggleFolder: (folderPath: string) => void;
  onDeleteFile: (filePath: string) => void;
  onRenameFile: (oldPath: string, newPath: string) => void;
  isSupportedFormat: boolean;
  menuFilePath: string | null;
  setMenuFilePath: (filePath: string | null) => void;
}> = ({
  file,
  activeFilePath,
  onFileClick,
  openFolders,
  toggleFolder,
  onDeleteFile,
  onRenameFile,
  isSupportedFormat,
  menuFilePath,
  setMenuFilePath,
}) => {
  const isOpen = openFolders.has(file.path);
  const isActive = activeFilePath === file.path;
  const nodeRef = useRef<HTMLLIElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        nodeRef.current &&
        !nodeRef.current.contains(event.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuFilePath(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [setMenuFilePath]);

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
        onRenameFile(file.path, newName);
      }
      setMenuFilePath(null);
    },
    [file.path, file.name, onRenameFile, setMenuFilePath]
  );

  const handleMenuToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setMenuFilePath(menuFilePath === file.path ? null : file.path);
    },
    [file.path, menuFilePath, setMenuFilePath]
  );

  return (
    <li
      ref={nodeRef}
      className={isActive ? "active" : ""}
      style={{ position: "relative" }}
    >
      <div
        onClick={() => {
          if (file.type === "dir") {
            toggleFolder(file.path);
          } else {
            onFileClick(file.path);
          }
        }}
        style={{
          cursor: "pointer",
          opacity: file.type === "file" && !isSupportedFormat ? 0.5 : 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
        data-type={file.type}
      >
        <span>
          {file.type === "dir" ? (isOpen ? "📂" : "📁") : "📄"} {file.name}
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
          <div className="context-menu-item" onClick={handleRenameClick}>
            Переименовать
          </div>
          <div className="context-menu-item" onClick={handleDeleteClick}>
            Удалить
          </div>
        </div>
      )}
      {isOpen && file.children && file.children.length > 0 && (
        <FileTree
          files={file.children}
          activeFilePath={activeFilePath}
          onFileClick={onFileClick}
          openFolders={openFolders}
          toggleFolder={toggleFolder}
          onDeleteFile={onDeleteFile}
          onRenameFile={onRenameFile}
        />
      )}
    </li>
  );
};

const MemoizedFileNode = memo(FileNode);

export default FileTree;
