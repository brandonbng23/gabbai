import { Triennial } from "./triennial.mjs"

export class Settings { 
    /* Streamlined class repersenting all administration settings. Fields
     * are documented in-line. All fields are set to a default value and be
     * modified with its corresponding methods */
    constructor(hebYear) {

        /* Hebrew Year: Starting Hebrew Year
         * @default: 5786 */
        if (hebYear) {
            this.hebYear = hebYear;
        } else {
            this.hebYear = 5786;
        }
        
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
        this.yontifs = {rh1: true,                                  // Rosh Hashana Day 1
                        rh2: true,                                  // Rosh Hashana Day 2
                        yk: true,                                   // Yom Kippur
                        sukkot1: true,                              // Sukkot Day 1
                        sukkot2: true,                              // Sukkot Day 2
                        sukkotSA: true,                             // Shmini Atzeret                          
                        sukkotST: true,                             // Simchat Torah
                        pesach1: true,                              // Pesach Day 1
                        pesach2: true,                              // Pesach Day 2
                        pesach7: true,                              // Pesach Day 7
                        pesach8: true,                              // Pesach Day 8
                        shavuot1: true,                             // Shavuot Day 1
                        shavuot2: true};                            // Shavuot Day 2

        /* Triennial Settings: Subscribe to different traditions regarding a triennial Torah reading pattern */
        this.triennial = {triennial: false,     // Subscribe to triennial (true) or not (false) @default: false
                          triMaftir: false,     // Subscribe to triennial maftir (true) or not (false) @default: true
                          tradMaftir: true,     // Subscribe to traditional maftir (true) or not (false) @default: true
                // NOTE: should a subscription to the triennial and traditional maftir both be false, no maftir reading will be established
                          yitro: true,          // Subscribe to triennial reading pattern for Parsha Yitro containing the 10 Commanemdnets (true) or not (false) @default: true
                          vaetchanan: true      // Subscribe to triennial reading pattern for Parsha Vaetchanan containing the 10 Commandments and Shema (true) or not (false) @default: true
                    };
        this.correctMaftir();

        /* Because triMaftir @defaults to false and tradMaftir @defaults to true, if both fields are set true, 
        

        /* Special Seventh: rarely, the traditional seventh aliyah will be overriden by a special Torah reading. Indicates
         * if, when reading less than seven aliyot, the final aliyah will be overriden by the special seventh aliyah 
         * @default: true */
        this.specialSeventh = true;
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

    /* Accesses state of specificed Yontif. If true, weekday Yontif reading will be added if applicable for
     * specific Yontif 
     * @param y: string repersenting a Yontif name. Possible names include: rh1, rh2, yk, sukkot1, sukkot2,
     * sukkotSA, sukkotST, pesach1, peasch2, peasch7, pesach8, shavuot1, shavuot2. See code key above. */
    getYontif(y) {
        return this.yontifs[y];
    }

    /* Mutates state of specific Yontif
     * @param y: string repersenting a Yontif name. Possible names include: rh1, rh2, sukkot1, sukkot2, sukkotSA,
     * sukkotST, pesach1, pesach2, pesach7, pesach8, shavuot1, shavuot2. See code key above.
     * @param r: boolean repersenting state for which to update Yontif */
    setYontif(y, r) {
        this.yontifs[y] = r;
    }

    /* Accesses subscription to triennial reading pattern */
    getTriennial() {
        return this.triennial["triennial"];
    }

    /* Mutates subscription to triennial reading pattern
     * @param t: boolean repersenting state for which to update Yontif */
    setTriennial(t) {
        this.triennial["triennial"] = t;
    }

    /* Accesses current Maftir setting
     * @returns: "tri" for triennial maftir reading, "trad" for traditional maftir reading, or "none" */
    getMaftir() {
        this.correctMaftir();

        if (this.triennial["triMaftir"] == true) {
            return "tri";
        } else if (this.triennial["tradMaftir"] == true) {
            return "trad";
        } else {
            return "none";
        }
    }

    /* Subscribes to triennial maftir reading and unsubscribes from traditional maftir when applicable*/
    setTriMaftir() {
        this.triennial["triMaftir"] = true;
        this.triennial["tradMaftir"] = false;
    }

    /* Subscribes to traditional maftir reading and unsubscribes from triennial maftir when applicable */
    setTradMaftir() {
        this.triennial["tradMaftir"] = true;
        this.triennial["triMaftir"] = false;
    }

    /* Disables maftir readings */
    disableMaftir() {
        this.triennial["triMaftir"] = false;
        this.triennial["tradMaftir"] = false;
    }

    /* Accesses triennial subscription to Parsha Yitro */
    getYitro() {
        return this.triennial["yitro"];
    }

    /* Mutates triennial subscription to Parsha Yitro
     * @param y: boolean repersenting new susbcription to Parsha Yitro (true) or not (false) */
    setYitro(y) {
        this.triennial["yitro"] = y;
    }

    /* Acesses triennial subscription to Parsha Vaetchanan
     * @returns: boolean repersenting is Parsha Vaetchanan subscribes to the triennial reading pattern (true) or not (false) */
    getVaetchanan() {
        return this.triennial["vaetchanan"];
    }

    /* Mutates triennial subscription to Parsha Vaetchanan
     * @param v: boolean repersenting new subsciption to Parsha Vaetchanan (true) or not (false) */
    setVaetchanan(v) {
        this.triennial["vaetchanan"] = v;
    }

    /* Corrects maftir fields to make sure only one is true. Because triMaftir defaults to false and tradMaftir defaults to true, when both are set true and
     * correctMaftir() is called, triMaftir is set false and tradMaftir is set true */
    correctMaftir() {
        if (this.triennial["triMaftir"] && this.triennial["tradMaftir"]) {
                this.setTradMaftir();
            }
    }

    /* Access full triennial state
     * @returns: object repersenting full triennial state */
    getFullTriennial() {
        return this.triennial;
    }

    /* Accesses special seventh state */
    getSpecialSeventh() {
        return this.specialSeventh;
    }

    /* Mutates special seventh state
     * @param r: overrides final aliyah with special seventh aliyah when applicable (true) or not (false) */
    setSpecialSeventh(r) {
        this.specialSeventh = r;
    }
}