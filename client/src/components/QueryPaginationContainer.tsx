/*
  Connect QueryPagination to Redux store.
*/
import { Dispatch, bindActionCreators } from "redux";
import {
  MapStateToProps,
  MapDispatchToProps,
  connect
} from "react-redux";
import { RootState } from "../state/store";
import { AllActions, actionCreators } from "../state/actions";
import {
  QueryPagination,
  IQueryFetchProps,
  IQueryActionProps
} from "./QueryPagination";
import { IQueryStatusProps } from "./QueryStatus";

// Helper function used by connect()
const mapStateToProps: MapStateToProps<IQueryFetchProps, IQueryPaginationContainerProps, RootState> =
    (state: RootState, _ownProps: IQueryPaginationContainerProps) => {
  const ret: IQueryFetchProps = {
    fetch: state.fetch
  };
  return ret;
};

// Helper function used by connect()
const mapDispatchToProps: MapDispatchToProps<IQueryActionProps, IQueryPaginationContainerProps> =
    (dispatch: Dispatch<AllActions>) => {
  const ret: IQueryActionProps = {
    actions: bindActionCreators(actionCreators, dispatch)
  };
  return ret;
};

export interface IQueryPaginationContainerProps extends IQueryStatusProps {
}

// Container component that connects QueryPagination to the Redux store
export const QueryPaginationContainer =
  connect<
    // The type of props injected by mapStateToProps
    IQueryFetchProps,
    // The type of props injected by mapDispatchToProps
    ReturnType<typeof mapDispatchToProps>,
    // The type of props to be taken by container component we are about to create
    IQueryPaginationContainerProps,
    // The type of Redux state tree
    RootState>
    (mapStateToProps, mapDispatchToProps)(QueryPagination);
