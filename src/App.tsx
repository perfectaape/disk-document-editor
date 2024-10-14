import React from "react";
import { Route, BrowserRouter, Routes } from "react-router-dom";
import { AuthPages } from "./pages/Auth/authPages";
import { Editor } from "./pages/Editor/editor";
import { EditorPages } from "./pages/Editor/editorPages";
import { MainPages } from "./pages/Main/mainPages";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div>
        <Routes>
          <Route path="/" element={<MainPages />} />
          <Route path="/auth" element={<AuthPages />} />
          <Route path="/editor" element={<EditorPages />} />
          <Route path="/editor/:service/:filePath" element={<Editor />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;
