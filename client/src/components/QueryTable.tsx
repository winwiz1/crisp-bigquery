/*
  QueryTable provides a tabular view of the data fetched from backend.
  The tabular view is comprised of columns that are configured by an
  array of IColumn objects.
*/
import * as React from "react";
import { style } from "typestyle";
import * as moment from "moment";
import {
  Table,
  Label,
  Popup,
  Grid,
  Icon,
  SemanticWIDTHS
} from "semantic-ui-react";
import { QueryCache, QueryCachePage } from "../utils/cache";
import {
  QueryPaginationContainer,
  IQueryPaginationContainerProps
} from "./QueryPaginationContainer";
import { BigQueryRetrievalRow } from "../api/BackendManager";

// A column that QueryTable can render.
interface IColumn {
  // Must match the name of a column selected by the backend-side SQL statement.
  name: string;
  // If present will be used as the column header instead of name.
  alias?: string;
  // Width of the column relative to other columns.
  width: SemanticWIDTHS;
  // If set to 'false' then the column is ignored.
  visible: boolean;
  // If set to 'true' then the column will use only as much space as needed.
  collapsing?: boolean;
  // Optional routine which takes the table cell's data from the dataset
  // and outputs cell's content. Used for client-side post-processing of data.
  alter?: (cellData: string | undefined) => string;
}

// QueryTable renders this array of columns.
// The visible columns are displayed in the given order.
// The columns with 'visible: false' are ignored.
/* tslint:disable:object-literal-sort-keys */
const columns: ReadonlyArray<IColumn> = [
  {
    name: "DateTime",
    alias: "Creation Time",
    width: 2,
    visible: true,
    collapsing: true,
    alter: (cellData) => {
      return cellData ?
        moment(cellData).toDate().toLocaleString("en-US", { timeZone: "UTC", hour12: false }) :
        "<no data>";
    }
  },
  {
    name: "Name",
    alias: "Repository Name",
    width: 3,
    visible: true,
  },
  {
    name: "Language",
    width: 2,
    visible: true,
  },
  {
    name: "Homepage",
    alias: "URL",
    width: 4,
    visible: true,
    alter: (cellData) => clipString(cellData, 50)
  },
  {
    name: "Owner",
    width: 2,
    visible: true,
  },
  {
    name: "Login",
    width: 2,
    visible: true
  },
  {
    name: "Size",
    width: 1,
    visible: true,
    collapsing: true,
  },
];
/* tslint:enable:object-literal-sort-keys */

// Filtered columns that need to be rendered by QueryTable
const filteredColumns = columns.filter(column => column.visible);

// Demonstrates client-side post-processing which we didn't want
// the backend to engage with
function clipString(str: string|undefined, max_length: number): string {
  if (!str) {
    return "";
  }
  const tail = "...";
  return str.length > max_length ?
    str.substring(0, max_length - tail.length) + tail :
    str;
}

// Style for TableCellNoData
const cssCellNoData = style({
  margin: "2em",
});

// Properties for TableCellNoData
interface ITableCellNoData {
  colSpan: number;
  // If 'true' then there is no cache page to render
  noPage: boolean;
  // If true then there is a cache page (with data fetched from backend)
  // and the row count is zero
  noDataFound: boolean;
}

/*
  TableCellNoData is a helper that renders
  "No data found" message inside QueryTable
*/
const TableCellNoData: React.FunctionComponent<ITableCellNoData> = props => {
  const noPageMsg = "No data. Please run a query.";
  const noDataMsg = "No data has been found to satisfy the query options.";
  // Can only be displayed if code is incorrectly modified
  const errMsg = "Internal error. Please notify Support";

  return (
    <Table.Cell colSpan={props.colSpan} textAlign="center">
      <div className={cssCellNoData}>
        <Label size="large">
          <Icon name="meh" size="big" />
          {props.noPage ? noPageMsg : (props.noDataFound ? noDataMsg : errMsg)}
        </Label>
      </div>
    </Table.Cell>
  );
};

/*
  Helper that returns an array of Table.HeaderCell components
*/
const headerCells = (): ReadonlyArray<JSX.Element> => {
  const hdrCells: ReadonlyArray<JSX.Element> =
    columns.filter(column => column.visible)
      .map((column, idx) =>
        <Table.HeaderCell
          width={column.width}
          key={idx}
          collapsing={column.collapsing ?? false}
        >
          {column.alias ?? column.name}
        </Table.HeaderCell>
      );

  return hdrCells;
};

/*
  Helper that returns an array of Table.Row components
*/
const tableRows = (data: QueryCachePage["data"] | undefined): ReadonlyArray<JSX.Element> => {
  const rows: Array<JSX.Element> = [];

  if (data) {
    data.map((row, ind) =>
      rows.push(
        <Table.Row key={ind}>
          {filteredColumns.map((column, idx) => {
            const cellData = row[column.name as keyof BigQueryRetrievalRow];
            return (
              <Table.Cell key={idx}>
                {column.alter ? column.alter(cellData) : cellData}
              </Table.Cell>
            );
          })
          }
        </Table.Row>
      )
    );
  }

  return rows;
};

