export class Triennial {
    /* Repersents options and settings for use of a Triennial reading schedule, including the
     * option to not follow a Triennial schedule at all 
     *
     * @field triennial: boolean repersenting the following of a triennial schedule (true) or not (false)
     * @field triMaftir: boolean repersenting the following of the triennial maftir (true) or not (false)
     * @field tradMaftir: boolean repersenting the following of the traditional maftir (true) or not (false)
     * @fiedl yitro: boolean repersenting if the triennial schedule should apply to Parsha Yitro (true) or not (false) */
    constructor (triennial, triMaftir, tradMaftir, yitro) {
        this.triennial = triennial;
        this.triMaftir = triMaftir;
        this.tradMaftir = tradMaftir;
        this.yitro = yitro;
    }

    /* Access triennial setting
     * @returns boolean repersenting schedule is set to follow the triennial schedule (true) or not (false) */
    getTriennial() {
        return this.triennial;
    }

    /* Access maftir fields (triMaftir and tradMaftir) and returns which is set true, or "None" if both are set false 
     * @returns string repersenting which maftir is set true: "Triennial" if triMaftir, "Traditional" if tradMaftir, or 
     * "None" if both are set false */
    getMaftir() {
        if (this.triMaftir) {
            return "Triennial";
        } else if (this.tradMaftir) {
            return "Traditional";
        } else {
            return "None";
        }
    }

    /* Accesses Yitro setting determing if the triennial schedule will apply to Parsha Yitro 
     * @returns boolean repersenting if the triennial schedule will apply to Parsha Yitro (true) or not (false) */
    getYitro() {
        return this.yitro;
    }

    /* Mutates Triennial setting
     * @param t: boolean repersenting triennial setting on (true) or off (false) */
    setTriennial(t) {
        this.triennial = t;
    }

    /* Mutates Maftir setting
     * @param m: string repersenting triennial maftir reading ("tri"), traditional maftir reading ("trad"), or no maftir
     * reading ("none") */
    setMaftir(m) {
        if (m == "tri") {
            this.triMaftir = true;
        } else if (m == "trad") {
            this.tradMaftir = true;
        } else if (m == "none") {
            this.triMaftir = false;
            this.tradMaftir = false;
        }
    }

    /* Mutates subscription to triennial reading pattern regarding Parsha Yitro
     * @param y: boolean repersenting triennial subscription to Parsha Yitro (true) or not (false) */
    setYitro(y) {
        this.yitro = y;
    }
}