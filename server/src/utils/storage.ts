/*
  The class PersistentStorageManager is responsible for
  database operations handling
*/
import * as  NodeCache from "node-cache";

export class PersistentStorageManager {
  public static ReadLimitCounters(_cache: NodeCache) {
    // TODO
    // Provide an implmentation to restore all the data limit counters from
    // the database of your choice. If a counter was updated >24 hours ago
    // then do not restore this counter and delete it from the database
    // (or archive/inactivate its record for history or audit purposes).

  }

  public static WriteLimitCounters(
    _counterNames: [string, string?],
    _counterValue: number) {
    // TODO
    // If the counter value '_counterValue' is greater than zero then:
    //  - Throw an exception if the tuple contains less than two names.
    //  - Provide an implmentation to update the database by creating the records
    //    for the two new counters (with names taken from the tuple) and set both
    //    their values to the counter value. If one or both counters already
    //    exist then increase their value by the counter value.
    // If the counter value '_counterValue' is zero then:
    //  - Verify that tuple contains one name only and throw an exception
    //    otherwise.
    //  - Delete the counter from the database (or archive/inactivate its record
    //    for history or audit purposes).

  }
}
