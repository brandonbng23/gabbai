// This comment is to a test for git control

import { User } from "./user.mjs"

export class Admin extends User {
    /* Repersents a user who is a shul's administrator who will be granted permissions regarding 
     * their shul's reading schedule
     *
     * @field title: string repersenting the title of the position this shul's administrator holds
     * @field shul: instance of Shul for who which the administrator adminstrates
     * @field key: string repersenting the key of the shul for which the administrator administrates
     * - Note that the adminstrator's key is unique to their shul, not to each administrator */
    constructor(firstN, lastN, email, password, title, shul, key) {
        super(firstN, lastN, email, password);
        this.title = title;
        this.shul = shul;
        this.key = key;
    }

    /* Mutates key field
     * @param key: key for which the key field will mutate to */
    setKey(key) {
        this.key = key;
    }

    /* Revokes an existing Admin's administrator privelages
     * param r: boolean. If r is set true, administrator privelages will be revoked but admin will retain
     * user privelages. If r is set false, administraor and user privelages will be revoked. */
    revokeAdmin(r) {
        this.shul.removeAdmin();
        if (r) {
            this.shul?.(new User(this.firstN, this.lastN, this.email, this.password));
        }
    }
}