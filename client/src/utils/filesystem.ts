/*
  Class FileSystemStorage: async wrapper for FileSystem API.
  Can be used to write files in append mode.
*/
import logger from "./logger";
import {
  domErrorToString,
  domExceptionToString
} from "./error";
import * as SPAs from "../../config/spa.config";

/*
  Typings for navigator.webkitPersistentStorage.requestQuota()
*/
declare global {
  interface Navigator {
    webkitPersistentStorage: {
      requestQuota: (
        bytesRequested: number,
        responseHandler: (bytesGranted: number) => void,
        errorHandler: (err: DOMError) => void
      ) => void
    };
  }
}

/*
  Allocates a persistent quota and uses it to create a file.
  Writes data into the file in append mode.
  Error handling:
   - Throws an exception if methods are called in incorrect order or
     with invalid parameters. Can happen if the calling code is
     incorrectly modified.
   - Returns 'false' to flag run-time errors.
*/
export class FileSystemStorage {

  //#region Public methods

  // Returns 'true' if FileSystem API is supported and
  // persistent storage can be requested.
  public static get Supported(): boolean {
    return !!navigator.webkitPersistentStorage?.requestQuota &&
      !!(self.requestFileSystem ?? self.webkitRequestFileSystem);
  }

  // Get user's permission to use persistent storage
  public static getQuota = async (requestedBytes: number): Promise<boolean> => {
    if (!FileSystemStorage.Supported) {
      FileSystemStorage.s_errQuota = new Error(FileSystemStorage.s_errNotSupported);
      return Promise.resolve(false);
    }

    const maxQuota = 1 * 1024 * 1024 * 1024;

    if (requestedBytes <= 0 || requestedBytes > maxQuota) {
      throw new RangeError("Invalid storage quota");
    }

    if (FileSystemStorage.s_quotaGranted > 0 && requestedBytes <= FileSystemStorage.s_quotaGranted) {
      // Do not check FileSystemStorage.s_errQuota, it can be set due to subsequent unsuccessful
      // attempts to increase quota.
      logger.info(`Quota request was already granted for ${FileSystemStorage.s_quotaGranted} bytes.`);
      return Promise.resolve(true);
    }

    FileSystemStorage.s_quotaRequested = requestedBytes;

    const ret = new Promise<boolean>((resolve) => {
      navigator.webkitPersistentStorage.requestQuota(
        requestedBytes,
        (grantedBytes) => {
          FileSystemStorage.s_quotaGranted = grantedBytes;
          FileSystemStorage.s_errQuota = undefined;
          logger.info(`Quota request succeeded, grantedBytes: ${grantedBytes}`);
          resolve(true);
        },
        (err: DOMError) => {
          // Leave FileSystemStorage.s_quotaGranted intact: subsequent request for bigger quota can fail.
          FileSystemStorage.s_errQuota = err;
          logger.error("Quota request failed. " + domErrorToString(err));
          resolve(false);
        }
      );
    });

    return ret;
  }

  // Create filesystem on the persistent storage
  public static requestFileSystem = async (): Promise<boolean> => {
    if (!FileSystemStorage.Supported) {
      FileSystemStorage.s_errQuota = new Error(FileSystemStorage.s_errNotSupported);
      return Promise.resolve(false);
    }

    if (FileSystemStorage.s_quotaRequested === 0) {
      throw new Error("FileSystem request failed: quota not requested");
    }

    if (FileSystemStorage.s_quotaGranted === 0) {
      throw new Error("FileSystem request failed: quota not granted");
    }

    if (FileSystemStorage.s_fileSystem) {
      logger.info(`Filesystem ${FileSystemStorage.s_fileSystem.name} has already been created`);
      return Promise.resolve(true);
    }

    const ret = new Promise<boolean>((resolve) => {
      const reqFs = self.requestFileSystem ?? self.webkitRequestFileSystem;

      reqFs(
        self.PERSISTENT,
        FileSystemStorage.s_quotaGranted,
        (filesystem: FileSystem) => {
          FileSystemStorage.s_fileSystem = filesystem;
          FileSystemStorage.s_errFileSystem = undefined;
          logger.info(`FileSystem request succeeded, name: ${filesystem.name || "<no name>"}`);
          resolve(true);
        },
        (err: DOMError) => {
          FileSystemStorage.s_fileSystem = undefined;
          FileSystemStorage.s_errFileSystem = err;
          logger.error("FileSystem request failed. " + domErrorToString(err));
          resolve(false);
        }
      );
    });

    return ret;
  }

  // Get the configuration status effected by the static methods
  public static get Status(): {
    requested: number,
    granted: number,
    errorQuota?: DOMError,
    errorFileSystem?: DOMError
  } {
    return {
      errorFileSystem: FileSystemStorage.s_errFileSystem,
      errorQuota: FileSystemStorage.s_errQuota,
      granted: FileSystemStorage.s_quotaGranted,
      requested: FileSystemStorage.s_quotaRequested,
    };
  }

  // Factory method. Returns an instance of the FileSystemStorage class
  // and creates a file.
  public static readonly Factory = async (fileName: string = SPAs.appTitle):
      Promise<FileSystemStorage | DOMError> => {
    const ret = new FileSystemStorage(fileName);
    const bFileCreated = await ret.createFile();
    return Promise.resolve(bFileCreated ? ret : ret.Error!);
  }

