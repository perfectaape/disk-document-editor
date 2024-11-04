import { createReducer } from "@reduxjs/toolkit";
import {
  setFiles,
  deleteFile,
  setActiveFilePath,
  renameFile,
} from "../fileActions";
import { File } from "../../api/fileApi";

interface FileState {
  files: File[];
  activeFilePath: string | null;
}

const initialState: FileState = {
  files: [],
  activeFilePath: null,
};

const normalizeFile = (file: File): File => {
  return {
    ...file,
    type: file.type === "dir" ? "dir" : "file",
    children: Array.isArray(file.children) 
      ? file.children.map(normalizeFile)
      : []
  };
};

const updateItemPathRecursively = (
  items: File[],
  oldPath: string,
  newPath: string
): File[] => {
  return items.map((item) => {
    if (item.path === oldPath) {
      return { ...item, path: newPath };
    }
    if (item.type === "dir" && item.children) {
      return {
        ...item,
        children: updateItemPathRecursively(item.children, oldPath, newPath),
      };
    }
    return item;
  });
};

const removeItemRecursively = (items: File[], pathToRemove: string): File[] => {
  return items.reduce((acc: File[], item) => {
    if (item.path === pathToRemove) {
      return acc;
    }
    if (item.type === "dir" && item.children) {
      const updatedChildren = removeItemRecursively(
        item.children,
        pathToRemove
      );
      if (updatedChildren.length > 0) {
        acc.push({ ...item, children: updatedChildren });
      } else {
        acc.push({ ...item, children: [] });
      }
    } else {
      acc.push(item);
    }
    return acc;
  }, []);
};

export const filesReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(setFiles, (state, action) => {
      state.files = [...action.payload].map(normalizeFile);
    })
    .addCase(deleteFile, (state, action) => {
      state.files = removeItemRecursively([...state.files], action.payload);
    })
    .addCase(setActiveFilePath, (state, action) => {
      state.activeFilePath = action.payload;
    })
    .addCase(renameFile, (state, action) => {
      state.files = updateItemPathRecursively(
        [...state.files],
        action.payload.oldPath,
        action.payload.newPath
      );
    });
});
