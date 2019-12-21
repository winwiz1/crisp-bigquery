/*
  ExportCsv exports already fetched data to CSV file.
  Exporting is done in a piecemeal fashion e.g. one data page per time
  to reduce memory pressure.
*/
import * as React from "react";
import { style } from "typestyle";
import {
  Button,
  Divider,
  Form,
  Header,
  Icon,
  Modal,
  Popup,
  Progress,
  Segment
} from "semantic-ui-react";
import { QueryCache } from "../utils/cache";
import logger from "../utils/logger";
import { domErrorToString } from "../utils/error";
import { FileSystemStorage } from "../utils/filesystem";
import * as SPAs from "../../config/spa.config";

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

const cssButtonExport = style({
  marginLeft: "1em",
  marginRight: "1em",
  marginTop: "0.8em"
});

const cssButtonCancel = style({
  marginLeft: "1em",
  marginRight: "5em",
  marginTop: "0.8em"
});

const cssButtonTrigger = style({
  height: "2.5em"
});

const cssData = style({
  display: "flex"
});

const cssDataFetched = style({
  flex: "initial",
  width: "50%"
});

const cssDataAvailable = style({
  flex: "initial",
  width: "30%"
});

const cssSubHeader = style({
  wordSpacing: "0.2em"
});

//#endregion

export interface IExportCsvProps {
  cache: QueryCache;
}

