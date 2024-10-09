import React from "react";
import { Route, BrowserRouter, Routes } from "react-router-dom";
import { MainPages } from "./pages/mainPages";
import { AuthPages } from "./pages/authPages";
import { EditorPages } from "./pages/editorPages";
import { Editor } from "./pages/editor";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPages />} />
        <Route path="/auth" element={<AuthPages />} />
        <Route path="/editor" element={<EditorPages />} />
        <Route path="/editor/:filePath" element={<Editor />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
