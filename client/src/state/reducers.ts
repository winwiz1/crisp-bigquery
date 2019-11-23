import { Reducer } from "redux";
import { ActionTypes, AllActions } from "./actions";
import {
  IFetchState,
  IOtherState,
  initialFetchState,
  ininitialOtherState
} from "./store";

/*
  The reducer
*/
const fetchReducer: Reducer<IFetchState, AllActions> =
  (state: IFetchState = initialFetchState, action: AllActions) => {
    switch (action.type) {
      case ActionTypes.FetchStart: {
        return {
          ...state,
          inFlight: true,
        };
      }
      case ActionTypes.FetchEnd: {
        return {
          currentPage: action.currentPage || state.currentPage,
          inFlight: false,
          pageCount: action.pageCount || state.pageCount
        };
      }
      case ActionTypes.SetPage: {
        return {
          ...state,
          currentPage: action.currentPage
        };
      }
      case ActionTypes.SetCount: {
        return {
          ...state,
          pageCount: action.pageCount
        };
      }
      default: {
        return state;
      }
    }
  };

/*
  Placeholder for future functionality
*/
const otherReducer: Reducer<IOtherState, AllActions> =
  (_state: IOtherState = ininitialOtherState, action: AllActions) => {
    switch (action.type) {
      default: {
        return {};
      }
    }
  };

export const allReducers = { fetchReducer, otherReducer };
