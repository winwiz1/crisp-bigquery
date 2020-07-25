/*
  QueryPage is a presentation component that facilitates
  inputting query parameters and displays query results.
*/
import * as React from "react";
import { style, classes } from "typestyle";
import { QueryTable } from "./QueryTable";
import { QueryCache } from "../utils/cache";
import { QueryInput } from "./QueryInput";
import { CustomError } from "../utils/error";
import logger from "../utils/logger";
import { IFetchState } from "../state/store";
import { actionCreators } from "../state/actions";
import {
  isError,
  isCustomError,
  isBigQueryRetrievalResult
} from "../utils/typeguards";
import { IBackendRequestData } from "../api/BackendRequest";
import { BackendManager, BigQueryRetrievalResult } from "../api/BackendManager";
import { AutoPaginate } from "./AutoPaginate";

// This part/slice of QueryPageProps contains data provided by Redux store
export interface IQueryPageProps_dataSlice {
  fetch: IFetchState;
}

// This part/slice of QueryPageProps contains functions that create and
// dispatch Redux actions.
export interface IQueryPageProps_actionSlice {
  actions: typeof actionCreators;
}

// The intersection of the above slices produces the type for QueryPage
// properties.
export type QueryPageProps = IQueryPageProps_dataSlice & IQueryPageProps_actionSlice;

// Private state used by QueryPage
type QueryPageState = {
  error?: Error
  lastRequest?: IBackendRequestData
  paginationModalVisible: boolean
};

/*
  QueryPage implementation
*/
export class QueryPage extends React.Component<QueryPageProps, QueryPageState> {
  public readonly state: QueryPageState = {
    error: undefined,
    lastRequest: undefined,
    paginationModalVisible: false
  };

  //#region Public methods

  // Method used to fetch data from backend.
  // Note: newQuery set to 'false' means we are paginating through an existing query.
  public readonly performQuery = async (req: IBackendRequestData, newQuery = true): Promise<void> => {
    let request: IBackendRequestData | undefined;

    if (!newQuery) {
      if (this.state.error) {
        logger.info(QueryPage.s_errMsgFetchRejected);
        return;
      }

      if (this.m_cache.isOverLimit()) {
        this.setError(QueryPage.getOverlimitError());
        return;
      }

      request = QueryPage.augmentRequest(this.m_cache, req);
    }

    await this.fetchQueryData(request ?? req, newQuery);
  }

  public static readonly getOverlimitError = (): CustomError => {
    return new CustomError(
      QueryPage.s_errMsgOverlimit_user,
      QueryPage.s_errMsgOverlimit
    );
  }

  public static readonly augmentRequest = (cache: QueryCache, req: IBackendRequestData): IBackendRequestData => {
    let ret: IBackendRequestData;
    const lastPage = cache.getLastPage();

    if (lastPage) {
      const { job, token } = lastPage;

      if (token) {
        ret = { ...req, jobId: job, pageToken: token };
      } else {
        // Can only happen if code is incorrectly modified
        throw new Error(QueryPage.s_errMsgUnexpectedRequest);
      }
    } else {
      // Can only happen if code is incorrectly modified
      throw new Error(QueryPage.s_errMsgInternal);
    }

    return ret;
  }

  public static readonly resetForNewQuery: (helpers: {
      actions: typeof actionCreators
      cache: QueryCache
      clearError: () => void
      setLastRequest: (req?: IBackendRequestData) => void
    }) => void = ({ actions, cache, clearError, setLastRequest }) => {
    clearError();
    cache.clear();
    setLastRequest(undefined);
    actions.actionSetPage(0);
  }

