/*
  Pagination component renders query status and manages pagination.
*/
import * as React from "react";
import { style } from "typestyle";
import {
  Icon,
  Pagination as SemanticPagination,
  PaginationProps as SemanticPaginationProps
} from "semantic-ui-react";
import { IFetchState } from "../state/store";
import { actionCreators } from "../state/actions";
import {
  // This part/slice of PaginationProps contains data and a callback
  // supplied by the parent component. Used to render query status.
  IQueryStatusProps,
  QueryStatus
} from "./QueryStatus";

// This part/slice of PaginationProps contains data supplied by
// Redux store and related to fetching result.
// Used to manage pagination.
export interface IQueryFetchProps {
  fetch: IFetchState;
}

// This part/slice of PaginationProps contains functions that
// create and dispatch Redux actions. Used to manage pagination.
export interface IQueryActionProps {
  actions: typeof actionCreators;
}

// The type of props accepted by Pagination component
// is the intersection of the above slices.
type QueryPaginationProps =
  IQueryStatusProps &
  IQueryFetchProps &
  IQueryActionProps;

// Styles used by the Pagination component.
const cssFlexContainer = style({
  display: "flex",
  flexDirection: "row",
  flexWrap: "nowrap",
  margin: "1em"
});
const cssStatus = style({
  flex: "1 1 auto",
  margin: "1em",
});
const cssPagination = style({
  flex: "0 1 auto",
  margin: "1em"
});

/*
  QueryPagination component
*/
export const QueryPagination = (props: QueryPaginationProps) => {
  const disabled = props.fetch.pageCount === 0;

  const onPageChange = (_evt: React.MouseEvent<HTMLAnchorElement>, data: SemanticPaginationProps): void => {
    data.activePage && props.actions.actionSetPage(data.activePage as number - 1);
  };

  return (
    <div className={cssFlexContainer}>
      <section className={cssStatus}>
        <QueryStatus status={{...props.status, pageCnt: props.fetch.pageCount}} />
      </section >
      <nav className={cssPagination}>
        <SemanticPagination
          disabled={disabled}
          defaultActivePage={disabled ? 0 : props.fetch.currentPage + 1}
          ellipsisItem={{ content: <Icon name="ellipsis horizontal" />, icon: true }}
          firstItem={null}
          lastItem={null}
          prevItem={{ content: <Icon name="angle left" />, icon: true }}
          nextItem={{ content: <Icon name="angle right" />, icon: true }}
          totalPages={props.fetch.pageCount}
          size="mini"
          onPageChange={onPageChange}
        />
      </nav>
    </div>
  );
};
