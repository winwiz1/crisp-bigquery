import * as moment from "moment";
import { BigQueryRequest } from "../api/types/BigQueryTypes";
import { TestConfig } from "./TestConfig";

const validName = TestConfig.getValidNames()[0] as string;

describe("Testing BigQueryRequest with invalid data", () => {
  it("should reject empty JSON object", () => {
    const obj: object = {};
    expect(BigQueryRequest.fromJson(obj, validName)).not.toBeDefined();
  });

  it("should reject invalid JSON object", () => {
    const obj: object = {
      count: 100,
      endTime: "bye",
      startTime: "hello",
    };
    expect(BigQueryRequest.fromJson(obj, validName)).not.toBeDefined();
  });

  it("should reject invalid names", () => {
    const reqJson = TestConfig.getRequestAsJson(TestConfig.getStockTestRequest());
    TestConfig.getInvalidNames().forEach(name => {
      reqJson.name = name;
      expect(TestConfig.getRequest(reqJson, validName)).not.toBeDefined();
    });
  });

  it("should reject invalid startDate", () => {
    const testReq = TestConfig.getStockTestRequest();
    testReq.startDate = "2019-05-10T10:27:55.512Z**bad***";
    const reqJson = TestConfig.getRequestAsJson(testReq);
    expect(BigQueryRequest.fromJson(reqJson, validName)).not.toBeDefined();
  });

  it("should reject invalid endDate", () => {
    const testReq = TestConfig.getStockTestRequest();
    testReq.endDate = "2019-05-10T10:27:55.512Z**bad***";
    const reqJson = TestConfig.getRequestAsJson(testReq);
    expect(BigQueryRequest.fromJson(reqJson, validName)).not.toBeDefined();
  });

  it("should reject invalid rowCount", () => {
    const testReq = TestConfig.getStockTestRequest();
    testReq.rowCount = -1;
    const reqJson = TestConfig.getRequestAsJson(testReq);
    expect(BigQueryRequest.fromJson(reqJson, validName)).not.toBeDefined();
  });

  it("should reject query timeframe longer than 8 days", () => {
    const testReq = TestConfig.getStockTestRequest();
    testReq.startDate = moment.utc().toDate().toDateString();
    testReq.endDate = moment.utc().add(9, "days").utc().toDate().toDateString();
    const reqJson = TestConfig.getRequestAsJson(testReq);
    expect(BigQueryRequest.fromJson(reqJson, validName)).not.toBeDefined();

  });

  it("should reject startTime post endTime", () => {
    const testReq = TestConfig.getStockTestRequest();
    testReq.startDate = moment.utc().add(1, "days").utc().toDate().toDateString();
    testReq.endDate = moment.utc().toDate().toDateString();
    const reqJson = TestConfig.getRequestAsJson(testReq);
    expect(BigQueryRequest.fromJson(reqJson, validName)).not.toBeDefined();
  });
});

describe("Testing BigQueryRequest with valid data", () => {
  it("should accept valid dates, name and language", () => {
    const testReq = TestConfig.getStockTestRequest();
    testReq.name = "abc_XYZ.123-v";
    testReq.language = "C++";
    const reqJson = TestConfig.getRequestAsJson(testReq);
    expect(BigQueryRequest.fromJson(reqJson, validName)).toBeDefined();
  });

  it("should accept startDate and endDate 1 week apart", () => {
    const testReq = TestConfig.getStockTestRequest();
    testReq.startDate = moment.utc().toDate().toDateString();
    testReq.endDate = moment.utc().add(7, "days").utc().toDate().toDateString();
    const reqJson = TestConfig.getRequestAsJson(testReq);
    expect(BigQueryRequest.fromJson(reqJson, validName)).toBeDefined();
  });

  it("should accept valid rowCount", () => {
    const testReq = TestConfig.getStockTestRequest();
    testReq.rowCount = 10000;
    const reqJson = TestConfig.getRequestAsJson(testReq);
    expect(BigQueryRequest.fromJson(reqJson, validName)).toBeDefined();
  });

  it("should generate SQL clause", () => {
    const testReq = TestConfig.getStockTestRequest();
    const bqRequest = TestConfig.getRequest(testReq);
    expect(bqRequest).toBeDefined();
    const sql = bqRequest!.getSqlTimeClause();
    const result = /^BETWEEN\s'\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}'\sAND\s'\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}'$/
      .test(sql);
    expect(result).toBeTruthy();
  });
});