  public static readonly fetchOnePage: (helpers: {
      actions: typeof actionCreators
      cache: QueryCache
      clearError: () => void
      controller: AbortController
      newQuery: boolean
      request: IBackendRequestData
      setError: (err: Error) => void
      setLastRequest: (req?: IBackendRequestData) => void
    }) => Promise<boolean> = async ({
      actions,
      cache,
      clearError,
      controller,
      newQuery,
      request,
      setError,
      setLastRequest}) => {
    actions.actionFetchStart();
    const backendMgr = new BackendManager(controller.signal);
    const ret: boolean = await Promise.race([
      backendMgr.fetch(request),
      new Promise<boolean>(resolve =>
        setTimeout(resolve, QueryPage.s_timeout, false)
      )
    ]);

    const data = ret ? backendMgr.Data :
      (controller.abort(),
       new CustomError(QueryPage.s_errMsgTimeout_user, QueryPage.s_errMsgTimeout)
      );

    if (isBigQueryRetrievalResult(data)) {
      clearError();
      const result = data as BigQueryRetrievalResult;
      // Add the newly fetched data to cache
      if (!cache.addPage(result)) {
        // Can only happen if code is incorrectly modified
        setError(new Error("Fetching while over the cache limit"));
        return Promise.resolve(false);
      }
      // Get new page count
      const cnt = cache.getPageCount();
      // Show the cache page data in QueryTable (for new query only)
      actions.actionFetchEnd(newQuery ? cnt - 1 : undefined);
      newQuery && setLastRequest(request);
      return Promise.resolve(true);
    } else {
      // Do not update current page and page count
      actions.actionFetchEnd();

      if (isCustomError(data)) {
        setError(data as CustomError);
      } else if (isError(data)) {
        setError(data as Error);
      } else {
        // Can only happen if code is incorrectly modified
        setError(new TypeError(QueryPage.s_errMsgUnexpected));
      }
      return Promise.resolve(false);
    }
  }

  public readonly openPaginationModal = (req?: IBackendRequestData): void => {
    this.m_autoPaginationRequest = req;
    this.setState(state => ({ ...state, paginationModalVisible: true }));
  }

  public readonly closePaginationModal = (): void => {
    this.setState(state => ({ ...state, paginationModalVisible: false }));
  }

  public componentWillUnmount(): void {
    this.m_controller && this.m_controller.abort();
  }

  public componentDidUpdate(prevProps: QueryPageProps, /*_prevState: QueryPageState */): void {
    const cnt = this.m_cache.getPageCount();

    if (cnt === 0 || this.props.fetch.inFlight || !this.state.lastRequest || !!this.state.error) {
      if (!!this.state.error && (this.props.fetch.currentPage < prevProps.fetch.currentPage)) {
        this.clearError();
      }
      return;
    }

    if (this.props.fetch.currentPage === cnt) {
      this.performQuery(this.state.lastRequest, false)
        .then(() => logger.info(QueryPage.s_msgPageCompleted))
        .catch(err => logger.error(`Request for the next page failed, error : ${err}`));
    }
  }

  public shouldComponentUpdate(nextProps: QueryPageProps, nextState: QueryPageState): boolean {
    if (this.props.fetch !== nextProps.fetch ||
        this.state.error !== nextState.error ||
        this.state.paginationModalVisible !== nextState.paginationModalVisible) {
      return true;
    }

    return false;
  }

