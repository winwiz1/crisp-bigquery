/*
  The Model.
  Performs asynchronous BigQuery requests.
  Uses query parameters to let BigQuery engine know that those parts of the
  query need extra scrutiny to prevent SQL injection. This adds another layer
  of protection to the parameters validation performed by both client and
  backend. The regular expressions used for the validation must be either
  simple or constructed using a library that provides protection against
  DOS attack.
*/
import { BigQuery, Query as BigQueryRequestBase } from "@google-cloud/bigquery";
import { Job, QueryResultsOptions } from "@google-cloud/bigquery/build/src/job";
import * as  NodeCache from "node-cache";
import { logger } from "../../utils/logger";
import { CustomError } from "../../utils/error";
import {
   IBigQueryData,
   BigQueryRequest,
   BigQueryRetrieval,
   BigQueryRetrievalResult,
   BigQueryRetrievalRow } from "../types/BigQueryTypes";
import { EnvVariables, EnvConfig } from "../../utils/misc";
import { PersistentStorageManager } from "../../utils/storage";

/*
  Model configuration
*/
export class BigQueryModelConfig {
  constructor(
    // Daily limit on BigQuery data usage in MB per client address
    private limitDailyClientMB = BigQueryModelConfig.s_quotaDailyClientMB,
    // Daily limit on BigQuery data usage in MB per model instance
    private limitDailyInstanceMB = BigQueryModelConfig.s_quotaDailyInstanceMB,
    // Environment config
    readonly envConfig: EnvVariables = EnvConfig.getVariables()
  ) {

    if (limitDailyClientMB <= 0 || limitDailyClientMB > BigQueryModelConfig.s_quotaDailyClientMB) {
      throw new RangeError("Client data limit is invalid");
    }

    if (limitDailyInstanceMB <= 0 || limitDailyInstanceMB > BigQueryModelConfig.s_quotaDailyInstanceMB) {
      throw new RangeError("Instance data limit is invalid");
    }
  }

  public readonly setClientDailyLimit = (limit: number) => {
    if (typeof limit !== "number" || !Number.isInteger(limit)) {
      throw new TypeError("Client data limit is not an integer");
    }

    if (limit <= 0 || limit > BigQueryModelConfig.s_quotaDailyClientMB) {
      throw new RangeError("Client data limit is invalid");
    }

    this.limitDailyClientMB = limit;
  }

  public readonly getClientDailyLimit = (): number => {
    return this.limitDailyClientMB;
  }

  public readonly getInstanceDailyLimit = (): number => {
    return this.limitDailyInstanceMB;
  }

  // Default daily quota on BigQuery data usage in MB per client address
  private static readonly s_quotaDailyClientMB = 500;             // 500 MB
  // Default daily quota on BigQuery data usage in MB per instance of BigQueryModel class
  private static readonly s_quotaDailyInstanceMB = 30 * 1024;     // 30 GB
}

/*
  Model interface.
  Extends the data storage interface by adding data fetching capability.
*/
export interface IBigQueryFetcher extends IBigQueryData {
  readonly fetch: (param: BigQueryRequest) => Promise<void>;
}

/*
  Model implementation
  Usage:
  1. Use .Config setter once to set the configuration.
  2. Use .Factory getter one or many times to get an instance of the class.
  3. Use the instance of the class to await .fetch().
  4. Use .Data getter to get either the data fetched or an Error object.
*/
export class BigQueryModel implements IBigQueryFetcher {

  static set Config(config: BigQueryModelConfig) {
    BigQueryModel.s_config = config;
    BigQueryModel.s_instance = undefined;
  }

  static get Factory(): BigQueryModel {
    if (!BigQueryModel.s_instance) {
      BigQueryModel.s_instance = new BigQueryModel();
    }
    return BigQueryModel.s_instance;
  }

