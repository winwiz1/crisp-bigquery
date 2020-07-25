import * as moment from "moment";
import { BigQueryModelConfig } from "../api/models/BigQueryModel";
import { JsonParsingError, BigQueryRequest } from "../api/types/BigQueryTypes";

type TestRequest = {
  startDate: string
  endDate: string
  rowCount: number
  name: string | undefined
  language: string | undefined
  pageToken: string | undefined
  jobId: string | undefined
};

export class TestConfig {
  static readonly getValidNames = (): ReadonlyArray<string|undefined>  => {
    const names = [
      "myrepo",
      "Repo1234567890",
      "name.repo.v12",
      undefined
    ];

    return names;
  }

  static readonly getInvalidNames = (): ReadonlyArray<string>  => {
    const names = [
      "repo#",
      "Repo<B",
      "Repo$1234567890",
      "name(alias)version",
      "delete * from users",
      "drop&nbsp;users"
    ];

    return names;
  }

  static readonly getStockTestRequest = (): TestRequest => {
    return {
      endDate: "2012-03-25",
      jobId: undefined,
      language: undefined,
      name: undefined,
      pageToken: undefined,
      rowCount: 100,
      startDate: "2012-03-25",
    };
  }

  static readonly getRequestAsString = (req: TestRequest): string => {
    const obj = JSON.stringify({
      endDate: moment.utc(req.endDate).utc().toDate(),
      jobId: req.jobId,
      language: req.language,
      name: req.name,
      pageToken: req.pageToken,
      rowCount: req.rowCount,
      startDate: moment.utc(req.startDate).utc().toDate(),

    });
    return obj;
  }

  static readonly getRequestAsJson = (req: TestRequest): any | undefined => {
    const ret = JSON.parse(TestConfig.getRequestAsString(req));
    return ret;
  }

  static readonly getRequest = (
    req: TestRequest,
    clientAddress = "10.10.11.12",
    useQueryCache = true): BigQueryRequest | undefined => {
    const ret = TestConfig.getRequestAsJson(req);
    const errInfo: JsonParsingError = { message: undefined };
    return ret ? BigQueryRequest.fromJson(ret, clientAddress, errInfo, useQueryCache) : undefined;
  }

  static readonly getModelConfig = (
    dataLimitClient: number | undefined = undefined,
    dataLimitInstance: number | undefined = undefined): BigQueryModelConfig => {
    return new BigQueryModelConfig(
      dataLimitClient,
      dataLimitInstance
    );
  }
}