  // eslint-disable-next-line
  public render() {
    const cnt = this.m_cache.getPageCount();
    const page = this.props.fetch.currentPage;
    const currentPage = (cnt > 0 && page === cnt) ? page - 1 : page;
    const cssQueryTableCursor = style({
      $debugName: "querytablecursor",
      $nest: {
        "&:hover": {
          cursor: this.props.fetch.inFlight ? "progress" : "default"
        },
        "&>*:hover": {
          cursor: this.props.fetch.inFlight ? "progress" : "default"
        }
      }
    });

    return (
      <>
        <header />
        <AutoPaginate
          newQuery={!!this.m_autoPaginationRequest}
          paginationRequest={this.m_autoPaginationRequest ?? this.state.lastRequest!}
          cache={this.m_cache}
          visible={this.state.paginationModalVisible}
          closeModal={this.closePaginationModal}
          setPaginationRequest={this.setLastRequest}
          clearError={this.clearError}
          setError={this.setError}
          actions={this.props.actions}
        />
        <main className={classes(QueryPage.s_cssFlexContainer, cssQueryTableCursor)}>
          <QueryInput
            autoPaginate={this.openPaginationModal}
            inFlight={this.props.fetch.inFlight}
            performQuery={this.performQuery}
            className={QueryPage.s_cssQueryInput}
          />
          <QueryTable
            autoPaginate={this.openPaginationModal}
            currentPage={currentPage}
            cache={this.m_cache}
            err={this.state.error}
            className={QueryPage.s_cssQueryTable}
            clearError={this.clearError}
          />
        </main>
        <footer />
      </>
    );
  }

  //#endregion

  //#region Private methods

  // Private method used to fetch data from backend.
  private fetchQueryData = async (request: IBackendRequestData, newQuery: boolean) => {
    if (this.m_controller) {
      // Can only happen if code is incorrectly modified
      this.setError(new CustomError(
        QueryPage.s_errMsgOverlapped_user,
        QueryPage.s_errMsgOverlapped
      ));
      return;
    }

    if (newQuery) {
      QueryPage.resetForNewQuery({
        actions: this.props.actions,
        cache: this.m_cache,
        clearError: this.clearError,
        setLastRequest: this.setLastRequest
      });
    }

    this.m_controller = new AbortController();

    await QueryPage.fetchOnePage({
      actions: this.props.actions,
      cache: this.m_cache,
      clearError: this.clearError,
      controller: this.m_controller,
      newQuery,
      request,
      setError: this.setError,
      setLastRequest: this.setLastRequest
    });

    this.m_controller = undefined;
  }

  private clearError = () => {
    this.setState(state => ({ ...state, error: undefined }));
  }

  private setError = (err: Error) => {
    this.setState(state => ({ ...state, error: err }));
  }

  private setLastRequest = (request?: IBackendRequestData) => {
    this.setState(state => ({ ...state, lastRequest: request }));
  }

  //#endregion

  //#region Data

  private readonly m_cache = new QueryCache();
  private m_controller?: AbortController = undefined;
  private m_autoPaginationRequest?: IBackendRequestData;
  private static readonly s_timeout = 15000;
  private static readonly s_cssFlexContainer: string = style({
    $debugName: "querymain",
    display: "flex",
    flexFlow: "column nowrap",
    height: "100vh !important"
  });
  private static readonly s_cssQueryInput: string = style({
    $debugName: "queryinput",
    flex: "initial"
  });
  private static readonly s_cssQueryTable: string = style({
    $debugName: "querytable",
    flex: "auto"
  });
  private static readonly s_msgPageCompleted = "Request for the next page completed";
  private static readonly s_errMsgUnexpected =
    "Unexpected response data, please contact Support.";
  private static readonly s_errMsgUnexpectedRequest =
    "Unexpected data request (no more data known to be available), " +
    "please contact Support.";
  private static readonly s_errMsgTimeout_user =
    "Could not get data from the backend, it didn't respond in a timely fashion." +
    " If the problem persists please contact Support.";
  private static readonly s_errMsgTimeout = "Timeout fetching data";
  private static readonly s_errMsgOverlapped_user =
    "Please wait until already active data request completes.";
  private static readonly s_errMsgOverlapped = "Overlapping fetch rejected";
  private static readonly s_errMsgOverlimit_user =
    "The limit on the amount of data that can be stored for a query has been reached." +
    " Consider using more restrictive query.";
  private static readonly s_errMsgOverlimit = "Overlimit fetch rejected";
  private static readonly s_errMsgInternal = "Internal error in QueryPage. Please contact Support";
  private static readonly s_errMsgFetchRejected = "QueryPage: fetch rejected due to an error";

  //#endregion
}
