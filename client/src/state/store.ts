/*
  The Redux store. Also called state tree.
*/

import { combineReducers, createStore } from "redux";
import { allReducers } from "./reducers";

// Slice of state tree related to data fetching from the server
export interface IFetchState {
  // If 'true' then backend data request is inflight
  inFlight: boolean;
  // Current cache page
  currentPage: number;
}

// Slice of state tree reserved for future
export interface IOtherState {
}

// The initial object for the fetch slice of the state tree
export const initialFetchState: IFetchState = {
  currentPage: 0,
  inFlight: false
};

// The initial object for the other slice of the state tree
export const ininitialOtherState: IOtherState = {
};

// The root reducer used to create Redux store
const rootReducer = combineReducers({
  fetch: allReducers.fetchReducer,
  other: allReducers.otherReducer
});
export type RootState = ReturnType<typeof rootReducer>;

// Our final goal: the store
export const rootStore = createStore(rootReducer);