/*
  The component renders self as a button.
  When the button is clicked, a modal dialog is shown.
*/
export const ExportCsv: React.FunctionComponent<IExportCsvProps> = props => {

  //#region Data

  const rowCount = props.cache.getRowCount();
  const hasData = rowCount > 0;
  if (!hasData) {
    return null;
  }

  const [modalVisible, setModalVisible] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState("");
  const [btnExportDisabled, setBtnExportDisabled] = React.useState(false);
  const [btnCancelText, setBtnCancelText] = React.useState("Cancel");
  const [btnExportText, setBtnExportText] = React.useState("Export");
  const [progressError, setProgressError] = React.useState(false);
  const [progressPercent, setProgressPercent] = React.useState(0);
  const storageHelper = React.useRef<FileSystemStorage | undefined>(undefined);

  const pageCount = props.cache.getPageCount();
  const csvTooltip = "Export data from " +
    `${pageCount} ${pageCount > 1 ? "pages" : "page"} to a CSV file.`;

  //#endregion

  //#region Rendering functions

  const showModal = () => {
    setModalVisible(true);
  };

  const closeModal = () => {
    storageHelper.current?.deleteFile();
    setDefaults();
  };

  const onCloseModal = () => {
    storageHelper.current?.deleteFile();
    setDefaults();
  };

  const setDefaults = () => {
    setModalVisible(false);
    setStatusMessage("");
    setBtnExportDisabled(false);
    setBtnCancelText("Cancel");
    setBtnExportText("Export");
    setProgressError(false);
    setProgressPercent(0);
    storageHelper.current = undefined;
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

    setBtnExportDisabled(inFlight);
    setBtnExportText(error ? "Export" : "Re-export");
    setBtnCancelText(inFlight ? "Stop" : (error ? "Cancel" : "Close"));
    setStatusMessage(message);
    setProgressError(error);
  };

  //#endregion

  //#region Export functions

  /*
    Creates an instance of the FileSystemStorage class.
    Returns undefined if fails.
  */
  const createStorageHelper = async (): Promise<FileSystemStorage | undefined> => {
    let ret = await FileSystemStorage.getQuota(100 * 1024 * 1024);
    if (!ret) {
      const status = FileSystemStorage.Status;
      setStatus({
        error: true,
        inFlight: false,
        message: "Error. Information for Support: Failed to allocate storage quota, " +
          domErrorToString(status.errorQuota)
      });
      return Promise.resolve(undefined);
    }

    ret = await FileSystemStorage.requestFileSystem();
    if (!ret) {
      const helperStatus = FileSystemStorage.Status;
      setStatus({
        error: true,
        inFlight: false,
        message: "Error. Information for Support: Failed to create filesystem, " +
          domErrorToString(helperStatus.errorQuota)
      });
      return Promise.resolve(undefined);
    }

    const storage = await FileSystemStorage.Factory();

    if (storage instanceof DOMError) {
      setStatus({
        error: true,
        inFlight: false,
        message: "Error. Information for Support: Failed to create storage helper, " +
          domErrorToString(storage)
      });
      return Promise.resolve(undefined);
    } else {
      return Promise.resolve(storage);
    }
  };

  /*
    Downloads a file URL to disk.
  */
  const downloadFile = (url: string): void => {
    const className = "bigquery-export-anchor";
    const link = document.querySelector("." + className);
    let downloadLink: HTMLAnchorElement | undefined;

    if (link) {
      downloadLink = link as HTMLAnchorElement;
    } else {
      downloadLink = document.createElement("a");
      downloadLink.download = SPAs.appTitle + " data export.csv";
      downloadLink.href = url;
      downloadLink.className = className;
      downloadLink.style.display = "none";
      document.body.appendChild(downloadLink);
    }

    downloadLink.click();
  };

  /*
    Performs export
  */
  const doExport = async (): Promise<void> => {
    // Set initial status
    setProgressPercent(0);
    setStatus({
      error: false,
      inFlight: true,
      message: "Exporting. Please wait..."
    });

    // Get storage helper
    if (!storageHelper.current) {
      storageHelper.current = await createStorageHelper();
    }
    if (!storageHelper.current) {
      return;
    }

    if (!await storageHelper.current.truncateFile()) {
      setStatus({
        error: true,
        inFlight: false,
        message: "Error. Information for Support: Failed to truncate file, " +
          domErrorToString(storageHelper.current.Error)
      });
      return;
    }

    // Create CSV helper

    // Get the default export e.g. module.default
    // using destructuring assignment with renaming.
    const { default: CsvHelper } = await import(
      /* webpackChunkName: "csv" */
      /* webpackMode: "lazy" */
      /* webpackPrefetch: "false" */
      "../utils/csv"
    );

    const appendData = async (blob: Blob): Promise<boolean> => {
      return await storageHelper.current?.appendData(blob) ?? Promise.resolve(false);
    };

    const csvHelper = new CsvHelper({
      appendRoutine: appendData,
      cache: props.cache,
      progressRoutine: (percent: number) => setProgressPercent(Math.floor(percent)),
    });

    // Use both helpers decoupled from each other
    // e.g. unaware of each other to convert data.
    const outcome = await csvHelper.performConversion();

    // Set exit status
    setStatus({
      error: !outcome,
      inFlight: false,
      message: outcome ? "Finished." : "Export failed."
    });

    // Copy file from virtual filesystem to disk filesystem
    if (outcome) {
      const url = storageHelper.current.getUrl();
      downloadFile(url);
    }
  };

  //#endregion

  //#region Render

  return (
    <>
      <Modal
        size="small"
        onClose={onCloseModal}
        open={modalVisible}
        trigger={
          <Popup
            content={csvTooltip}
            trigger={
              <Button
                compact
                size="tiny"
                color="blue"
                disabled={!FileSystemStorage.Supported}
                onClick={showModal}
                className={cssButtonTrigger}
              >
                <Icon name="share square" />
                Export as CSV
              </Button>
            }
          />
        }
        closeIcon={false}
        closeOnEscape={true}
        closeOnDimmerClick={false}
      >
        <Modal.Header>
          <div className={cssModalHeader}>
            <div className={cssModalHeaderIcon}>
              <Icon name="share square" />
              <Icon name="file alternate outline" />
            </div>
            <div className={cssModalHeaderText}>
              Export to CSV file
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
                      Fetched data to be exported
                  </Header>
                </Form.Group>
                <Form.Group>
                  <Form.Field width="4">
                    <label>Data pages</label>
                    <Segment size="small">
                      {pageCount}
                    </Segment>
                  </Form.Field>
                  <Form.Field width="6">
                    <label>Data rows</label>
                    <Segment size="small">
                      {rowCount}
                    </Segment>
                  </Form.Field>
                </Form.Group>
              </div>
              <div className={cssDataAvailable}>
                <Form.Group>
                  <Header
                    sub
                    className={cssSubHeader}
                  >
                    Data available on the server
                  </Header>
                </Form.Group>
                <Form.Group>
                  <Form.Field width="11">
                    <label>Data rows</label>
                    <Segment size="small">
                      {props.cache.getPage(0)!.totalRows}
                    </Segment>
                  </Form.Field>
                </Form.Group>
              </div>
            </div>

            <Divider />

            <Form.Group>
              <Header
                sub
                className={cssSubHeader}
              >
                Progress
              </Header>
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
              <div className={cssButtonExport}>
                <Button
                  autofocus
                  size="tiny"
                  color="blue"
                  onClick={doExport}
                  disabled={btnExportDisabled}
                >
                  {btnExportText}
                </Button>
              </div>
              <div className={cssButtonCancel}>
                <Button
                  size="tiny"
                  color="blue"
                  onClick={closeModal}
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
