export interface Triennial {
    /* @interface repersenting triennial settings */

    /* Subscribed to triennial (true) or not (false) */
    tri: boolean,

    /* Subscribed to triennial maftir (true) or not (false) */
    triMaftir: boolean,

    /* Subscribed to traditional maftir (true) or not (false) */
    tradMaftir: boolean,

    /* Subscribed to triennial reading pattern for Parsha Yitro containing the 10 
     * Commandments (true) or not */
    yitro: boolean,

    /* Subscribed to triennial reading pattern for Parsha Vaetchanan containing the 
     * 10 Commandments and Shema (true) or not */
    vaetchanan: boolean
}