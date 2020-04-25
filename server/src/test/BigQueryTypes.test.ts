import * as moment from "moment";
import { JsonParsingError, BigQueryRequest } from "../api/types/BigQueryTypes";
import { TestConfig } from "./TestConfig";

const validAddress = "10.10.10.10";

describe("Testing BigQueryRequest with invalid data", () => {
  const errInfo: JsonParsingError = { message: undefined };

  it("should reject empty JSON object", () => {
    const obj: object = {};
    expect(BigQueryRequest.fromJson(obj, validAddress, errInfo, true)).not.toBeDefined();
  });

  it("should reject invalid JSON object", () => {
    const obj: object = {
      count: 100,
      endTime: "bye",
      startTime: "hello",
    };
    expect(BigQueryRequest.fromJson(obj, validAddress, errInfo, true)).not.toBeDefined();
  });

  it("should reject invalid names", () => {
    const reqJson = TestConfig.getRequestAsJson(TestConfig.getStockTestRequest());
    TestConfig.getInvalidNames().forEach(name => {
      reqJson.name = name;
      expect(TestConfig.getRequest(reqJson)).not.toBeDefined();
    });
  });

  it("should reject invalid startDate", () => {
    const testReq = TestConfig.getStockTestRequest();
    testReq.startDate = "2019-05-10T10:27:55.512Z**bad***";
    expect(BigQueryRequest.fromJson(testReq, validAddress, errInfo, true)).not.toBeDefined();
  });

  it("should reject invalid endDate", () => {
    const testReq = TestConfig.getStockTestRequest();
    testReq.endDate = "2019-05-10T10:27:55.512Z**bad***";
    expect(BigQueryRequest.fromJson(testReq, validAddress, errInfo, true)).not.toBeDefined();
  });

  it("should reject invalid rowCount", () => {
    const testReq = TestConfig.getStockTestRequest();
    testReq.rowCount = -1;
    expect(BigQueryRequest.fromJson(testReq, validAddress, errInfo, true)).not.toBeDefined();
  });

  it("should reject query timeframe longer than 8 days", () => {
    const testReq = TestConfig.getStockTestRequest();
    testReq.startDate = moment.utc().toDate().toDateString();
    testReq.endDate = moment.utc().add(9, "days").utc().toDate().toDateString();
    expect(BigQueryRequest.fromJson(testReq, validAddress, errInfo, true)).not.toBeDefined();

  });

  it("should reject startTime post endTime", () => {
    const testReq = TestConfig.getStockTestRequest();
    testReq.startDate = moment.utc().add(1, "days").utc().toDate().toDateString();
    testReq.endDate = moment.utc().toDate().toDateString();
    expect(BigQueryRequest.fromJson(testReq, validAddress, errInfo, true)).not.toBeDefined();
  });
});

describe("Testing BigQueryRequest with valid data", () => {
  const errInfo: JsonParsingError = { message: undefined };

  it("should accept valid dates, name and language", () => {
    const testReq = TestConfig.getStockTestRequest();
    testReq.name = "abc_XYZ.123-v";
    testReq.language = "C++";
    expect(BigQueryRequest.fromJson(testReq, validAddress, errInfo, true)).toBeDefined();
  });

  it("should accept valid names", () => {
    const req = TestConfig.getStockTestRequest();
    TestConfig.getValidNames().forEach(name => {
      req.name = name;
      expect(TestConfig.getRequest(req)).toBeDefined();
    });
  });

  it("should accept startDate and endDate 1 week apart", () => {
    const testReq = TestConfig.getStockTestRequest();
    testReq.startDate = moment.utc().toDate().toDateString();
    testReq.endDate = moment.utc().add(7, "days").utc().toDate().toDateString();
    expect(BigQueryRequest.fromJson(testReq, validAddress, errInfo, true)).toBeDefined();
  });

  it("should accept valid rowCount", () => {
    const testReq = TestConfig.getStockTestRequest();
    testReq.rowCount = 10000;
    expect(BigQueryRequest.fromJson(testReq, validAddress, errInfo, true)).toBeDefined();
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
