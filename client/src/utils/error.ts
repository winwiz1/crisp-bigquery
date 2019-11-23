import logger from "./logger";

/*
  This class allows to have two different error messages describing the same error.
  One user friendly, another detailed. Support can ask a user to copy the latter
  from the log (currently browser's JS console) and paste into an email to be sent
  to the Support for further troubleshooting.
*/
export class CustomError extends Error {
  constructor(
    readonly message: string,             // error description for end user
    readonly detailMessage?: string
  ) {    // troubleshooting info for Support
    super(message);
    // www.typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
    Object.setPrototypeOf(this, new.target.prototype);
    // Ensure this.Message is not set to null or undefined as it is checked by isCustomError
    this.detailMessage = this.detailMessage ?? "";

    let errStr = message;
    detailMessage && (errStr += `\nInformation for Support:\n${detailMessage || "<no further details>"}`);
    logger.error(errStr);
  }
}
