/*
  AutoPaginate performs auto-pagination and adds the fetched data to the cache.
*/
import * as React from "react";
import { style } from "typestyle";
import {
  Button,
  Divider,
  Form,
  Header,
  Icon,
  Input,
  InputOnChangeData,
  Modal,
  Progress,
  Segment
} from "semantic-ui-react";
import { IBackendRequestData } from "../api/BackendRequest";
import { QueryCache } from "../utils/cache";
import logger from "../utils/logger";
import { QueryPage } from "./QueryPage";
import { actionCreators } from "../state/actions";

//#region Styles

const cssModalHeader = style({
  display: "flex"
});

const cssModalHeaderText = style({
  flex: "auto",
  textAlign: "center"
});

const cssModalHeaderIcon = style({
  flex: "initial",
  textAlign: "left"
});

const cssButtonPaginate = style({
  marginBottom: "0.5em",
  marginLeft: "1em",
  marginRight: "1em",
  marginTop: "0.8em"
});

const cssButtonCancel = style({
  marginBottom: "0.5em",
  marginLeft: "1em",
  marginRight: "4em",
  marginTop: "0.8em"
});

const cssButton = style({
  height: "2.5em"
});

const cssData = style({
  display: "flex"
});

const cssDataFetched = style({
  flex: "initial",
  marginLeft: "1em",
  marginRight: "1em",
  width: "30%",
});

const cssDataRequested = style({
  flex: "initial",
  marginLeft: "1em",
  marginRight: "1em",
  width: "35%",
});

const cssDataRemaining = style({
  flex: "initial",
  marginLeft: "1em",
  marginRight: "1em",
  width: "35%",
});

const cssSubHeader = style({
  wordSpacing: "0.2em"
});

const cssInput = style({
  marginTop: "1em"
});

const cssInputError = style({
  $nest: {
    "& input": {
      backgroundColor: "linen !important",
      caretColor: "black",
      color: "red !important",
    }
  },
  marginTop: "1em",
});

//#endregion

export interface IAutoPaginateProps {
  newQuery: boolean;
  paginationRequest: IBackendRequestData;
  cache: QueryCache;
  visible: boolean;
  closeModal: () => void;
  setPaginationRequest: (req?: IBackendRequestData) => void;
  clearError: () => void;
  setError: (err: Error) => void;
  actions: typeof actionCreators;
}

