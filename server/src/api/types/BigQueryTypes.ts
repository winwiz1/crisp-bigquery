import * as moment from "moment";

/***********************************************************************
*  Types related to data received from BigQuery
***********************************************************************/

export class BigQueryRetrievalRow {
  readonly DateTime?: string;
  readonly Name?: string;
  readonly Language?: string;
  readonly Size?: string;
  readonly Homepage?: string;
  readonly Login?: string;
  readonly Owner?: string;

  static readonly isDuplicate = (
    row1: BigQueryRetrievalRow,
    row2: BigQueryRetrievalRow,
    timeDiff: number
  ): boolean => {
    if (!!row1 !== !!row2) {
      return false;
    }
    if (!row1 || !row2) {
      return false;
    }
    return Math.abs(BigQueryRetrievalRow.getMoment(row1).diff(
      BigQueryRetrievalRow.getMoment(row2), "seconds")) > timeDiff ?
      false : (BigQueryRetrievalRow.asString(row1) === BigQueryRetrievalRow.asString(row2));
  }

  /******************* private methods **********************/

  private static asString(row: BigQueryRetrievalRow): string {
    const str = (row.Name ?? "").toUpperCase() + (row.Language ?? "");
    return str;
  }

  private static getMoment(row: BigQueryRetrievalRow): moment.Moment {
    return moment.utc(row.DateTime);
  }
}

export class BigQueryRetrievalResult {
  constructor(
    public rows: ReadonlyArray<BigQueryRetrievalRow>,
    readonly jobComplete: boolean,
    readonly totalRows: number,           // count of rows processed in all relevant tables
    readonly returnedRows: number,        // could differ from this.rows.length due to deduplicated rows
    readonly totalBytesProcessed: number, // count of bytes processed (needs to be rounded up to 10MB)
    readonly pageToken?: string,          // undefined -> no more data, string -> invitation to paginate
    readonly jobId?: string) {            // as above
  }
}

/*
   API data
*/
export type BigQueryRetrieval = BigQueryRetrievalResult | Error;

/*
   API data storage interface
*/
export interface IBigQueryData {
  readonly Data: BigQueryRetrieval;
}

/***********************************************************************
*  Types related to constructing a BigQuery request
***********************************************************************/

type LaxString = string | undefined | null;

/*
Interface IBigQueryRequest has all the pieces of data required to make a request:
startDate:  E.g. '2019-02-14'. Time, if any, is ignored and start-of-day time
            is always used for the supplied Date which is considered to be GMT.
endDate:    As above but end-of-day time is used instead. Must not be more
            than 1 week apart from startDate.
rowCount:   Limit on how much rows of data the response should contain.
            If there is more data available, then BigQuery will suggest
            pagination by returning pageToken and jobId.
name:       Optional. Case-sensitive. Can be used with language or without.
            May not contain whitespace. Usage in query: LIKE 'name%'.
language:   Optional. Case-sensitive. Can be used with name or without.
            May not contain whitespace. Usage in query: LIKE 'language%'.
pageToken:  Optional opaque string taken from response. Not used in the first
            request. Used in the second and subsequent requests for paginated
            queries.
jobId:      as pageToken above.
deduplicationTimeDiff: optional timeframe in seconds, up to 3600*24. Identical
            (same name and language) and adjustent rows of data within this
            timeframe will skipped except for the first such row. Zero value
            disables deduplication.
*/
interface IBigQueryRequest {
  readonly startDate: moment.Moment;
  readonly endDate: moment.Moment;
  readonly deduplicationTimeDiff: number;
  readonly rowCount: number;
  readonly clientAddress: string;
  readonly name?: string;
  readonly language?: string;
  readonly pageToken?: string;
  readonly jobId?: string;
}

export type JsonParsingError = { message?: string };

/*
  Class BigQueryRequest used to parse and validate a JSON request received from the client.
*/
export class BigQueryRequest implements IBigQueryRequest {
  // Factory method. Returns undefined when fails in which case _errInfo
  // is set to a meaningful value.
  // Keeping constructor private ensures all attempts to instantiate the
  // class have to use this method (and the input data validation it uses).
  static fromJson(
    objJson: any,
    clientAddress: string,
    errInfo: JsonParsingError,
    useQueryCache = true): BigQueryRequest | undefined {
    try {
      const dataJson: IBigQueryRequest = {
        clientAddress: BigQueryRequest.getClientAddress(clientAddress),
        deduplicationTimeDiff: BigQueryRequest.getDeduplicationTimeDiff(objJson.deduplicationTimeDiff),
        endDate: BigQueryRequest.getDate(objJson.endDate, "endDate"),
        jobId: BigQueryRequest.getJobId(objJson.jobId),
        language: BigQueryRequest.getLanguage(objJson.language),
        name: BigQueryRequest.getName(objJson.name),
        pageToken: BigQueryRequest.getPageToken(objJson.pageToken),
        rowCount: BigQueryRequest.getRowCount(objJson.rowCount),
        startDate: BigQueryRequest.getDate(objJson.startDate, "startDate"),
      };
      BigQueryRequest.validateRequestParams(dataJson);
      return new BigQueryRequest(dataJson, useQueryCache);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : (
        "Exception: <" +
        Object.keys(err).map((key) => `${key}: ${err[key] ?? "no data"}`).join("\n") +
        ">"
      );

      errInfo.message = `Request parsing failed, error: ${errMsg}`;
      return undefined;
    }
  }

