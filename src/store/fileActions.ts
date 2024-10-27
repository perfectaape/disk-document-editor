import { createAction } from "@reduxjs/toolkit";
import { File } from "../api/fileApi";

export const setFiles = createAction<File[]>("SET_FILES");
export const deleteFile = createAction<string>("DELETE_FILE");
export const setActiveFilePath = createAction<string | null>(
  "SET_ACTIVE_FILE_PATH"
);
export const renameFile = createAction<{ oldPath: string; newPath: string }>(
  "RENAME_FILE"
);
export const moveFile = createAction<{
  sourcePath: string;
  destinationPath: string;
}>("MOVE_FILE");