/*
  The component is a controlled modal.
  It facilitates auto-pagination.
*/
export const AutoPaginate: React.FunctionComponent<IAutoPaginateProps> = props => {
  if (!props.visible) {
    return null;
  }

  // Sanity check
  if (!props.paginationRequest?.rowCount) {
    // Can only happen if code is incorrectly modified
    throw new Error("Invalid auto-pagination data. Please contact Support.");
  }

  //#region Data

  // Non-UI data

  const abortController = React.useRef<AbortController | undefined>(undefined);
  const loopingCount = React.useRef<number | undefined>(undefined);
  const isNewQuery = React.useRef(props.newQuery);
  const isPaginating = React.useRef(false);

  // Page and row counts

  const pageCountRequestedMax = 100;
  const pageCountRequestedDefault = 1;

  const [pageCountFetched, setPageCountFetched] = React.useState(isNewQuery.current ? 0 : props.cache.getPageCount());
  const [rowCountFetched, setRowCountFetched] = React.useState(isNewQuery.current ? 0 : props.cache.getRowCount());

  const initialPageCount = {
    error: false,
    value: pageCountRequestedDefault
  };
  const [pageCountRequested, setPageCountRequested] = React.useState<typeof initialPageCount>(initialPageCount);

  const getRowCountRequested = () => pageCountRequested.value * props.paginationRequest.rowCount;
  const [rowCountRequested, setRowCountRequested] = React.useState(getRowCountRequested());

  const strUnknown = "Unknown";
  const getRowCountRemaining = () => (isNewQuery.current || props.cache.getPage(0)?.totalRows === undefined) ?
    strUnknown : (props.cache.getPage(0)!.totalRows - props.cache.getRowCount()).toString();
  const [rowCountRemaining, setRowCountRemaining] = React.useState(getRowCountRemaining());

  const getPageCountRemaining = () => (isNewQuery.current || props.cache.getPage(0)?.totalRows === undefined) ?
    strUnknown : Math.ceil(
      (props.cache.getPage(0)!.totalRows - props.cache.getRowCount()) / props.paginationRequest.rowCount
    ).toString();
  const [pageCountRemaining, setPageCountRemaining] = React.useState(getPageCountRemaining());

  // Other UI fixtures

  const getBtnPaginateText = () => isNewQuery.current ? "New query" : "Paginate";
  const [btnPaginateText, setBtnPaginateText] = React.useState(getBtnPaginateText());

  const [statusMessage, setStatusMessage] = React.useState("");
  const [btnPaginateDisabled, setBtnPaginateDisabled] = React.useState(false);

  const getBtnCancelText = () => isNewQuery.current ? "Cancel" : "Close";
  const [btnCancelText, setBtnCancelText] = React.useState(getBtnCancelText());

  const [progressError, setProgressError] = React.useState(false);
  const [progressPercent, setProgressPercent] = React.useState(0);

  const [inputDisabled, setInputDisabled] = React.useState(false);
  const inputRef = React.useRef<Input>(null);
  // Run on the first render only hence the empty dependency array
  React.useEffect(() => { inputRef.current?.focus(); }, []);

  //#endregion

  //#region Rendering helpers

  const onPageCountChange = (_evt: React.ChangeEvent<HTMLInputElement>, data: InputOnChangeData) => {
    const result = Number.parseInt(data.value, 10);
    let resultValid = !!result && result > 0 && result <= pageCountRequestedMax;
    const remainingPages = getPageCountRemaining();

    if (remainingPages !== strUnknown && result > Number.parseInt(remainingPages, 10) + 1) {
      resultValid = false;
    }

    if (result) {
      setPageCountRequested({ error: !resultValid, value: result });
      if (resultValid) {
        setRowCountRequested(result * props.paginationRequest.rowCount);
      }
    } else {
      setPageCountRequested({ error: true, value: 0 });
    }
  };

  const closeModal = () => {
    setDefaults();
    props.closeModal();
  };

  const onCloseModal = () => {
    setDefaults();
  };

  const onPaginate = async () => {
    await doPaginate();
  };

  const setDefaults = () => {
    if (shouldSaveLastRequest()) {
      props.setPaginationRequest(props.paginationRequest);
    }

    loopingCount.current = undefined;
    abortController.current?.abort();
    abortController.current = undefined;
    isPaginating.current = false;
    isNewQuery.current = props.newQuery;

    setStatusMessage("");
    setBtnPaginateDisabled(false);
    setBtnCancelText("Cancel");
    setBtnPaginateText(getBtnPaginateText());
    setProgressError(false);
    setProgressPercent(0);
    setInputDisabled(false);
    // page and row counts
    setPageCountFetched(props.cache.getPageCount());
    setRowCountFetched(props.cache.getRowCount());
    setPageCountRequested(initialPageCount);
    setRowCountRequested(getRowCountRequested());
    setRowCountRemaining(getRowCountRemaining());
    setPageCountRemaining(getPageCountRemaining());
  };

  const setStatus: (status: {
    message: string
    error: boolean
    inFlight: boolean
  }) => void = ({ message, error, inFlight }) => {
    if (error) {
      logger.error(message);
    } else {
      logger.info(message);
    }
    isPaginating.current = inFlight;
    const allDataFetched = !error && !!props.cache.getLastPage() && !props.cache.getLastPage()!.token;
    setBtnPaginateDisabled(inFlight || allDataFetched);
    setInputDisabled(inFlight);
    setBtnPaginateText(getBtnPaginateText());
    setBtnCancelText(inFlight ? "Stop" : getBtnCancelText());
    setStatusMessage(message);
    setProgressError(error);
  };

  const handleOverlimit = () => {
    const err = QueryPage.getOverlimitError();
    setStatus({
      error: true,
      inFlight: false,
      message: err.message
    });
    setBtnPaginateDisabled(true);
    props.setError(err);
  };

  //#endregion

  //#region Pagination functions

  const doPaginate = async (): Promise<void> => {
    if (isNewQuery.current) {
      QueryPage.resetForNewQuery({
        actions: props.actions,
        cache: props.cache,
        clearError: props.clearError,
        setLastRequest: props.setPaginationRequest
      });
    } else {
      if (props.cache.isOverLimit()) {
        handleOverlimit();
        return Promise.resolve();
      }
    }

    // Set initial status
    setStatus({
      error: false,
      inFlight: true,
      message: "Paginating. Please wait..."
    });

    let req: IBackendRequestData = isNewQuery.current ?
      props.paginationRequest :
      QueryPage.augmentRequest(props.cache, props.paginationRequest);

    abortController.current?.abort();
    abortController.current = new AbortController();
    let fetchOutcome = false;
    let errFetch: Error | undefined;
    const interceptError = (err: Error) => { errFetch = err; props.setError(err); };

    for (let i = loopingCount.current ?? 0; i < pageCountRequested.value;) {
      fetchOutcome = await QueryPage.fetchOnePage({
        actions: props.actions,
        cache: props.cache,
        clearError: props.clearError,
        controller: abortController.current,
        newQuery: isNewQuery.current,
        request: req,
        setError: interceptError,
        setLastRequest: props.setPaginationRequest
      });

      if (fetchOutcome) {
        isNewQuery.current = false;
      } else {
        break;
      }

      ++i;
      loopingCount.current = i;
      setProgressPercent(Math.floor((i * 100) / pageCountRequested.value));

      if (props.cache.getLastPage()?.token) {
        req = QueryPage.augmentRequest(props.cache, req);
      } else {
        break;
      }
    }

    abortController.current = undefined;
    loopingCount.current = undefined;
    updateCounts();

    const moreData = !!props.cache.getLastPage()?.token && fetchOutcome;

    setStatus({
      error: !fetchOutcome,
      inFlight: false,
      message: fetchOutcome ?
        (moreData ? "Finished." : "Finished. All query data has been received.") :
        `Auto-pagination failed. ${errFetch}`
    });
    return Promise.resolve();
  };

  const shouldSaveLastRequest = () => {
    return props.newQuery && props.cache.getPageCount() > 0;
  };

  const updateCounts = () => {
    setPageCountFetched(props.cache.getPageCount());
    setRowCountFetched(props.cache.getRowCount());
    setRowCountRemaining(getRowCountRemaining());
    setPageCountRemaining(getPageCountRemaining());
  };

  //#endregion

  //#region Render

  return (
    <>
      <Modal
        size="small"
        onClose={onCloseModal}
        open={props.visible}
        closeIcon={false}
        closeOnEscape={true}
        closeOnDimmerClick={false}
      >
        <Modal.Header>
          <div className={cssModalHeader}>
            <div className={cssModalHeaderIcon}>
              <Icon name="fast forward" />
            </div>
            <div className={cssModalHeaderText}>
              Auto-paginate
            </div>
          </div>
        </Modal.Header>

        <Modal.Content>
          <Form>
            <div className={cssData}>

              <div className={cssDataFetched}>
                <Form.Group>
                  <Header
                    sub
                    className={cssSubHeader}
                  >
                    Data fetched
                  </Header>
                </Form.Group>
                <Form.Group>
                  <Form.Field width="7">
                    <label>Data pages</label>
                    <Segment size="small">
                      {pageCountFetched}
                    </Segment>
                  </Form.Field>
                  <Form.Field width="9">
                    <label>Data rows</label>
                    <Segment size="small">
                      {rowCountFetched}
                    </Segment>
                  </Form.Field>
                </Form.Group>
              </div>

              <div className={cssDataRequested}>
                <Form.Group>
                  <Header
                    sub
                    className={cssSubHeader}
                  >
                    Data to be fetched
                  </Header>
                </Form.Group>
                <Form.Group>
                  <Form.Field width="8">
                    <label>Data pages</label>
                    <Input
                      type="number"
                      min={pageCountRequestedDefault}
                      max={pageCountRequestedMax}
                      placeholder={pageCountRequestedDefault}
                      onChange={onPageCountChange}
                      step={pageCountRequestedDefault}
                      error={pageCountRequested.error}
                      disabled={inputDisabled}
                      ref={inputRef}
                      className={pageCountRequested.error ? cssInputError : cssInput}
                    />
                  </Form.Field>
                  <Form.Field width="8">
                    <label>Data rows</label>
                    <Segment size="small">
                      {rowCountRequested}
                    </Segment>
                  </Form.Field>
                </Form.Group>
              </div>

              <div className={cssDataRemaining}>
                <Form.Group>
                  <Header
                    sub
                    className={cssSubHeader}
                  >
                    Data not yet fetched
                  </Header>
                </Form.Group>
                <Form.Group>
                  <Form.Field width="7">
                    <label>Data pages</label>
                    <Segment size="small">
                      {pageCountRemaining}
                    </Segment>
                  </Form.Field>
                  <Form.Field width="9">
                    <label>Data rows</label>
                    <Segment size="small">
                      {rowCountRemaining}
                    </Segment>
                  </Form.Field>
                </Form.Group>
              </div>
            </div>

            <Divider />

            <Form.Group>
              <Header sub>Progress</Header>
            </Form.Group>
            <Form.Group>
              <Form.Field width="16">
                <Progress
                  percent={progressPercent}
                  autoSuccess
                  error={progressError}
                >
                  {String(progressPercent) + "%"}
                </Progress>
              </Form.Field>
            </Form.Group>

            <Divider />

            <Form.Group>
              <Header sub>Status</Header>
            </Form.Group>
            <Form.Group>
              <Form.Field width="16">
                <Segment error>
                  {statusMessage}
                </Segment>
              </Form.Field>
            </Form.Group>

            <Form.Group style={{ float: "right" }}>
              <div className={cssButtonPaginate}>
                <Button
                  size="tiny"
                  color="blue"
                  onClick={onPaginate}
                  disabled={btnPaginateDisabled || pageCountRequested.error}
                  className={cssButton}
                  loading={isPaginating.current}
                >
                  <Icon name={isNewQuery.current ? "cloud download" : "forward"} />
                  {btnPaginateText}
                </Button>
              </div>
              <div className={cssButtonCancel}>
                <Button
                  size="tiny"
                  color="blue"
                  onClick={closeModal}
                  className={cssButton}
                >
                  {btnCancelText}
                </Button>
              </div>
            </Form.Group>

          </Form>
        </Modal.Content>
      </Modal>
    </>
  );

  //#endregion
};
