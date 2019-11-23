/**
 * Express tests using Supertest Library and
 * Jest as the testing framework.
 */

import * as request from "supertest";
import Server, { StaticAssetPath } from "../srv/server";
import * as SPAs from "../../config/spa.config";
import { BigQueryModel } from "../api/models/BigQueryModel";
import { TestConfig } from "./TestConfig";
import {
  BigQueryRequest,
  BigQueryRetrievalResult,
  BigQueryRetrievalRow
} from "../api/types/BigQueryTypes";

const server = Server(StaticAssetPath.SOURCE);
const regexResponse = new RegExp(SPAs.appTitle);
const totalRowsMocked = 123;
const totalBytesMocked = 1024;

beforeAll(() => {
  jest.spyOn(BigQueryModel.prototype, "fetch").mockImplementation(async (_params: any) => {
    return Promise.resolve();
  });
  jest.spyOn(BigQueryModel.prototype, "Data", "get").mockImplementation(() => {
    const ret = new BigQueryRetrievalResult (
      new Array<BigQueryRetrievalRow>(1),
      true,                // jobComplete
      totalRowsMocked,     // totalRows
      0,                   // returnedRows
      totalBytesMocked,    // totalBytesProcessed
      undefined,           // pageToken
      undefined            // jobId
    );
    return ret;
  });
});

// Test that webserver does serve SPA landing pages.
// If there are two SPAs in spa.config.js called 'first and 'second',
// then set the array to:  ["/", "/first", "/second"]
const statusCode200path = SPAs.getNames().map(name => "/" + name);
statusCode200path.push("/");

// Test that webserver implements fallback to the SPA landing page for
// unknown (and presumably internal to SPA) pages. This is required from
// any webserver that supports an SPA.
const statusCode303path = [
  "/a", "/b", "/ABC"
];

// Test that the fallback tolerance does have its limits.
const statusCode404path = [
  "/abc%xyz;", "/images/logo123.png", "/static/invalid"
];

describe("Test Express routes", () => {
  it("test URLs returning HTTP status 200", () => {
    statusCode200path.forEach(async path => {
      const response = await request(server).get(path);
      expect(response.status).toBe(200);
      expect(response.text).toMatch(regexResponse);
    });
  });

  it("test URLs causing fallback with HTTP status 303", () => {
    statusCode303path.forEach(async (path) => {
      const response = await request(server).get(path);
      expect(response.status).toBe(303);
      expect(response.get("Location")).toBe("/");
    });
  });

  it("test invalid URLs causing HTTP status 404", () => {
    statusCode404path.forEach(async path => {
      const response = await request(server).get(path);
      expect(response.status).toBe(404);
    });
  });
});

describe("Test API route", () => {
  it("test delivery of fetched data", async () => {
    const strRequest = TestConfig.getRequestAsString(TestConfig.getStockTestRequest());

    const response = await request(server)
      .post(BigQueryRequest.Path)
      .set("Content-Type", "application/json")
      .send(strRequest);

    const obj: BigQueryRetrievalResult = Object.create(BigQueryRetrievalResult.prototype);
    const data = Object.assign(obj, response.body);
    expect(data.totalRows).toBe(totalRowsMocked);
    expect(data.totalBytesProcessed).toBe(totalBytesMocked);
  });
});
