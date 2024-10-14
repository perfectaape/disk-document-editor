import React, { useCallback } from "react";
import { File } from "../../api/fileApi";
import { useNavigate } from "react-router-dom";

interface DocumentBodyProps {
  files: File[];
  activeService: "yandex" | "google" | null;
}

export const DocumentBody: React.FC<DocumentBodyProps> = ({
  files,
  activeService,
}) => {
  const navigate = useNavigate();

  const handleDocument = useCallback(
    (file: File): void => {
      if (!activeService) {
        console.error("Сервис не выбран. Пожалуйста, выберите сервис.");
        return;
      }

      const identifier = file.id || file.path || "default";
      const encodedIdentifier = encodeURIComponent(identifier);
      navigate(`/editor/${activeService}/${encodedIdentifier}`);
    },
    [navigate, activeService]
  );

  if (files.length === 0) {
    return <h2 className="no-files-message">Нет доступных файлов</h2>;
  }

  return (
    <div className="desktop-icon-container">
      {files.map((file) => (
        <div
          onClick={() => handleDocument(file)}
          className="desktop-icon"
          key={file.id || file.path}
        >
          <div className="file-icon">
            <img src="/icons/doc.png" alt={file.name} />
          </div>
          {file.name}
        </div>
      ))}
    </div>
  );
};
