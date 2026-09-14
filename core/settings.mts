import { Yontifs } from "../interfaces/yontifs.mts"
import { Triennial } from "../interface/triennial.mts"

export class Settings { 
    /* Streamlined class repersenting all administration settings. Fields
     * are documented in-line. All fields are set to a default value and be
     * modified with its corresponding methods */

    /* @field hebYear: number repersenting active Hebrew Year */
    hebYear: number;

    /* @field il: boolean repersenting reading rattern. Subscribe to diasparic 
     * (false) or Israeli (true) reading pattern @default: false (diasparic) */
    il: boolean = false;

    /* @field a: number repersenting aliyot count (number of aliyot). Range from 
     * 1-7, not including Maftir and Haftarah. @default: 7 */
    a: number = 7;

    /* @field hhRespect: boolean repersenting High Holiday aliyot count. Subscribe 
     * to traditional High Holiday Aliyot count (true) or preset, regular (this.a) 
     * Aliyot count (false) during High Holidays (Rosh Hashana, Yom Kippur, Simchat Torah)
     * @default: true (traditional count) */
    hhRespect: boolean = true;

    /* @field yRespect: boolean repersenting yontif aliyot Count. Subscribe to traditional 
     * Yontif count (true) for each Yontif or preset, regular (this.a) Aliyot count (false) 
     * during Yontifs. If true, High Holiday Aliyot Count becomes true. If false, High 
     * Holiday Aliyot Count does NOT become false @default: true (traditional count) */
    yRespect: boolean = true;

    /* @field yontifs: Object repersenting observed Yontifs. For each Yontif, indicates if a 
     * special reading should be added to the reading schedule (true) or not (false) when the 
     * Yontif is on a weekday. @default (for each Yontif): true */
    yontifs: Yontifs = { 
                    /* Rosh Hashana Day 1 */
                    rh1: true,   
                    
                    /* Rosh Hashana Day 2 */
                    rh2: true,       
                    
                    /* Yom Kippur */
                    yk: true,  
                    
                    /* Sukkot Day 1 */
                    sukkot1: true,  
                    
                    /* Sukkot Day 2 */
                    sukkot2: true,    
                    
                    /* Shmini Atzeret */
                    sukkotSA: true,    
                    
                    /* Simchat Torah */
                    sukkotST: true,                             

                    /* Pesach Day 1 */
                    pesach1: true,   
                    
                    /* Pesach Day 2 */
                    pesach2: true,    
                    
                    /* Pesach Day 7 */
                    pesach7: true,     
                    
                    /* Pesach Day * */
                    pesach8: true,    
                    
                    /* Shavuot Day 1 */
                    shavuot1: true,  
                    
                    /* Shavuot Day 2 */
                    shavuot2: true 
    };                           

    /* @field triennial: object repersenting triennial settings: Subscribe to different traditions 
     * regarding a triennial Torah reading pattern */
    triennial: Triennial = { 
                    /* Subscribe to triennial (true) or not (false) @default: false */
                    tri: false,
                  
                    /* Subscribe to triennial maftir (true) or not (false) @default: true */
                    triMaftir: false,

                    /* Subscribe to traditional maftir (true) or not (false) @default: true
                     * NOTE: should a subscription to the triennial and traditional maftir both 
                     * be false, no maftir reading will be established */
                    tradMaftir: true, 

                    /* Subscribe to triennial reading pattern for Parsha Yitro containing the 10 
                     * Commandments (true) or not (false) @default: true */
                     yitro: true, 

                    /* Subscribe to triennial reading pattern for Parsha Vaetchanan containing the 
                     * 10 Commandments and Shema (true) or not (false) @default: true */
                    vaetchanan: true
    };

    /* @field specialSeventh: boolean repersenting rule of special seventh. Rarely, the traditional seventh aliyah will be overriden by a special Torah reading. Indicates
     * if, when reading less than seven aliyot, the final aliyah will be overriden by the special seventh aliyah 
     * @default: true */
    specialSeventh: boolean = true;

    constructor(hebYear: number) {

        /* Hebrew Year: Starting Hebrew Year
         * @default: 5786 */
        if (hebYear) {
            this.hebYear = hebYear;
        } else {
            this.hebYear = 5786;
        }
        
        // Ensure both maftirs are not set true       
        this.correctMaftir();   
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
        return this.triennial["tri"];
    }

    /* Mutates subscription to triennial reading pattern
     * @param t: boolean repersenting state for which to update Yontif */
    setTriennial(t) {
        this.triennial["tri"] = t;
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

    /* Prints triennial data for debugging */
    printTriennial() {
        console.log("Triennial: " + this.getTriennial());
        console.log("Maftir: " + this.getMaftir())

        if (this.getYitro()) {
            console.log("Yitro: tri");
        } else {
            console.log("Ytiro: trad");
        }

        if (this.getVaetchanan()) {
            console.log("Vaetchanan: tri");
        } else {
            console.log("Vaetchanan: annual 10 Commandments");
        }
    }

    /* Returns settings data
     * @returns object retaining all settings data */
    getSettingsData() {
        return {
            hebYear: this.hebYear,
            il: this.il,
            aliyotCount: this.a,
            hhRespect: this.hhRespect,
            yRespect: this.yRespect,
            yontifs: this.yontifs,
            triennial: this.triennial,
            specialSeventh: this.specialSeventh
        };
    }
}