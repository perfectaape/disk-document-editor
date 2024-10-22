import React from "react";
import { File } from "../../api/fileApi";
import { useNavigate } from "react-router-dom";

interface DocumentBodyProps {
  files: File[];
  activeService: "yandex" | "google" | null;
  onFolderClick: (path: string) => void;
}

export const DocumentBody: React.FC<DocumentBodyProps> = ({
  files,
  activeService,
  onFolderClick,
}) => {
  const navigate = useNavigate();

  const handleFileClick = (file: File) => {
    if (file.type === "dir") {
      if (file.path) {
        onFolderClick(file.path);
      } else {
        console.error("File path is undefined");
      }
    } else {
      if (file.path && activeService) {
        const encodedPath = encodeURIComponent(file.path);
        navigate(`/editor/${activeService}/${encodedPath}`);
      } else {
        if (!file.path) {
          console.error("File path is undefined");
        }
        if (!activeService) {
          console.error("Active service is null");
        }
      }
    }
  };

  if (files.length === 0) {
    return <h2 className="no-files-message">Нет доступных файлов</h2>;
  }

  return (
    <div className="desktop-icon-container">
      {files.map((file) => (
        <div
          onClick={() => handleFileClick(file)}
          className="desktop-icon"
          key={file.path}
        >
          <div className="file-icon">
            <img
              src={file.type === "dir" ? "/icons/folder.png" : "/icons/doc.png"}
              alt={file.name}
            />
          </div>
          {file.name}
        </div>
      ))}
    </div>
  );
};
