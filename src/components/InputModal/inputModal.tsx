import React, { useState } from "react";
import "./modal.css";

interface InputModalProps {
  title: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
  defaultValue?: string;
}

export const InputModal: React.FC<InputModalProps> = ({
  title,
  onConfirm,
  onCancel,
  isLoading = false,
  defaultValue = '',
}) => {
  const [inputValue, setInputValue] = useState(defaultValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onConfirm(inputValue.trim());
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>{title}</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Введите название"
            autoFocus
          />
          <div className="modal-buttons">
            <button type="submit" disabled={isLoading || !inputValue.trim()}>
              {isLoading ? "Создание..." : "Создать"}
            </button>
            <button type="button" onClick={onCancel} disabled={isLoading}>
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