// Styles used by QueryTable
const cssHeading = style({
  fontSize: "1.33em",
  fontWeight: "bold",
  marginBottom: "1em",
  marginLeft: "1.1em",
  marginRight: "0",
  marginTop: "1.5em"
});
const cssHeadingCurrentPage = style({
  display: "inline-block",
  float: "right",
  fontSize: "0.75em",
  fontWeight: "normal",
  marginBottom: "0",
  marginLeft: "0",
  marginRight: "1em",
  marginTop: "0",
});
const cssPopupHeader = style({
  marginBottom: "1em",
  marginLeft: "0",
  marginRight: "0",
  marginTop: "0",
  textAlign: "center",
});
const cssPopupRow = style({
  paddingBottom: "5px !important",
  paddingTop: "5px !important"
});

// The shape of QueryTable properties
interface IQueryTableProp {
  currentPage: number;
  cache: QueryCache;
  err?: Error;
  className: string;
  clearError: () => void;
}

/*
  QueryTable implementation
*/
export const QueryTable: React.FunctionComponent<IQueryTableProp> = props => {
  const noCurrentPage = props.cache.getPageCount() === 0;
  const noDataFound = !noCurrentPage && props.cache.getRowCount() === 0;
  const dataPage = props.cache.getPage(props.currentPage);
  const scrollAid = !noCurrentPage && dataPage!.data.length > 10;
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  const topRef = React.useRef<HTMLDivElement>(null);
  const scrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Properties for QueryPaginationContainer
  const paginationProps: IQueryPaginationContainerProps = {
    status: {
      cache: props.cache,
      clearError: props.clearError,
      currentPage: props.currentPage,
      err: props.err,
      scroll: scrollToTop,
    }
  };

  return (
    <section className={props.className}>
      <div className={cssHeading}>
        Query Data
        <div className={cssHeadingCurrentPage} ref={topRef}>
          { scrollAid &&
            <Label as="a" size="large" horizontal onClick={scrollToBottom}>
              <Icon name="arrow down" />
              Scroll to the bottom
            </Label>
          }
          &nbsp;
          <Popup
            wide
            disabled={noCurrentPage}
            trigger={
              <span>
                Page {dataPage ? dataPage.index + 1 : 1}
              </span>
            }
          >
            <Popup.Header className={cssPopupHeader}>
              Record counts
            </Popup.Header>
            <Popup.Content>
              <Grid columns={2} padded={false} stretched={true}>
                <Grid.Row className={cssPopupRow}>
                  <Grid.Column width={12} textAlign="left" floated="left">
                    Produced by query
                  </Grid.Column>
                  <Grid.Column width={4} textAlign="center" floated="right">
                    {noCurrentPage ? 0 : dataPage!.totalRows}
                  </Grid.Column>
                </Grid.Row>
                <Grid.Row className={cssPopupRow}>
                  <Grid.Column width={12} textAlign="left" floated="left">
                    Sent for this page
                  </Grid.Column>
                  <Grid.Column width={4} textAlign="center" floated="right">
                    {noCurrentPage ? 0 : dataPage!.rows}
                  </Grid.Column>
                </Grid.Row>
                <Grid.Row className={cssPopupRow}>
                  <Grid.Column width={12} textAlign="left" floated="left">
                    Eliminated by deduplication
                  </Grid.Column>
                  <Grid.Column width={4} textAlign="center" floated="right">
                    {noCurrentPage ? 0 : (dataPage!.rows - dataPage!.data.length)}
                  </Grid.Column>
                </Grid.Row>
                <Grid.Row className={cssPopupRow}>
                  <Grid.Column width={12} textAlign="left" floated="left">
                    Shown
                  </Grid.Column>
                  <Grid.Column width={4} textAlign="center" floated="right">
                    {noCurrentPage ? 0 : dataPage!.data.length}
                  </Grid.Column>
                </Grid.Row>
              </Grid>
            </Popup.Content>
          </Popup>
        </div>
      </div>
      <Table unstackable celled striped>
        <Table.Header>
          <Table.Row>
            {headerCells()}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {(noCurrentPage || noDataFound) ? (
            <Table.Row>
              <TableCellNoData
                colSpan={filteredColumns.length}
                noPage={noCurrentPage}
                noDataFound={noDataFound}
              />
            </Table.Row>
          ) : (
              tableRows(dataPage!.data)
            )
          }
        </Table.Body>
      </Table>
      <QueryPaginationContainer {...paginationProps} />
      <div
        style={{ float: "left", clear: "left" }}
        ref={bottomRef}
      />
    </section>
  );
};
