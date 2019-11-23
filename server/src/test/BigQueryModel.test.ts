
import { BigQueryModel } from "../api/models/BigQueryModel";
import { BigQueryRetrieval, BigQueryRetrievalResult } from "../api/types/BigQueryTypes";
import { TestConfig } from "./TestConfig";

describe("Testing BigQueryModel", () => {
  const timeoutPaginatingQuery = 120000;                 // 120 sec
  const timeoutNonPaginatingQuery = 10000;               // 10 sec
  const config = TestConfig.getModelConfig();
  BigQueryModel.Config = config;

  it("test non-paginating query", async () => {
    const testReq = TestConfig.getStockTestRequest();
    testReq.name = "C";
    const bqRequest = TestConfig.getRequest(testReq);
    const model = BigQueryModel.Factory;
    await model.fetch(bqRequest!);
    const data: BigQueryRetrieval = model.Data;
    expect(data).toBeInstanceOf(BigQueryRetrievalResult);

    const result = data as BigQueryRetrievalResult;
    expect(result.jobComplete).toBeTruthy();
    expect(+result.totalRows).toBeGreaterThan(result.rows.length);
  }, timeoutNonPaginatingQuery
  );

  it("test paginating query", async () => {
    const testReq = TestConfig.getStockTestRequest();
    // pagination size
    testReq.rowCount = 500;
    // apply filter which yields 1458 records
    testReq.name = "C";
    // 1458 records require 3 pages of 500 records
    const expectedPagingCount = 3;
    let bqRequest = TestConfig.getRequest(testReq);
    const model = BigQueryModel.Factory;
    await model.fetch(bqRequest!);
    const data1: BigQueryRetrieval = model.Data;
    expect(data1).toBeInstanceOf(BigQueryRetrievalResult);

    const result1 = data1 as BigQueryRetrievalResult;
    expect(result1.jobComplete).toBeTruthy();
    expect(+result1.totalRows).toBeGreaterThan(result1.rows.length);

    let pageToken: string | undefined = result1.pageToken;
    let jobId: string | undefined = result1.jobId;
    let cnt = 0;

    while (!!pageToken) {
      testReq.pageToken = pageToken;
      testReq.jobId = jobId;
      bqRequest = TestConfig.getRequest(testReq);
      expect(bqRequest).toBeDefined();

      await model.fetch(bqRequest!);
      const data2: BigQueryRetrieval = model.Data;
      expect(data2).toBeInstanceOf(BigQueryRetrievalResult);

      const result2 = data2 as BigQueryRetrievalResult;
      expect(result2.jobComplete).toBeTruthy();

      pageToken = result2.pageToken;
      jobId = result2.jobId;
      // tslint:disable-next-line:no-console
      console.log(`cnt = ${cnt++}`);
      expect(cnt).not.toBeGreaterThan(expectedPagingCount);
    }
    expect(cnt).toEqual(expectedPagingCount - 1);

  }, timeoutPaginatingQuery
  );

  it("tests the data limit imposed on a client", async () => {
    const clientAddress = "test.com.local";
    const configLimit = TestConfig.getModelConfig();
    configLimit.setClientDailyLimit(30);              // 30 MB
    BigQueryModel.Config = configLimit;
    // one query takes 10 MB
    const expectedPagingCount = 4;
    const testReq = TestConfig.getStockTestRequest();
    const bqRequest = TestConfig.getRequest(
      testReq,
      clientAddress,
      false                                           // do not use cache
    );
    const model = BigQueryModel.Factory;
    await model.fetch(bqRequest!);
    const data: BigQueryRetrieval = model.Data;
    expect(data).toBeInstanceOf(BigQueryRetrievalResult);

    const result = data as BigQueryRetrievalResult;
    expect(result.jobComplete).toBeTruthy();
    expect(+result.totalRows).toBeGreaterThan(result.rows.length);

    let pageToken: string | undefined = result.pageToken;
    let jobId: string | undefined = result.jobId;
    let cnt = 0;

    while (!!pageToken) {
      testReq.pageToken = pageToken;
      testReq.jobId = jobId;
      // tslint:disable-next-line:no-shadowed-variable
      const bqRequest = TestConfig.getRequest(
        testReq,
        clientAddress,
        false
      );
      expect(bqRequest).toBeDefined();

      await model.fetch(bqRequest!);
      // tslint:disable-next-line:no-shadowed-variable
      const data: BigQueryRetrieval = model.Data;
      expect(data).toBeInstanceOf(
        cnt === expectedPagingCount - 1 ? Error : BigQueryRetrievalResult
      );
      if (data instanceof Error) {
        expect(data.message).toContain("limit");
        break;
      }
      // tslint:disable-next-line:no-shadowed-variable
      const result = data as BigQueryRetrievalResult;
      expect(result.jobComplete).toBeTruthy();

      pageToken = result.pageToken;
      jobId = result.jobId;
      // tslint:disable-next-line:no-console
      console.log(`cnt = ${cnt++}`);
      expect(cnt).not.toBeGreaterThan(expectedPagingCount);
    }
    expect(cnt).toEqual(expectedPagingCount - 1);

  }, timeoutPaginatingQuery
  );
});
