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

    /* String repersenting book of Torah aliyah is read from */
    book: string;

    /* Array of strings repersenting verses to be read for each aliyah of parsha. */
    psukim: string[];

    /* Boolean repersenting if reading set of parsha is locked */
    parshaLockStatus: boolean;

    /* Array of booleans repersenting if each individual aliyah is locked or not */
    aliyotLockStatus: boolean[];

    /* Array of strings repersenting reads for each aliyah of parsha */
    readers: string[];

    /* Array of strings that should allow this parsha to surface when filtering through parshiyot */
    searchTerms: string[];

    /* String repersenting a gregorian date as formatted: `MM-DD-YYYY` */
    dateString: string;
}