import React, { memo } from "react";
import { File } from "../../api/fileApi";

interface FileTreeProps {
  files: File[];
  activeFilePath: string | null;
  onFileClick: (filePath: string) => void;
  openFolders: Set<string>;
  toggleFolder: (folderPath: string) => void;
}

const FileTree: React.FC<FileTreeProps> = ({
  files,
  activeFilePath,
  onFileClick,
  openFolders,
  toggleFolder,
}) => {
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
          isSupportedFormat={
            file.type === "file" && isSupportedFormat(file.name)
          }
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
  isSupportedFormat: boolean;
}> = ({
  file,
  activeFilePath,
  onFileClick,
  openFolders,
  toggleFolder,
  isSupportedFormat,
}) => {
  const isOpen = openFolders.has(file.path);
  const isActive = activeFilePath === file.path;

  return (
    <li className={isActive ? "active" : ""}>
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
        }}
        data-type={file.type}
      >
        {file.type === "dir" ? (isOpen ? "📂" : "📁") : "📄"} {file.name}
      </div>
      {isOpen && file.children && file.children.length > 0 && (
        <FileTree
          files={file.children}
          activeFilePath={activeFilePath}
          onFileClick={onFileClick}
          openFolders={openFolders}
          toggleFolder={toggleFolder}
        />
      )}
    </li>
  );
};

const MemoizedFileNode = memo(FileNode);

export default FileTree;
