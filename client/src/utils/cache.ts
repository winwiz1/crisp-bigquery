/*
  QueryCache provides client-side caching for the data received from
  the backend. Currently there is no limit on the amount of data held
  in memory which is only sustainable assuming other components limit
  this amount.
*/
import { BigQueryRetrievalResult } from "../api/BackendManager";

export type QueryCachePage = {
  index: number
  data: BigQueryRetrievalResult["rows"]
  token: BigQueryRetrievalResult["pageToken"]
  job: BigQueryRetrievalResult["jobId"]
  totalRows: BigQueryRetrievalResult["totalRows"]
  rows: BigQueryRetrievalResult["returnedRows"]
};

export class QueryCache {
  // Returns 'true' unless the limit on row count is reached in which
  // case returns 'false'.
  public readonly addPage = (retrieval: BigQueryRetrievalResult): boolean => {
    if (!retrieval) {
      return true;
    }

    if (!retrieval.jobComplete) {
      throw new Error(QueryCache.s_errMsgIncompleteJob);
    }

    if (this.isOverLimit()) {
      return false;
    }

    const pageCount = this.getPageCount();
    this.m_pages.push({
      data: retrieval.rows,
      index: pageCount,
      job: (retrieval.jobId || undefined),
      rows: retrieval.returnedRows,
      token: (retrieval.pageToken || undefined),
      totalRows: retrieval.totalRows,
    });

    this.m_rowCount += retrieval.rows.length;
    return true;
  }

  public readonly getPage = (idx: number): QueryCachePage | undefined => {
    return (idx < 0 || this.m_pages.length === 0 || idx >= this.m_pages.length) ?
      undefined : this.m_pages[idx];
  }

  public readonly getLastPage = (): QueryCachePage | undefined => {
    const count = this.getPageCount();

    return count > 0 ? this.m_pages[count - 1] : undefined;
  }

  public readonly getPageCount = (): number => {
    return this.m_pages.length;
  }

  public readonly getRowCount = (): number => {
    return this.m_rowCount;
  }

  public readonly clear = () => {
    this.m_pages.length = 0;
    this.m_rowCount = 0;
  }

  public readonly isOverLimit = () => {
    return this.m_rowCount > QueryCache.s_rowCountLimit;
  }

  private readonly m_pages: Array<QueryCachePage> = [];
  private m_rowCount: number = 0;
  private static readonly s_rowCountLimit = 200000;
  private static readonly s_errMsgIncompleteJob =
    "Cannot cache response data (incomplete job). Please contact Support.";
}
