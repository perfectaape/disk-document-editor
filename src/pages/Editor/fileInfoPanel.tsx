import React from "react";
import "./fileInfoPanel.css";

interface FileInfoPanelProps {
  createdDate: string;
  modifiedDate: string;
  author: string;
}

const FileInfoPanel: React.FC<FileInfoPanelProps> = ({
  createdDate,
  modifiedDate,
  author,
}) => {
  return (
    <div className="file-info-panel">
      <h2>Информация о файле</h2>
      <p>
        <strong>Создан:</strong> {new Date(createdDate).toLocaleString()}
      </p>
      <p>
        <strong>Изменен:</strong> {new Date(modifiedDate).toLocaleString()}
      </p>
      <p>
        <strong>Автор:</strong> {author}
      </p>
    </div>
  );
};

export default FileInfoPanel;
