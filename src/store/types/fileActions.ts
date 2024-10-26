import { File } from "../../api/fileApi";
import { SET_FILES, DELETE_FILE, RENAME_FILE } from "./actionTypes";

export interface SetFilesAction {
  type: typeof SET_FILES;
  payload: File[];
}

export interface DeleteFileAction {
  type: typeof DELETE_FILE;
  payload: string;
}

export interface RenameFileAction {
  type: typeof RENAME_FILE;
  payload: { oldPath: string; newPath: string };
}

export type FileActionTypes =
  | SetFilesAction
  | DeleteFileAction
  | RenameFileAction;
export { DELETE_FILE, SET_FILES, RENAME_FILE };
