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

const updateItemPathRecursively = (
  items: File[],
  oldPath: string,
  newPath: string
): File[] => {
  return items.map((item) => {
    console.log("item.path", item.path);
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
      return acc; // Skip the item to remove it
    }
    if (item.type === "dir" && item.children) {
      // Recursively remove from children
      const updatedChildren = removeItemRecursively(
        item.children,
        pathToRemove
      );
      if (updatedChildren.length > 0) {
        acc.push({ ...item, children: updatedChildren });
      } else {
        acc.push({ ...item, children: [] }); // Ensure empty directories are handled
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
      state.files = action.payload;
    })
    .addCase(deleteFile, (state, action) => {
      state.files = removeItemRecursively(state.files, action.payload);
    })
    .addCase(setActiveFilePath, (state, action) => {
      state.activeFilePath = action.payload;
    })
    .addCase(renameFile, (state, action) => {
      state.files = updateItemPathRecursively(
        state.files,
        action.payload.oldPath,
        action.payload.newPath
      );
    });
});
