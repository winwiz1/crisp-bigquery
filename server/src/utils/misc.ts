import * as fs from "fs";

// Get the port that Express should be listening on
export function getListeningPort(): number {
  const port = parseInt(process.env.PORT || "3000", 10);
  return port;
}

// Get the limit for cache size
export function getCacheLimit(): number {
  const port = parseInt(process.env.CACHE_LIMIT || "5000", 10);
  return port;
}

// Returns true if running on Google Cloud Run.
// Assumption: the port 8080 is reserved for Cloud Run.
export function isGoogleCloudRun(): boolean {
  return getListeningPort() === 8080;
}

export function isTest(): boolean {
  return process.env.NODE_ENV === "test";
}

export type EnvVariables = {
  // GCP Project ID
  gcpProjectId: string,
  // BigQuery dataset name
  bqDatasetName: string,
  // BigQuery table name
  bqTableName: string,
  // Path to JSON file with service account credentials including private key
  keyFilePath: string
};

export class EnvConfig {
  public static readonly getVariables = (): EnvVariables => {
    if (EnvConfig.s_checkDone) {
      if (!EnvConfig.s_envVariables) {
        throw new Error(EnvConfig.s_errMsg ?? "Invalid environment setup");
      }
      return EnvConfig.s_envVariables!;
    }
    /* tslint:disable:no-string-literal */
    const gcpProjectId = process.env["GCP_PROJECT_ID"] || (process.env["PROJECT_ID"] ?? "");
    const bqDatasetName = process.env["BIGQUERY_DATASET_NAME"] ?? "";
    const bqTableName = process.env["BIGQUERY_TABLE_NAME"] ?? "";
    const keyFilePath = process.env["KEY_FILE_PATH"] ?? "";
    /* tslint:enable:no-string-literal */
    EnvConfig.s_checkDone = true;

    if (!gcpProjectId.length) {
      EnvConfig.s_errMsg = "Neither GCP_PROJECT_ID nor PROJECT_ID variable is set.";
    }
    if (!bqDatasetName.length) {
      EnvConfig.s_errMsg += " BIGQUERY_DATASET_NAME variable not set.";
    }
    if (!bqTableName.length) {
      EnvConfig.s_errMsg += " BIGQUERY_TABLE_NAME variable not set.";
    }
    if (!keyFilePath.length) {
      EnvConfig.s_errMsg += " KEY_FILE_PATH variable not set.";
    }

    if (EnvConfig.s_errMsg) {
      throw new Error(EnvConfig.s_errMsg);
    }

    let bqKeyFileReadable: boolean | undefined;

    try {
      fs.accessSync(keyFilePath, fs.constants.R_OK);
      bqKeyFileReadable = true;
    } catch {
      bqKeyFileReadable = false;
    }

    if (!bqKeyFileReadable) {
      EnvConfig.s_errMsg = `The key file '${keyFilePath}' cannot be read`;
      throw new Error(EnvConfig.s_errMsg);
    }

    EnvConfig.s_checkDone = true;
    EnvConfig.s_envVariables = {
      bqDatasetName,
      bqTableName,
      gcpProjectId,
      keyFilePath
    };

    return EnvConfig.s_envVariables;
  }

  private static s_errMsg?: string = undefined;
  private static s_checkDone?: boolean = false;
  private static s_envVariables?: EnvVariables = undefined;
}
