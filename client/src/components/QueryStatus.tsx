import * as React from "react";
import { style, media } from "typestyle";
import { Message } from "semantic-ui-react";
import { QueryCache } from "../utils/cache";
import logger from "../utils/logger";

export interface IQueryStatusProps {
  status: {
    currentPage: number;
    cache: QueryCache;
    err?: Error
    clearError: () => void
    scroll: () => void
  };
}

// When Message.onDismiss is set, the component behaves as a block element.
// We limit he width it takes, otherwise the error message can become too elongated.
const cssMaxWidth = style(
  { transition: "all .5s" },
  media({ maxWidth: 1024 }, { maxWidth: "50vw" }),
  media({ minWidth: 1025 }, { maxWidth: "35vw" }),
);

export const QueryStatus: React.FunctionComponent<IQueryStatusProps> = props => {
  const pageCnt = props.status.cache.getPageCount();
  const moreData = !!props.status.cache.getLastPage()?.token && !props.status.err;
  const hasData = props.status.cache.getRowCount() > 0;
  const finished = !moreData && hasData;
  let header: string | undefined;
  let message: string | undefined;

  if (props.status.err) {
    header = "Error";
    const errTime = new Date().toLocaleString("en-US", { hour12: false });
    message = `Time: ${errTime} Description: ${props.status.err.message}`;
  } else if (moreData) {
    header = "More data available";
    message = `Switch to the page ${pageCnt + 1} to request it.`;
  } else if (finished) {
    header = "Query finished";
    message = "All query data has been received";
  }

  const statusData = {
    error: !!props.status.err,
    header,
    message,
    moreData,
    queryFinished: finished
  };

  const bothFlagsSet = statusData.moreData && statusData.queryFinished;
  const eitherFlagSetNoMessage = (statusData.error || statusData.moreData) &&
    !statusData.message;

  if (bothFlagsSet || eitherFlagSetNoMessage) {
    // Can only happen if code is incorrectly modified
    const errMsg = "Inconsistent query status data. Please contact Support.";
    logger.error(`QueryStatus props are inconsistent:
      error: ${statusData.error}, moreData: ${statusData.moreData},
      queryFinished: ${statusData.queryFinished}, message: ${statusData.message ?? "<not set>"}`);
    throw new Error(errMsg);
  }

  let iconName = "";

  if (statusData.error) {
    iconName = "exclamation circle";
  } else if (statusData.moreData) {
    iconName = "copy outline";
  } else if (statusData.queryFinished) {
    iconName = "check circle green";
  }

  const onDismiss = (_event: React.MouseEvent<HTMLElement>, _data: any): void => {
    props.status.clearError();
  };

  return (
    <div className={cssMaxWidth}>
      <Message
        hidden={!statusData.message}
        icon={iconName}
        error={statusData.error}
        info={statusData.moreData}
        positive={statusData.queryFinished}
        onDismiss={statusData.error ? onDismiss : undefined}
        content={statusData.message}
        header={statusData.header}
      />
    </div>
  );
};
