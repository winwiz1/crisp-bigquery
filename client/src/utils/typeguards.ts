import { CustomError } from "./error";
import { BigQueryRetrievalResult } from "../api/BackendManager";

export function isError(err: any): err is Error {
  return !!err &&
    err instanceof Error &&
    (err as CustomError).detailMessage === undefined;
}

export function isCustomError(err: any): err is CustomError {
  return !!err &&
    err instanceof CustomError &&
    (err as CustomError).detailMessage !== undefined;
}

export function isBigQueryRetrievalResult(x: any): x is BigQueryRetrievalResult {
  return !!x && x instanceof BigQueryRetrievalResult;
}

export function isString(x: any): x is string {
  return typeof x === "string" && x.length > 0;
}