  static get Path(): string {
    return BigQueryRequest.s_queryPath;
  }

  static get RegexName(): RegExp {
    return BigQueryRequest.s_regexName;
  }

  static get RegexLanguage(): RegExp {
    return BigQueryRequest.s_regexLanguage;
  }

  getSqlTimeClause(): string {
    const strFormat = "YYYY-MM-DD";
    const strStart = this.startDate.utc().format(strFormat);
    const strEnd = this.endDate.utc().format(strFormat);
    return `BETWEEN '${strStart} 00:00:00' AND '${strEnd} 23:59:59'`;
  }

  getSqlParamClause(): string {
    let ret = "";
    this.name && (ret += " AND repository_name LIKE CONCAT(@name, '%')");
    this.language && (ret += " AND repository_language LIKE CONCAT(@language, '%')");
    return ret;
  }

  get RowCount(): number {
    return this.rowCount;
  }

  get PageToken(): string | undefined {
    return this.pageToken;
  }

  get JobId(): string | undefined {
    return this.jobId;
  }

  get DeduplicationTimeDiff(): number {
    return this.deduplicationTimeDiff;
  }

  /********************** private methods and data ************************/

  private constructor(data: IBigQueryRequest, useQueryCache = true) {
    this.startDate = data.startDate;
    this.endDate = data.endDate;
    this.rowCount = data.rowCount;
    this.clientAddress = data.clientAddress;
    this.name = data.name;
    this.language = data.language;
    this.pageToken = data.pageToken;
    this.jobId = data.jobId;
    this.deduplicationTimeDiff = data.deduplicationTimeDiff;
    this.useQueryCache = useQueryCache;
  }

  private static validateRequestParams(params: IBigQueryRequest): void {
    if (params.rowCount < 0 || params.rowCount > BigQueryRequest.s_maxRowCount) {
      throw new RangeError("Parameter rowCount is invalid");
    }

    if (params.deduplicationTimeDiff < 0 || params.deduplicationTimeDiff > BigQueryRequest.s_maxDeduplicationTimeDiff) {
      throw new RangeError("Parameter deduplicationTimeDiff is invalid");
    }

    if (params.startDate.isAfter(params.endDate) ||
                                 params.endDate.diff(params.startDate, "days", true) >
                                 (BigQueryRequest.s_maxDateIntervalDays + 1.0)) {
      throw new EvalError("Parameters startDate and endDate are inconsistent");
    }

    if (BigQueryRequest.isUndefined(params.jobId) !== BigQueryRequest.isUndefined(params.pageToken)) {
      throw new EvalError("Parameters jobId and pageToken are inconsistent");
    }
  }

  private static isString(x: any): x is string {
    return typeof x === "string" && x.length > 0;
  }

  private static isInteger(x: any): x is number {
    return typeof x === "number" && Number.isInteger(x);
  }

  private static isUndefined(x: any): boolean {
    return typeof x === "undefined" ? true : false;
  }

  private static isDateValid(str: LaxString): boolean {
    if (BigQueryRequest.isString(str)) {
      const ret = str.length > 0 && str.length < 32 && !isNaN(Date.parse(str));
      return ret;
    }
    return false;
  }

  private static isRowCountValid(str: LaxString): boolean {
    if (BigQueryRequest.isString(str) || BigQueryRequest.isInteger(str)) {
      return BigQueryRequest.s_regexRowCount.test(str);
    }
    return false;
  }

  private static isClientAddressValid(str: string): boolean {
    // Comes from server and not from client, therefore apply
    // simplified validation
    return !!str;
  }

  private static isNameValid(str: LaxString): boolean {
    if (BigQueryRequest.isString(str)) {
      return BigQueryRequest.s_regexName.test(str);
    }
    return BigQueryRequest.isUndefined(str);
  }

  private static isLanguageValid(str: LaxString): boolean {
    if (BigQueryRequest.isString(str)) {
      return BigQueryRequest.s_regexLanguage.test(str);
    }
    return BigQueryRequest.isUndefined(str);
  }

