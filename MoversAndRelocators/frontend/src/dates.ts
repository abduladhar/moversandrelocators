/**
 * Default values for date inputs: new records start on today's date (date fields) or the current time (date-and-time
 * fields), in the user's own time zone. (new Date().toISOString() is UTC, which is still "yesterday" for part of the
 * morning east of Greenwich, so never slice it for a default.)
 */
export const localInputValue = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
/** Today as an <input type="date"> value: YYYY-MM-DD. */
export const todayLocal = () => localInputValue(new Date()).slice(0, 10)
/** Now as an <input type="datetime-local"> value: YYYY-MM-DDTHH:mm. */
export const nowLocal = () => localInputValue(new Date())