  // Get the error triggered by the instance methods
  public get Error(): DOMError | undefined {
    return this.m_error;
  }

  // Truncates file. Used before the first append to the file as a precationary
  // measure in case the file was not deleted by the previous CSV export.
  public readonly truncateFile = async (): Promise<boolean> => {
    const fileWriter = await this.createFileWriter();
    if (!fileWriter) {
      return Promise.resolve(false);
    }

    const ret = new Promise<boolean>((resolve) => {
      fileWriter!.onwriteend = () => {
        resolve(true);
      };
      fileWriter!.onerror = () => {
        resolve(false);
      };
      try {
        fileWriter.truncate(0);
      } catch (ex) {
        const e = ex as DOMException;
        const notFound = e.code === DOMException.NOT_FOUND_ERR;
        if (!notFound) {
          const err = domExceptionToString(e);
          this.m_error = new Error(err);
          logger.error("Failed to truncate file. " + err);
        }
        resolve(notFound);
      }
    });

    return ret;
  }

  // Append data to the file. Can be called several times.
  public readonly appendData = async (blob: Blob): Promise<boolean> => {
    if (!blob || !(blob instanceof Blob)) {
      throw new TypeError("Cannot append data: incorrect argument");
    }

    const fileWriter = await this.createFileWriter();
    if (!fileWriter) {
      return Promise.resolve(false);
    }

    const ret = new Promise<boolean>((resolve) => {
      fileWriter.onwriteend = () => {
        resolve(true);
      };
      fileWriter.onerror = () => {
        resolve(false);
      };
      try {
        fileWriter.seek(fileWriter.length);
        fileWriter.write(blob);
      } catch (ex) {
        const e = ex as DOMException;
        const err = domExceptionToString(e);
        this.m_error = new Error(err);
        logger.error("Failed to append data. " + err);
        resolve(false);
      }
    });

    return ret;
  }

  // Delete the file.
  public readonly deleteFile = async (): Promise<boolean> => {
    if (!this.m_fileEntry) {
      throw new Error("Cannot delete: file not created");
    }

    const ret = new Promise<boolean>((resolve) => {
      this.m_fileEntry!.remove(
        () => {
          logger.info("File deleted");
          resolve(true);
        },
        (err: DOMError) => {
          this.m_error = err;
          const notFound = err.name === "NotFoundError";
          notFound || logger.warn("Failed to delete file. " + domErrorToString(err));
          resolve(notFound);
        }
      );
    });

    return ret;
  }

  // Get file URL (uses internal filesystem: protocol).
  public readonly getUrl = (): string => {
    if (!this.m_fileEntry) {
      throw new Error("Cannot get URL: file not created");
    }

    const ret = this.m_fileEntry.toURL();
    return ret;
  }

  //#endregion

  //#region Private methods

  // Accepts a filename without any path
  private constructor(fileName: string) {
    this.m_fileName = fileName;
  }

  private async createFile(): Promise<boolean> {
    if (FileSystemStorage.s_quotaRequested === 0) {
      throw new Error("Quota not requested");
    }

    if (FileSystemStorage.s_quotaGranted === 0) {
      throw new Error("Quota not granted");
    }

    if (!FileSystemStorage.s_fileSystem) {
      throw new Error("Filesystem not created.");
    }

    if (!this.m_fileName || !FileSystemStorage.s_regexFileName.test(this.m_fileName)) {
      throw new Error("Invalid file name");
    }

    const ret = new Promise<boolean>((resolve) => {
      FileSystemStorage.s_fileSystem!.root.getFile(
        this.m_fileName,
        {
          create: true,      // do create new file if it doesn't exist
          exclusive: false   // accept existing file
        },
        (fileEntry: FileEntry) => {
          this.m_fileEntry = fileEntry;
          logger.info(`File '${this.m_fileName}' created`);
          resolve(true);
        },
        (err: DOMError) => {
          this.m_error = err;
          logger.error(`Failed to create the file '${this.m_fileName}'. ` + domErrorToString(err));
          resolve(false);
        }
      );
    });

    return ret;
  }

  private createFileWriter = async (): Promise<FileWriter | undefined> => {
    if (!this.m_fileEntry) {
      throw new Error("Failed to create FileWriter: file not created");
    }

    const ret = new Promise<FileWriter | undefined>((resolve) => {
      this.m_fileEntry!.createWriter(
        (fileWriter: FileWriter) => {
          resolve(fileWriter);
        },
        (err: DOMError) => {
          this.m_error = err;
          logger.error("Failed to create FileWriter. " + domErrorToString(err));
          resolve(undefined);
        }
      );
    });

    return ret;
  }

  //#endregion

  //#region Data

  private static s_quotaRequested: number = 0;
  private static s_quotaGranted: number = 0;
  private static s_errQuota?: DOMError;
  private static s_errFileSystem?: DOMError;
  private static s_fileSystem?: FileSystem;

  private readonly m_fileName: string;
  private m_fileEntry?: FileEntry;
  private m_error?: DOMError;

  private static readonly s_regexFileName = /^[\w)(\s-]{1,32}$/;
  private static s_errNotSupported = "Not supported by the browser";

  //#endregion
}
