/*
  Connect QueryPage to Redux store.
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
  QueryPage,
  IQueryPageProps_dataSlice,
  IQueryPageProps_actionSlice
} from "./QueryPage";

// Helper function used by connect()
const mapStateToProps: MapStateToProps<IQueryPageProps_dataSlice, IQueryPageContainerProps, RootState> =
  (state: RootState, _ownProps: IQueryPageContainerProps) => ({
    fetch: state.fetch
  });

// Helper function used by connect()
const mapDispatchToProps: MapDispatchToProps<IQueryPageProps_actionSlice, IQueryPageContainerProps> =
  (dispatch: Dispatch<AllActions>) => ({
    actions: bindActionCreators(actionCreators, dispatch)
  });

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IQueryPageContainerProps {
}

// Container component (effectively a wrapper) that connects QueryPage to the Redux store
export const QueryPageContainer =
  connect<
    // The type of props injected by mapStateToProps
    IQueryPageProps_dataSlice,
    // The type of props injected by mapDispatchToProps
    ReturnType<typeof mapDispatchToProps>,
    // The type of props to be taken by the container component we are about to create
    IQueryPageContainerProps,
    // The type of Redux state tree
    RootState>
  (mapStateToProps, mapDispatchToProps)(QueryPage);
