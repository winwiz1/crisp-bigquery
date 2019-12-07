import * as moment from "moment";

/*
  Define the data and functionality used to create
  a request for the backend data.
*/
export interface IBackendRequestData {
   // Support days (and not hours) as the query granularity.
   // The start-of-day time (GMT timezone) applies.
   readonly startDate: Date;
   // Support days (and not hours) as the query granularity.
   // The end-of-day time (GMT timezone) applies.
   // If missing then defaults to the same day as startDate.
   endDate?: Date;
   // Support up to 2000 rows.
   readonly rowCount: number;
   // Repository name
   readonly name?: string;
   // Repository language
   readonly language?: string;
   // Opaque pagination token
   readonly jobId?: string;
   // Another opaque pagination token
   readonly pageToken?: string;
   // TODO
   readonly log?: () => void;
}

export class BackendRequest {
   constructor(
      readonly requestData: IBackendRequestData = {
         endDate: undefined,
         jobId: undefined,
         language: undefined,
         name: undefined,
         pageToken: undefined,
         rowCount: 100,
         startDate: moment.utc().toDate(),
      }
   ) {
      if (!this.requestData.endDate) {
         this.requestData.endDate = this.requestData.startDate;
      }
      // Validation
      const startMoment = moment.utc(this.requestData.startDate);
      const endMoment = moment.utc(this.requestData.endDate);

      if (endMoment.diff(startMoment, "days", true) >
         (BackendRequest.s_maxQueryDurationDays + 1)) {
         // Can only happen if code is incorrectly modified
         throw new RangeError("Query timeframe cannot exceed 1 week");
      }

      if (startMoment.isAfter(endMoment)) {
         // Can only happen if code is incorrectly modified
         throw new Error("Invalid query timeframe, please contact Support.");
      }

      if (this.requestData.rowCount <= 0 || this.requestData.rowCount > 2000) {
         // Can only happen if code is incorrectly modified
         throw new RangeError("Invalid rowCount");
      }

      if (!!this.requestData.jobId !== !!this.requestData.pageToken) {
         throw new Error("Inconsistent pagination data, please contact Support.");
      }
   }

   static get MaxQueryDuration() {
      return BackendRequest.s_maxQueryDurationDays;
   }

   public readonly toString = (): string => {
      const startDate = moment(this.requestData.startDate);
      const endDate = moment(this.requestData.endDate);
      return JSON.stringify({
         endDate: moment(endDate).utc().add(endDate.utcOffset(), "m").toDate(),
         rowCount: this.requestData.rowCount,
         startDate: moment(startDate).utc().add(startDate.utcOffset(), "m").toDate(),
         ...(this.requestData.name && { name: this.requestData.name }),
         ...(this.requestData.language && { language: this.requestData.language }),
         ...(this.requestData.jobId && { jobId: this.requestData.jobId }),
         ...(this.requestData.pageToken && { pageToken: this.requestData.pageToken })
      });
   }

   private static readonly s_maxQueryDurationDays = 7;
}
