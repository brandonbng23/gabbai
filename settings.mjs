import { Triennial } from "./triennial.mjs"

export class Settings { 
    /* Streamlined class repersenting all administration settings. Fields
     * are documented in-line. All fields are set to a default value and be
     * modified with its corresponding methods */
    constructor() {

        /* Hebrew Year: Starting Hebrew Year
         * @default: 5786 */
        this.hebYear = 5786;

        /* Reading Pattern: Subscribe to diasparic (false) or Israeli (true) reading pattern
         * @default: false (diasparic) */
        this.il = false

        /* Aliyot Count: Number of aliyot. Range from 1-7, not including Maftir and Haftarh
         * @default: 7 */
        this.a = 7;

        /* High Holiday Aliyot Count: Subscribe to traditional High Holiday Aliyot count (true) or 
         * preset, regular (this.a) Aliyot count (false) during High Holidays (Rosh Hashana, Yom Kippur,
         * Simchat Torah)
         * @default: true (traditional count) */
        this.hhRespect = true;

        /* Yontif Aliyot Count: Subscribe to traditional Yontif count (true) for each Yontif or preset, regular
         * (this.a) Aliyot count (false) during Yontifs. If true, High Holiday Aliyot Count becomes true. If false,
         * High Holiday Aliyot Count does NOT become false
         * @default: true (traditional count) */
        this.respect = true;

        /* Observed Yontifs: For each Yontif, indicates if a special reading should be added to the reading schedule
         * (true) or not (false) when the Yontif is on a weekday.
         * @default (for each Yontif): true */
        this.yontifs = {rh1: true,
                        rh2: true,
                        yk: true,
                        sukkot1: true,
                        sukkot2: true,
                        sukkotCH: true,
                        sukkotSA: true,
                        sukkotST: true,
                        pesach1: true,
                        pesach2: true,
                        pesachCH: true,
                        pesach7: true,
                        pesach8: true,
                        shavuot1: true,
                        shavuot2: true};

        /* Triennial Settings: Subscribe to different traditions regarding a triennial Torah reading pattern. For more
         * details, refer to the Triennial class */
        this.triennial = new Triennial(false, // Subscribe to triennial (true) or not (false) @default: false
                                       false, // Subscribe to triennial maftir (true) or not (false) @default: false
                                       true, // Subscribe to traditional maftir (true) or not (false) @default: true
                    // NOTE: should a subscription to the triennial and traditional maftir be false, no maftir will be read
                                       true); // Subscribe to triennial pattern for Parsha Yitro reading (true) or not (false) @default: true
        
    }

}