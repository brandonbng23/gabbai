import { User } from "./user.mjs"
import { Shul } from "./shul.mjs"

export class Admin extends User {
    /* Repersents a user who is a shul's administrator who will be granted permissions regarding 
     * their shul's reading schedule
     *
     * @field title: string repersenting the title of the position the shul's administrator holds
     * @field shul: instance of Shul for who which the administrator adminstrates
     * @field key: string repersenting the key of the shul for which the administrator administrates
     * - Note that the adminstrator's key is unique to their shul, not to each administrator */
    constructor(title, shul, key) {
        this.title = title;
        this.shul = shul;
        this.key = key;
    }
}