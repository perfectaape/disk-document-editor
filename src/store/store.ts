import { configureStore } from "@reduxjs/toolkit";
import { filesReducer } from "./reducers/fileReducer";

const store = configureStore({
  reducer: {
    fileState: filesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;