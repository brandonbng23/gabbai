import type { ShulUser } from './user.mts';

export interface ParshaData {
    /* @interface ParshaData: object storing parsha data as an object to be easily returned as JSON */

    /* Number identifying parsha */
    id: number;

    /* Hebrew Date of parsha as a string (formatted for frontend view) */
    hDate: string;

    /* Gregorian Date of parsha as a string (formatted for frontend view) */
    gregDate: string;

    /* String repersenting parsha name */
    desc: string;

    /* String repersenting the name of a reading occassion that may alter psukim. If no occassion,
     * set occassion as "". */
    occassions: string[];

    /* Admin-added labels, independent of calendar-generated occasions. */
    manualOccasions: string[];

    /* Boolean repersenting if the entire Parsha is locked (true) or not (false) */
    locked: boolean;

    /* Array of booleans each repersenting if each an aliyah is locked (true) or not (false) */
    lockedArr: boolean[];

    /* String repersenting book of Torah aliyah is read from */
    book: string;

    /* Array of strings repersenting verses to be read for each aliyah of parsha. */
    psukim: string[];

    /* Assigned users for each aliyah; null means unassigned. */
    readers: (ShulUser | null)[];

    /* Array of strings that should allow this parsha to surface when filtering through parshiyot */
    searchTerms: string[];

    /* String repersenting a gregorian date as formatted: `MM-DD-YYYY` */
    dateString: string;
}