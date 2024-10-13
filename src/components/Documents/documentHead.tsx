import React from "react";
import { Service, ServiceInfo } from "../../pages/Editor/editorPages";
import "./document.css";

interface DocumentHeadProps {
  handleServiceChange: (service: Service) => void;
  services: Record<Service, ServiceInfo>;
  activeService: Service | null;
}

export const DocumentHead: React.FC<DocumentHeadProps> = ({
  handleServiceChange,
  services,
  activeService,
}) => {
  return (
    <div className="service-switcher">
      {Object.entries(services).map(([key, { title, status }]) => (
        <button
          className={`service-button ${status} ${
            activeService === key ? "activeService" : ""
          }`}
          key={key}
          onClick={() => handleServiceChange(key as Service)}
        >
          {title}
        </button>
      ))}
    </div>
  );
};
