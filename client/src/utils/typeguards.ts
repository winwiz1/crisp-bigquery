import { CustomError } from "./error";
import { BigQueryRetrievalResult } from "../api/BackendManager";

// eslint-disable-next-line
export function isError(err: any): err is Error {
  return !!err && err instanceof Error && err.constructor !== CustomError;
}

// eslint-disable-next-line
export function isCustomError(err: any): err is CustomError {
  return !!err && err.constructor === CustomError;
}

// eslint-disable-next-line
export function isDOMException(err: any): err is DOMException {
  return !!err && err.constructor === DOMException;
}

// eslint-disable-next-line
export function isBigQueryRetrievalResult(x: any): x is BigQueryRetrievalResult {
  return !!x && x instanceof BigQueryRetrievalResult;
}

// eslint-disable-next-line
export function isString(x: any): x is string {
  return typeof x === "string" && x.length > 0;
}
