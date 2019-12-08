import { Action, AnyAction, Dispatch } from "redux";

/*
  Action types
*/
export enum ActionTypes {
  FetchStart = "FetchStart",
  FetchEnd = "FetchEnd",
  SetPage = "SetPage",
}

/*
  Actions: one action for each action type
*/

interface IActionFetchStart extends Action<typeof ActionTypes.FetchStart> {
}

interface IActionFetchEnd extends Action<typeof ActionTypes.FetchEnd> {
  readonly currentPage?: number;
  readonly pageCount?: number;
}

interface IActionSetPage extends Action<typeof ActionTypes.SetPage> {
  readonly currentPage: number;
}

const actionFetchStartCreator = (): IActionFetchStart => {
  return {
    type: ActionTypes.FetchStart
  };
};

/*
  Action creators
*/

const actionFetchEndCreator = (
  page: number | undefined = undefined,
  count: number | undefined = undefined): IActionFetchEnd => {
  return {
    type: ActionTypes.FetchEnd,
    ...(page && { currentPage: page }),
    ...(count && { pageCount: count }),
  };
};

const actionSetPageCreator = (
  page: number): IActionSetPage => {
  return {
    currentPage: page,
    type: ActionTypes.SetPage,
  };
};

export type AllActions =
  | IActionFetchStart
  | IActionFetchEnd
  | IActionSetPage;

export const actionCreators = {
  actionFetchEnd:   actionFetchEndCreator,
  actionFetchStart: actionFetchStartCreator,
  actionSetPage:    actionSetPageCreator,
};

// Currently unused as we are not injecting dispatch() directly into
// the props of container components created by connect(). We inject
// dispatch() indirectly via action creators bound to dispatch.
export interface IDispatchProps<A extends Action = AnyAction> {
  dispatch: Dispatch<A>;
}
