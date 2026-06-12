export class Triennial {
    /* Repersents options and settings for use of a Triennial reading schedule, including the
     * option to not follow a Triennial schedule at all 
     *
     * @field triennial: boolean repersenting the following of a triennial schedule (true) or not (false)
     * @field triMaftir: boolean repersenting the following of the triennial maftir (true) or not (false)
     * @field tradMaftir: boolean repersenting the following of the traditional maftir (true) or not (false)
     * @fiedl yitro: boolean repersenting if the triennial schedule should apply to Parsha Yitro (true) or not (false)
     * @field vaetchanan: boolean repersenting if the triennial schedule should apply to Parsha Vaetchanan (true), meaning
     * the Ten Commandments and Shema are read strictly in years 2 and 3 respectively, or if the Ten Commandments will be
     * read every year and the Shema read in both years 2 and 3 (false)  */
    constructor (triennial, triMaftir, tradMaftir, yitro, vaetchanan) {
        this.triennial = triennial;
        this.triMaftir = triMaftir;
        this.tradMaftir = tradMaftir;
        this.yitro = yitro;
        this.vaetchanan = vaetchanan;
    }

    /* Access triennial setting
     * @returns boolean repersenting schedule is set to follow the triennial schedule (true) or not (false) */
    getTriennial() {
        return this.triennial;
    }

    /* Access maftir fields (triMaftir and tradMaftir) and returns which is set true, or "None" if both are set false 
     * @returns string repersenting which maftir is set true: "tri" if triMaftir, "trad" if tradMaftir, or 
     * "none" if both are set false */
    getMaftir() {
        if (this.triMaftir) {
            return "tri";
        } else if (this.tradMaftir) {
            return "trad";
        } else {
            return "none";
        }
    }

    /* Accesses Yitro setting determing if the triennial schedule will apply to Parsha Yitro 
     * @returns boolean repersenting if the triennial schedule will apply to Parsha Yitro (true) or not (false) */
    getYitro() {
        return this.yitro;
    }

    /* Accesses Vaetchanan setting determing if/how the triennial schedule will apply to Parsha Vaetchanan
     * @returns boolean repersenting if/how the triennial schedule will apply to Parsha Vaetchanan (true) or not (false) */
    getVaetchanan() {
        return this.vaetchanan;
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

    /* Mutates subscription to triennial reading pattern regarding Parsha Vaetchanan
     * @param v: boolean repersenting if/how triennial subscription to Parsha Vaetchanan (true) or not (false) */
     setVaetchanan(v) {
        this.vaetchanan = v;
    }

    printTriennial() {
        console.log("Triennial: " + this.triennial);
        console.log("Maftir: " + this.getMaftir());
        
        if (this.yitro) {
            console.log("Yitro: Tri");
        } else if (!this.yitro) {
            console.log("Ytrio: Traditional");
        }

        if (this.vaetchanan) {
            console.log("Vaetchanan: Tri");
        } else if (!this.vaetchanan) {
            console.log("Vaetchanan: Annual 10 Commandments");
        }

    }
}