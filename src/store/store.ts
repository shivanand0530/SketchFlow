import { configureStore } from '@reduxjs/toolkit';
import canvasReducer from './canvasSlice';
import collaborationReducer from './collaborationSlice';
import { loadState, saveState } from './localStorage';

const preloadedState = loadState();

export const store = configureStore({
  reducer: {
    canvas: canvasReducer,
    collaboration: collaborationReducer,
  },
  ...(preloadedState && { preloadedState }),
});
store.subscribe(() => {
  saveState({
    canvas: store.getState().canvas,
  });
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
