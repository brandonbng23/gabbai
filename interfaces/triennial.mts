export interface Triennial {
    /* @interface repersenting triennial settings */

    /* Subscribe to triennial (true) or not (false) */
    tri: boolean,

    /* Subscribe to triennial maftir (true) or not (false) */
    triMaftir: boolean,

    /* Subscribe to traditional maftir (true) or not (false) */
    tradMaftir: boolean,

    /* Subscribe to triennial reading pattern for Parsha Yitro containing the 10 
     * Commandments (true) or not */
    yitro: boolean,

    /* Subscribe to triennial reading pattern for Parsha Vaetchanan containing the 
     * 10 Commandments and Shema (true) or not */
    vaetchanan: true
}