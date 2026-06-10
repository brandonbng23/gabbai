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
        this.yRespect = true;

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

    /* Accesses set Hebrew year */
    getHebYear() {
        return this.hebYear;
    }

    /* Mutates set Hebrew year
     * @param year: number repersenting Hebrew year to update field */
    setHebYear(year) {
        this.hebYear = year;
    } 

    /* Accesses subscription setting to diasporic (false) or Israeli (true) reading pattern */
    getIL() {
        return this.il;
    }

    /* Mutates disaporic subscripting setting
     * @param il: boolean repersenting subscription to disaporic (false) or Israeli (true) reading apttern */
    setIL(il) {
        this.il = il;
    }

    /* Accesses set aliyot count */
    getAliyotCount() {
        return this.a;
    }

    /* Mutates aliyot count
     * @param a: number repersenting aliyot count to update field */
    setAliyotCount(a) {
        this.a = a;
    }

    /* Accesses subscription to High Holiday aliyot count (true) or not (false) */
    getHhRespect() {
        return this.hhRespect;
    }

    /* Mutates subscription to High Holiday aliyot count
     * @param r: subscribes to traditional High Holiday aliyot acount (true) or unsubscribes (false) */
    setHhRespect(r) {
        this.hhRespect = r;
    }

    /* Accesses subscription to Yontif aliyot count (true) or not (false) */
    getYRespect() {
        return this.yRespect;
    }

    /* Mutates subscription to Yontif aliyot count
     * @param r: subscribes to traditional Yontif aliyot count (true) or unsubscribes (false) */
    setYRespect(r) {
        this.yRespect = r;
    }

    getYontif(y) {
        return this.yontifs[y];
    }

    setYontif(y, r) {
        this.yontifs[y] = r;
    }

    getTriennial() {
        return this.triennial.getTriennial();
    }

    setTriennial(t) {
        this.triennial.setTriennial(t);
    }

    getMaftir() {
        return this.triennial.getMaftir()
    }

    setTriMaftir() {
        this.triennial.setMaftir("tri")
    }

    setTradMaftir() {
        this.triennial.setMaftir("trad");
    }

    setNoMaftir() {
        this.triennial.setMaftir("none");
    }

    getYitro() {
        return this.triennial.getYitro();
    }

    setYitro() {
        this.triennial.setYitro(t);
    }
}