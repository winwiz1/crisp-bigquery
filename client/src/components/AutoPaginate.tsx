/*
  Performs auto-pagination and adds the fetched data to the cache.
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
  marginLeft: "1em",
  marginRight: "1em",
  marginTop: "0.8em",
  marginBottom: "0.5em"
});

const cssButtonCancel = style({
  marginLeft: "1em",
  marginRight: "4em",
  marginTop: "0.8em",
  marginBottom: "0.5em"
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
}

/*
  The component is a controlled modal.
  It facilitates auto-pagination.
*/
export const AutoPaginate: React.FunctionComponent<IAutoPaginateProps> = props => {
  if (!props.visible) {
     return null;
  }

  //#region Data

  // Sanity check
  if (!props.paginationRequest?.rowCount) {
    // Can only happen if code is incorrectly modified
    throw new Error("Invalid auto-pagination data. Please contact Support.");
  }

  // Page and row counts

  const pageCountRequestedMax = 100;
  const pageCountRequestedDefault = 10;

  const [pageCountFetched, setPageCountFetched] =
    React.useState(props.cache.getPageCount());

  const [rowCountFetched, setRowCountFetched] =
    React.useState(props.cache.getRowCount());

  const initialPageCount = {
    error: false,
    value: pageCountRequestedDefault
  };
  const [pageCountRequested, setPageCountRequested] =
    React.useState<typeof initialPageCount>(initialPageCount);

  const getRowCountRequested = () => pageCountRequested.value * props.paginationRequest.rowCount;
  const [rowCountRequested, setRowCountRequested] =
    React.useState(getRowCountRequested());

  const strUnknown = "Unknown";
  const getRowCountRemaining = () => (props.cache.getPage(0)?.totalRows === undefined) ?
    strUnknown : (props.cache.getPage(0)!.totalRows - rowCountFetched).toString();
  const [rowCountRemaining, setRowCountRemaining] =
    React.useState(getRowCountRemaining());

  const getPageCountRemaining = () => rowCountRemaining === strUnknown ?
    strUnknown : Math.ceil(
      Number.parseInt(rowCountRemaining, 10) / props.paginationRequest.rowCount
    ).toString();
  const [pageCountRemaining, setPageCountRemaining] =
    React.useState(getPageCountRemaining());

  // Other UI fixtures

  const [isNewQuery, setIsNewQuery] = React.useState(props.newQuery);
  const getBtnPaginateText = () => isNewQuery ? "New query" : "Paginate";
  const [btnPaginateText, setBtnPaginateText] = React.useState(getBtnPaginateText());
  const [statusMessage, setStatusMessage] = React.useState("");
  const [btnPaginateDisabled, setBtnPaginateDisabled] = React.useState(false);
  const [btnCancelText, setBtnCancelText] = React.useState("Cancel");
  const [progressError, setProgressError] = React.useState(false);
  const [progressPercent, setProgressPercent] = React.useState(0);
  const [inputDisabled, setInputDisabled] = React.useState(false);
  const abortController = React.useRef<AbortController | undefined>(undefined);
  const inputRef = React.useRef<Input>(null);
  // Run on the first render only hence the empty dependency array
  React.useEffect(() => { inputRef.current?.focus(); }, []);

   //#endregion

   //#region Rendering helpers

  const onPageCountChange = (_evt: React.ChangeEvent<HTMLInputElement>, data: InputOnChangeData) => {
    const result = Number.parseInt(data.value, 10);
    let resultValid = !!result && result > 0 && result <= pageCountRequestedMax;

    if (pageCountRemaining !== strUnknown && result > Number.parseInt(pageCountRemaining, 10)) {
      resultValid = false;
    }

    if (result) {
      setPageCountRequested({
        error: !resultValid,
        value: result
      });
      if (resultValid) {
        setRowCountRequested(result * props.paginationRequest.rowCount);
      }
    } else {
      setPageCountRequested({
        error: true,
        value: 0
      });
    }
  };

  const closeModal = () => {
    setDefaults();
    props.closeModal();
  };

  const onCloseModal = () => {
    setDefaults();
  };

  const setDefaults = () => {
    setIsNewQuery(props.newQuery);
    setStatusMessage("");
    setBtnPaginateDisabled(false);
    setBtnCancelText("Cancel");
    setBtnPaginateText(getBtnPaginateText());
    setProgressError(false);
    setProgressPercent(0);
    setInputDisabled(false);
    abortController.current = undefined;
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

    setBtnPaginateDisabled(inFlight);
    setBtnPaginateText(error ? "Start" : "Paginate");
    setBtnCancelText(inFlight ? "Stop" : (error ? "Cancel" : "Close"));
    setStatusMessage(message);
    setProgressError(error);
  };

  //#endregion

  //#region Pagination functions

  const doPaginate = async (): Promise<void> => {
    // Set initial status
    setProgressPercent(0);
    setStatus({
      error: false,
      inFlight: true,
      message: "Exporting. Please wait..."
    });

    // TODO
    alert("Not implemented");

    setStatus({
      error: false,
      inFlight: false,
      message: "Finished"
    });
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
                  onClick={doPaginate}
                  disabled={btnPaginateDisabled || pageCountRequested.error}
                  className={cssButton}
                >
                  <Icon name={isNewQuery ? "cloud download" : "forward"} />
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
};

//#endregion
