import React from "react";
import { useParams } from "react-router-dom";
import { GoogleDriveExplorer } from "../../components/Explorer/googleDriveExplorer";
import { YandexDiskExplorer } from "../../components/Explorer/yandexDiskExplorer";
import { Editor } from "./editor";
import "./fileManager.css";

export const FileManager: React.FC = () => {
  const { service, filePath } = useParams<{
    service: "google" | "yandex";
    filePath?: string;
  }>();

  return (
    <div className="file-manager">
      <div className="explorer-container">
        {service === "google" ? (
          <GoogleDriveExplorer />
        ) : (
          <YandexDiskExplorer />
        )}
      </div>
      <div>
        {filePath ? (
          <Editor />
        ) : (
          <div className="select-file-message">
            Выберите файл для редактирования
          </div>
        )}
      </div>
    </div>
  );
};
