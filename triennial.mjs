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
}