/*
  Class CsvConverter.
  Converts BigQuery tabular data into CSV format using D3 library.
  Since CSV export is optional, the class and its imports are
  included into a separate script bundle. The bundle is downloaded
  via dynamic import when it's needed.
*/
import * as d3 from "d3-dsv";
import logger from "./logger";
import { QueryCache } from "./cache";

export class CsvConverter {
  public constructor(private config: {
    cache: QueryCache,
    progressRoutine: (percent: number) => void,
    appendRoutine: (blob: Blob) => Promise<boolean>
  }) {

  }

  public readonly performConversion = async (): Promise<boolean> => {
    const pageCount = this.config.cache.getPageCount();

    for (let currentPage = 0; currentPage < pageCount; ++currentPage) {
      const str = this.convertPage(currentPage);
      const blob = new Blob([str], { type: "text/csv" });
      const ret = await this.config.appendRoutine(blob);

      if (!ret) {
        logger.error("Data conversion failure due to file appending error.");
        return Promise.resolve(false);
      }

      this.config.progressRoutine(((currentPage + 1) * 100) / pageCount);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return Promise.resolve(true);
  }

  public readonly convertPage = (ind: number): string => {
    const page = this.config.cache.getPage(ind);

    if (!page) {
      // Can only happen if code is incorrectly modified
      throw new Error("Internal error: no page to convert. Please contact Support.");
    }

    const firstRow = ind > 0 ? [] : CsvConverter.s_columns;

    const ret = d3.csvFormatRows([firstRow].concat(page.data.map((d, _i) => {
      return [
        d.DateTime ?? "",
        d.Name ?? "",
        d.Language ?? "",
        d.Size ?? "",
        d.Homepage ?? "",
        d.Login ?? "",
        d.Owner ?? ""
      ];
    })));

    return ret;
  }

  private static readonly s_columns = [
    "DateTime",
    "Name",
    "Language",
    "Size",
    "Homepage",
    "Login",
    "Owner"
  ];
}

export { CsvConverter as default } from "./csv";