  public async fetch(bqRequest: BigQueryRequest): Promise<void> {
    this.m_bqRequest = bqRequest;

    const dataUsage = this.getDataUsage(bqRequest.clientAddress);
    // Check data usage per client
    if (dataUsage.client_data > BigQueryModel.s_config!.getClientDailyLimit()) {
      const custErr = new CustomError(509, BigQueryModel.s_errLimitClient, false, false);
      custErr.unobscuredMessage = `Client ${bqRequest.clientAddress} has reached daily data limit`;
      this.m_queryResult = custErr;
      return;
    }
    // Check data usage by the instance of BigQueryModel class
    if (dataUsage.instance_data > BigQueryModel.s_config!.getInstanceDailyLimit()) {
      const custErr = new CustomError(509, BigQueryModel.s_errLimitInstance, false, false);
      custErr.unobscuredMessage = `Client ${bqRequest.clientAddress} request denied due to backend reaching its daily data limit`;
      this.m_queryResult = custErr;
      return;
    }

    await this.fetchData();
    this.deduplicateRetrieval(bqRequest.DeduplicationTimeDiff);
  }

  get Data(): BigQueryRetrieval {
    return this.m_queryResult;
  }

  public getData(): BigQueryRetrieval {
    return this.m_queryResult;
  }

  /********************** private methods and data ************************/

  private constructor() {
    if (!BigQueryModel.s_config) {
      throw new Error("BigQueryModelConfig is undefined");
    }
    this.m_cache.on("expired", this.handleCacheExpiry);
    PersistentStorageManager.ReadLimitCounters(this.m_cache);
  }

  private async fetchData(): Promise<void> {
    const bqRequest = this.m_bqRequest as BigQueryRequest;

    try {
      let jobId = "";
      let job: Job | undefined;

      if (bqRequest.JobId) {
        jobId = bqRequest.JobId;
        job = this.m_cache.get(jobId);

        if (!job) {
          job = this.m_bigquery.job(jobId);
          job && this.m_cache.set(jobId, job);
        }
      } else {
        const requestOptions = {
          ...this.m_requestOptions,
          maxResults: bqRequest.RowCount,
          params: this.getBqRequest(),
          query: this.amendQuery(),
          useQueryCache: bqRequest.useQueryCache,
        };
        logger.info({ message: `Query: ${requestOptions.query}` });
        const [jobCreated, ] = await this.m_bigquery.createQueryJob(requestOptions);
        if (jobCreated && jobCreated.id) {
          jobId = jobCreated.id;
          job = jobCreated;
          this.m_cache.set(jobId, job);
        } else {
          throw new Error(BigQueryModel.s_errLaunch);
        }
      }

      if (!job) {
        const custErr = new CustomError(408, BigQueryModel.s_errStale, false, false);
        custErr.unobscuredMessage = `Client ${bqRequest.clientAddress} has sent stale request`;
        this.m_queryResult = custErr;
        return;
      }

      const resultOptions = {
        ...this.m_resultOptions,
        maxResults: bqRequest.RowCount,
        pageToken: bqRequest.PageToken,
      };
      const data: ReadonlyArray<any> = await job.getQueryResults(resultOptions);
      const rows: ReadonlyArray<BigQueryRetrievalRow> = data[0];
      const { jobComplete, totalRows, totalBytesProcessed, pageToken } = data[2];

      this.m_queryResult = jobComplete ?
        new BigQueryRetrievalResult(rows,
          jobComplete,
          totalRows,
          rows.length,
          totalBytesProcessed,
          pageToken,
          pageToken ? jobId : undefined) :
        new Error("Backend database query did not complete");

      jobComplete && this.adjustDataUsage(bqRequest.clientAddress, totalBytesProcessed);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : (
        "Exception: <" +
        Object.keys(err).map((key) => `${key}: ${err[key] ?? "no data"}`).join("\n") +
        ">"
      );
      logger.error({ message: `Backend data retrieval failed, error: ${errorMsg}` });
      this.m_queryResult = new Error(BigQueryModel.s_errMsg);
    }
  }

