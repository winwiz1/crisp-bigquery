/*
  Backend API client.
  Calls the API endpoint exposed by the backend and not the actual BigQuery API
  provided by Google. This arrangement ensures:
    - There is no room for CORS security violations (and therefore no need to
      relax the security by using CORS HTTP headers) because the script bundle
      with this code was downloaded from the same backend.
    - The client doesn't have the credentials required by BigQuery API.
    - The limit on client's data usage can be implemented independently from client.
*/
import { fetchAdapter, IFetch } from "../utils/fetch";
import { CustomError } from "../utils/error";
import { isError, isCustomError, isString } from "../utils/typeguards";
import { IBackendRequestData, BackendRequest } from "./BackendRequest";
import {
  IBigQueryData,
  BigQueryRetrieval,
  BigQueryRetrievalRow,
  BigQueryRetrievalResult,
  BigQueryRequest
} from "@backend/types/BigQueryTypes";

export {
  BigQueryRetrieval,
  BigQueryRetrievalRow,
  BigQueryRetrievalResult
};

// Extends data storage interface and adds data fetching capability.
interface IBackendClient extends IBigQueryData {
  readonly fetch: (request: IBackendRequestData) => Promise<boolean>;
}

// Implements data fetching and storage capabilities.
export class BackendManager implements IBackendClient {
  constructor(signal: AbortSignal) {
    this.m_signal = signal;
  }

  get Data(): BigQueryRetrieval {
    return this.m_queryResult;
  }

  public readonly fetch = async (request: IBackendRequestData): Promise<boolean> => {
    try {
      this.m_queryParams = new BackendRequest(request);
      await this.fetchData();
    } catch (err) {
      if (isError(err)) {
        this.m_queryResult = err;
      } else {
        throw err;
      }
    }
    // Returns 'true' to facilitate timeout handling implemented as
    // racing with another Promise that returns 'false'.
    return true;
  }

  static get RegexName(): RegExp {
    return BigQueryRequest.RegexName;
  }

  static get RegexLanguage(): RegExp {
    return BigQueryRequest.RegexLanguage;
  }

  /********************** private methods and data ************************/

  private fetchData = async (): Promise<void> => {
    const fetchProps: IFetch = {
      abortSignal: this.m_signal,
      body: this.m_queryParams.toString(),
      errorHandler: this.errorHandler,
      isJson: true,
      method: "POST",
      successHandler: this.successHandler,
      targetPath: BackendManager.s_targetPath,
    };

    await fetchAdapter(fetchProps);
  }

  private successHandler = (data: any): void => {
    const result = BackendManager.parser(data);

    if (result) {
      this.m_queryResult = result;
    } else if (isError(data)) {
      this.m_queryResult = data as Error;
    } else if (isString(data)) {
      this.m_queryResult = new Error(data as string);
    } else {
      this.m_queryResult = new CustomError(
        "Unexpected backend responce data, please contact Support.",
        "Details: " + Object.getOwnPropertyNames(data).map(key => `${key}: ${data[key] || "no data"}`).join("\n")
      );
    }
  }

  private errorHandler = (err: CustomError): void => {
    if (isCustomError(err)) {
      this.m_queryResult = err;
    } else {
      this.m_queryResult = new CustomError(
        "Unexpected backend error data, please contact Support.",
        "Details: " + Object.getOwnPropertyNames(err).map(key => `${key}: ${err[key] || "no data"}`).join("\n")
      );
    }
  }

  private static parser = (inputObj: Record<string, unknown>): BigQueryRetrievalResult | undefined => {
    const obj: BigQueryRetrievalResult = Object.create(BigQueryRetrievalResult.prototype);
    const ret = Object.assign(obj, inputObj);
    const propNames = ["rows", "jobComplete", "totalRows", "returnedRows", "totalBytesProcessed"];
    // eslint-disable-next-line no-prototype-builtins
    const hasProps = propNames.every(prop => ret.hasOwnProperty(prop));

    return hasProps ? ret : undefined;
  }

  private m_queryParams: BackendRequest;
  private m_queryResult: BigQueryRetrieval = new Error("<query not attempted>");
  private readonly m_signal: AbortSignal;
  private static readonly s_targetPath = BigQueryRequest.Path;
}
