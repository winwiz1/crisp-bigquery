import * as express from "express";
import * as RateLimit from "express-rate-limit";
import { BigQueryModel, BigQueryModelConfig } from "../models/BigQueryModel";
import {
  BigQueryRequest,
  BigQueryRetrievalResult, JsonParsingError
} from "../types/BigQueryTypes";
import {
  CustomError,
  isError,
  isCustomError,
} from "../../utils/error";

const jsonParser = express.json({
  inflate: true,
  limit: "1kb",
  strict: true,
  type: "application/json"
});

// Allow 20 requests (one data page/screen each) plus one
// auto-pagination request (fetching 100 data pages) every 3 minutes.
const rateLimiter = RateLimit({
  windowMs: 3 * 60 * 1000,        // 3 minutes
  max: 120                        // limit each IP to 120 requests per windowMs
});

/*
  API route handler
*/
export class BigQueryController {
  static readonly addRoute = (app: express.Application): void => {
    app.post(BigQueryRequest.Path,
      rateLimiter,
      jsonParser,
      async (req: express.Request, res: express.Response, next: express.NextFunction) => {
        try {
          if (!BigQueryController.s_configSet) {
            const config = new BigQueryModelConfig();
            BigQueryModel.Config = config;
            BigQueryController.s_configSet = true;
          }

          const errInfo: JsonParsingError = { message: undefined };
          const bqRequest = BigQueryRequest.fromJson(req.body, req.ip, errInfo, true);

          if (!bqRequest) {
            const err = new CustomError(400, BigQueryController.s_ErrMsgParams, true);
            err.unobscuredMessage = `Invalid request from ${req.ip} with hostname ${req.hostname} using path ${req.originalUrl}. `;
            !!errInfo.message && (err.unobscuredMessage += errInfo.message);
            return next(err);
          }

          const model = BigQueryModel.Factory;
          await model.fetch(bqRequest);
          const data = model.Data;

          if (data instanceof Error) {
            if (isCustomError(data)) {
              return next(data as CustomError);
            }
            const error = new CustomError(500, BigQueryController.s_ErrMsgBigQuery, true, true);
            // Can only be set to "<no data>" if code is incorrectly modified
            error.unobscuredMessage = (data as Error).message ?? "<no data>";
            return next(error);
          } else {
            res.status(200).json(data as BigQueryRetrievalResult);
          }
        } catch (err) {
          if (isCustomError(err)) {
            return next(err);
          }
          const error = new CustomError(500, BigQueryController.s_ErrMsgBigQuery, true, true);
          const errMsg: string = isError(err) ? err.message : (
            "Exception: <" +
            Object.keys(err).map((key) => `${key}: ${err[key] ?? "no data"}`).join("\n") +
            ">"
          );
          error.unobscuredMessage = errMsg;
          return next(error);
        }
      });
  }

  /********************** private data ************************/

  private static s_configSet = false;
  private static readonly s_ErrMsgBigQuery = "Could not query the backend database. Please retry later. If the problem persists contact Support";
  private static readonly s_ErrMsgParams = "Invalid data retrieval parameter(s). Please notify Support";
}
