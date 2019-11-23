import * as moment from "moment";
import { BackendRequest, IBackendRequestData } from "../api/BackendRequest";

describe("Testing BackendRequest with invalid data", () => {
  it("should reject endDate past startDate", () => {
    const data: IBackendRequestData = {
      endDate: moment().add(-1, "days").toDate(),
      rowCount: 1,
      startDate: moment().toDate(),
    };
    /* tslint:disable:no-unused-expression */
    function testCreate() {
      new BackendRequest(data);
    }
    /* tslint:enable:no-unused-expression */
    expect(testCreate).toThrowError(/invalid/i);
  });

  it("should reject query timeframe > 8 days", () => {
    const data: IBackendRequestData = {
      endDate: moment().add(9, "days").toDate(),
      rowCount: 1,
      startDate: moment().toDate(),
    };
    /* tslint:disable:no-unused-expression */
    function testCreate() {
      new BackendRequest(data);
    }
    /* tslint:enable:no-unused-expression */
    expect(testCreate).toThrowError(/cannot exceed/);
    expect(testCreate).toThrowError(RangeError);
  });

  it("should reject invalid rowCount", () => {
    const data: IBackendRequestData = {
      rowCount: 1,
      startDate: moment().toDate(),
    };
    const invalidCounts = [0, 1001, 1000000, -1];

    for (const cnt of invalidCounts) {
      /* tslint:disable:no-unused-expression */
      const testCreate = () => {
        new BackendRequest({ ...data, rowCount: cnt });
      };
      /* tslint:enable:no-unused-expression */
      expect(testCreate).toThrowError(/invalid.*?rowCount/i);
    }
  });

  it("should reject inconsistent pagination data", () => {
    const data: IBackendRequestData = {
      endDate: moment().toDate(),
      jobId: "abc",
      pageToken: undefined,
      rowCount: 1,
      startDate: moment().toDate(),
    };
    /* tslint:disable:no-unused-expression */
    function testCreate1() {
      new BackendRequest(data);
    }

    expect(testCreate1).toThrowError(/inconsistent/i);

    function testCreate2() {
      new BackendRequest({ ...data, jobId: undefined, pageToken: "abc" });
    }
    /* tslint:enable:no-unused-expression */
    expect(testCreate2).toThrowError(/inconsistent/i);
  });
});

describe("Testing BackendRequest with valid data", () => {
  it("should accept valid data", () => {
    const data: IBackendRequestData = {
      endDate: moment().add(7, "days").toDate(),
      jobId: "abc",
      language: "C++",
      name: "c",
      pageToken: "123",
      rowCount: 1000,
      startDate: moment().toDate(),
    };
    const request = new BackendRequest(data);
    expect(request).toBeDefined();
  });
});
