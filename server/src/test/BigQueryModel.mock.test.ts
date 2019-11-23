/*
  Demonstates mocking
*/
import { BigQueryModel } from "../api/models/BigQueryModel";
import { BigQueryRetrieval  } from "../api/types/BigQueryTypes";
import { TestConfig } from "./TestConfig";

const mockMessage = "test-mock";

beforeAll(() => {
  jest.spyOn(BigQueryModel.prototype, "fetch").mockImplementation(async (_params: any) => {
    return Promise.resolve();
  });
  jest.spyOn(BigQueryModel.prototype, "getData").mockImplementation(() => {
    return new Error(mockMessage);
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe("Test mocking", () => {
  const config = TestConfig.getModelConfig();
  BigQueryModel.Config = config;

  it("Mocks selected methods of BigQueryModel class", async () => {
    const bqRequest = TestConfig.getRequest(TestConfig.getStockTestRequest());
    expect(bqRequest).toBeDefined();

    const model = BigQueryModel.Factory;
    await model.fetch(bqRequest!);
    const data: BigQueryRetrieval = model.getData();

    expect(data).toBeInstanceOf(Error);
    const err = data as Error;
    expect(err.message).toContain(mockMessage);
  });
});