  // A sample routine which demonstrates post-processing in cases when its logic
  // could not be implemented in the SQL statement for whatever reason.
  private deduplicateRetrieval(deduplicationTimeDiff: number) {
    if (this.m_queryResult instanceof Error) {
      return;
    }

    const data = this.m_queryResult as BigQueryRetrievalResult;

    if (data.jobComplete === false || data.totalRows === 0) {
      return;
    }

    if (!data.rows || data.rows.length === 0) {
      return;
    }

    if (deduplicationTimeDiff === 0) {
      return;                               // client requested deduplication to be disabled
    }

    const outRows = new Array<BigQueryRetrievalRow>();

    data.rows.reduce((acc, row, idx) => {
      if (idx === 0) {
        acc.push(row);
      } else {
        const row1 = acc[acc.length - 1];
        BigQueryRetrievalRow.isDuplicate(row1, row, deduplicationTimeDiff) || acc.push(row);
      }
      return acc;
    }, outRows);

    data.rows = outRows;
  }

  private handleCacheExpiry = (cache_key: string, value: any) => {
    if (!cache_key) {
      return;
    }

    if (cache_key.startsWith(BigQueryModel.s_limitPrefix)) {
      PersistentStorageManager.WriteLimitCounters(
        [cache_key, undefined],
        0
      );
      return;
    }

    const job = value as Job;

    try {
      job.cancel().then(
        () => logger.info({ msg: `Cancelled stale BigQuery job ${job.id}` }),
        () => logger.warning({ msg: `Failed to cancel stale BigQuery job ${job.id}` })
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : (
        "Exception: <" +
        Object.keys(err).map((key) => `${key}: ${err[key] ?? "no data"}`).join("\n") +
        ">"
      );
      logger.warning({ msg: `Failed to cancel stale BigQuery job, error: ${errorMsg}` });
    }
  }

  private getDatasourceName(): string {
    const str1 =  `\`${BigQueryModel.s_config!.envConfig.gcpProjectId}`;
    const str2 = `.${BigQueryModel.s_config!.envConfig.bqDatasetName}`;
    const str3 = `.${BigQueryModel.s_config!.envConfig.bqTableName}\``;

    return str1 + str2 + str3;
  }

  private getBqRequest() {
    const bqRequest = this.m_bqRequest as BigQueryRequest;

    return {
      ...(bqRequest.name && { name: bqRequest.name }),
      ...(bqRequest.language && { language: bqRequest.language }),
    };
  }

  private amendQuery(): string {
    const bqRequest = this.m_bqRequest as BigQueryRequest;

    const replacePatterns = {
      _between_: bqRequest.getSqlTimeClause(),
      _datasource_: this.getDatasourceName(),
      _params_: bqRequest.getSqlParamClause(),
    };

    return this.m_query.replace(/_datasource_|_between_|_params_/g,
      match => replacePatterns[match as keyof typeof replacePatterns]);
  }

  // TODO Use durable cache
  private getDataUsage(clientAddress: string):
      {
        // Client address
        client_key: string,
        // amount of BigQuery data used by the client
        client_data: number,
        // amount of data used by the instance of BigQueryModel class.
        instance_data: number
      } {
    if (!clientAddress) {
      const errMsg = "BigQueryModel.checkLimit - missing clientAddress";
      logger.error({ message: errMsg });
      throw new Error(errMsg);
    }

    const clientKey = BigQueryModel.s_limitPrefix + clientAddress;
    const cacheData = this.m_cache.mget([clientKey, BigQueryModel.s_limitInstance]);
    const clientData = typeof cacheData[clientKey] === "number" ?
      cacheData[clientKey] as number : 0;
    const instanceData = typeof cacheData[BigQueryModel.s_limitInstance] === "number" ?
      cacheData[BigQueryModel.s_limitInstance] as number : 0;
    return { client_key: clientKey, client_data: clientData, instance_data: instanceData };
  }

  // TODO Use durable cache
  private adjustDataUsage(clientAddress: string, cntBytes: number) {
    if (cntBytes === 0) {
      return;
    }

    const cntBytesMB = Math.ceil(cntBytes / (1024 * 1024));
    const bqThresholdMB = 10;
    const cntBytesProcessedMB = cntBytesMB > bqThresholdMB ? cntBytesMB : bqThresholdMB;
    const { client_key, client_data, instance_data } = this.getDataUsage(clientAddress);

    const ret = this.m_cache.mset([
      { key: client_key,
        ttl: BigQueryModel.s_limitCleanupInterval,
        val: client_data + cntBytesProcessedMB,
      },
      { key: BigQueryModel.s_limitInstance,
        ttl: BigQueryModel.s_limitCleanupInterval,
        val: instance_data + cntBytesProcessedMB,
      }
    ]);

    if (!ret) {
      const errMsg = "BigQueryModel - failed to store data usage in cache";
      logger.error({ message: errMsg });
      throw new Error(errMsg);
    }

    PersistentStorageManager.WriteLimitCounters(
      [client_key, BigQueryModel.s_limitInstance],
      cntBytesProcessedMB
    );
  }

  private m_bqRequest?: BigQueryRequest = undefined;
  private m_queryResult: BigQueryRetrieval = new Error("Backend database query not attempted");

  private m_query = `#standardSQL
    SELECT STRING(TIMESTAMP_TRUNC(created_time, SECOND)) as DateTime,
    SUBSTR(repository_name, 1, 40) as Name,
    SUBSTR(repository_language, 1, 25) as Language,
    repository_size as Size,
    repository_homepage as Homepage,
    SUBSTR(actor_attributes_login, 1, 20) as Login,
    SUBSTR(repository_owner, 1, 25) as Owner
    FROM _datasource_
    WHERE created_time _between_  _params_
    ORDER BY DateTime ASC`;

  private readonly m_requestOptions: BigQueryRequestBase = {
    destination: undefined,
    location: "US",
    maxResults: undefined,
    pageToken: undefined,
    params: undefined,
    query: undefined,
    timeoutMs: 10000,
    useQueryCache: true,
  };

  private readonly m_resultOptions: QueryResultsOptions = {
    autoPaginate: true,
    maxApiCalls: undefined,
    maxResults: undefined,
    pageToken: undefined,
    startIndex: undefined,
    timeoutMs: 15000,
  };

  private readonly m_bigquery = new BigQuery(
    {
      autoRetry: true,
      keyFilename: BigQueryModel.s_config!.envConfig.keyFilePath,
      maxRetries: 5,
      projectId: BigQueryModel.s_config!.envConfig.gcpProjectId,
    }
  );

  private readonly m_cache = new NodeCache({
    checkperiod: 900,
    deleteOnExpire: true,
    stdTTL: BigQueryModel.s_JobCleanupInterval,
    useClones: false
  });

  private static s_instance?: BigQueryModel = undefined;
  private static s_config?: BigQueryModelConfig = undefined;
  private static readonly s_errMsg = "Failed to query the backend database. Please retry later. If the problem persists contact Support";
  private static readonly s_errStale = "Stale backend query";
  private static readonly s_errLaunch = "Failed to launch BigQuery job to perform a query";
  private static readonly s_errLimitClient = "The daily limit of database queries has been reached. Please contact Support if you feel this limit is inadequate.";
  private static readonly s_errLimitInstance = "Temporary unable to to query the backend database. Please contact Support.";
  private static readonly s_limitPrefix = "bqlimit_";
  private static readonly s_limitInstance = "bqlimit_instance";
  private static readonly s_JobCleanupInterval = 3600;
  private static readonly s_limitCleanupInterval = 3600 * 24;
}
