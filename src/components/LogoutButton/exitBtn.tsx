import React from "react";
import { useNavigate } from "react-router-dom";

const ExitBtn: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    document.cookie =
      "yandex_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie =
      "google_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

    navigate("/");
  };

  return (
    <button onClick={handleLogout} className="logout-btn">
      Выйти
    </button>
  );
};

export default ExitBtn;
