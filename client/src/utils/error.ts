import logger from "./logger";

/*
  This class allows to have two different error messages describing the same error.
  One user friendly, another detailed. Support can ask a user to copy the latter
  from the log (currently browser's JS console) and paste into an email to be sent
  to the Support for further troubleshooting.
*/
export class CustomError extends Error {
  constructor(
    message: string,                        // error description for end user
    readonly detailMessage?: string
  ) {    // troubleshooting info for Support
    super(message);
    // http://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html#support-for-newtarget
    Object.setPrototypeOf(this, new.target.prototype);
    this.detailMessage = this.detailMessage ?? "";

    let errStr = message;
    detailMessage && (errStr += `\nInformation for Support:\n${detailMessage || "<no further details>"}`);
    logger.error(errStr);
  }
}

/*
  Utility function used for error handling.
*/
export function domErrorToString(err: DOMError | undefined): string {
  return !!err ?
    `Error: ${err.name}, description: ${err.toString?.() || "<no description>"}` :
    "No error details available";
}

/*
  Utility function used for error handling.
*/
export function domExceptionToString(ex: DOMException | undefined): string {
  return !!ex ?
    `Exception: ${ex.code}, description: ${ex.message || "<no description>"}` :
    "No exception details available";
}
