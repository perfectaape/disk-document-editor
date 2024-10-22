import React from "react";
import { Route, BrowserRouter, Routes } from "react-router-dom";
import { AuthPages } from "./pages/Auth/authPages";
import { MainPages } from "./pages/Main/mainPages";
import { FileManager } from "./pages/Editor/fileManager";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div>
        <Routes>
          <Route path="/" element={<MainPages />} />
          <Route path="/auth" element={<AuthPages />} />
          <Route path="/explorer/:service" element={<FileManager />} />
          <Route
            path="/explorer/:service/:filePath"
            element={<FileManager />}
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;