  private static isPageTokenValid(str: LaxString): boolean {
    if (BigQueryRequest.isString(str)) {
      return BigQueryRequest.s_regexPageToken.test(str);
    }
    return BigQueryRequest.isUndefined(str);
  }

  private static isJobIdValid(str: LaxString): boolean {
    if (BigQueryRequest.isString(str)) {
      return BigQueryRequest.s_regexJobId.test(str);
    }
    return BigQueryRequest.isUndefined(str);
  }

  private static isDeduplicationTimeDiffValid(str: string): boolean {
    if (BigQueryRequest.isInteger(str)) {
      return BigQueryRequest.s_regexDeduplicationTimeDiff.test(str);
    }
    return false;
  }

  private static getRowCount(str: LaxString): number {
    if (!str) {
      throw new TypeError("Parameter rowCount is missing");
    }
    if (!BigQueryRequest.isRowCountValid(str)) {
      throw new EvalError("Parameter rowCount is invalid");
    }
    const ret = Number.parseInt(str, 10);
    return ret;
  }

  private static getDate(str: LaxString, paramName: string): moment.Moment {
    if (!str) {
      throw new TypeError(`Parameter ${paramName} is missing`);
    }
    if (!BigQueryRequest.isDateValid(str)) {
      throw new EvalError(`Parameter ${paramName} is invalid`);
    }
    const date = new Date(str);
    const ret = moment.utc(date);
    return ret;
  }

  private static getClientAddress(str: string): string {
    if (!str) {
      throw new TypeError("Parameter clientAddress is missing");
    }
    if (!BigQueryRequest.isClientAddressValid(str)) {
      throw new EvalError("Parameter clientAddress is invalid");
    }
    return str;
  }

  private static getName(str: LaxString): string | undefined {
    if (!str) {
      return undefined;
    }
    const ret = str.trim();
    if (!ret) {
      return undefined;
    }
    if (!BigQueryRequest.isNameValid(ret)) {
      throw new EvalError("Parameter name is invalid");
    }
    return ret;
  }

  private static getLanguage(str: LaxString): string | undefined {
    if (!str) {
      return undefined;
    }
    const ret = str.trim();
    if (!ret) {
      return undefined;
    }
    if (!BigQueryRequest.isLanguageValid(ret)) {
      throw new EvalError("Parameter language is invalid");
    }
    return ret;
  }

  private static getPageToken(str: LaxString): string | undefined {
    if (!str) {
      return undefined;
    }
    if (!BigQueryRequest.isPageTokenValid(str)) {
      throw new EvalError("Parameter pageToken is invalid");
    }
    return str;
  }

  private static getJobId(str: LaxString): string | undefined {
    if (!str) {
      return undefined;
    }
    if (!BigQueryRequest.isJobIdValid(str)) {
      throw new EvalError("Parameter jobId is invalid");
    }
    return str;
  }

  private static getDeduplicationTimeDiff(str: LaxString): number {
    if (!str) {
      return BigQueryRequest.s_defaultDeduplicationTimeDiff;
    }
    const ret = str.trim();
    if (!ret) {
      return BigQueryRequest.s_defaultDeduplicationTimeDiff;
    }
    if (!BigQueryRequest.isDeduplicationTimeDiffValid(ret)) {
      throw new EvalError("Parameter deduplicationTimeDiff is invalid");
    }
    return Number.parseInt(ret, 10);
  }

  readonly startDate: moment.Moment;
  readonly endDate: moment.Moment;
  readonly deduplicationTimeDiff: number;
  readonly rowCount: number;
  readonly clientAddress: string;
  readonly name?: string;
  readonly language?: string;
  readonly pageToken?: string;
  readonly jobId?: string;
  readonly useQueryCache: boolean;

  // Regex must be either simple or constructed using a library that provides DOS protection.
  private static readonly s_regexRowCount = /^\d{1,6}$/;
  private static readonly s_regexPageToken = /^\w{32,64}=*$/;
  private static readonly s_regexName = /^[\w.-]{1,32}$/;
  private static readonly s_regexLanguage = /^[\w.+]{1,32}$/;
  private static readonly s_regexDeduplicationTimeDiff = /^\d{1,5}$/;
  private static readonly s_regexJobId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  private static readonly s_maxDateIntervalDays = 7.0;
  private static readonly s_maxRowCount = 10000;
  private static readonly s_defaultDeduplicationTimeDiff = 3600;
  private static readonly s_maxDeduplicationTimeDiff = 3600 * 24;
  private static readonly s_queryPath = "/api/bigquery/github/fetch/1.0";
}
