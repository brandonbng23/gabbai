export class User {
    /* Repersents a user in its most basic form
     *
     * @field firstN: string repersenting user's first name
     * @field lastN: string repersenting user's last name
     * @field email: string repersenting user's email address
     * @field password: password repersenting user's password as a protective measure
     * @field readings: array of ParshaEvent repersenting the readings assigned to User */
    constructor(firstN, lastN, email, password) {
        this.firstN = firstN;
        this.lastN = lastN;
        this.email = email;
        this.password = password;
        this.readings = [];
    }

    /* Accesses User's first name */
    getFirstN() {
        return this.firstN;
    }

    /* Accesses User's last name */
    getLastN() {
        return this.lastN;
    }

    /* Assembles and formats first and last name fields as string: ex. "BEN COHEN" */
    nameToString() {
        return this.firstN + " " + this.lastN;
    }

    /* Accesses User's email address */
    getEmail() {
        return this.email;
    }

    /* Accesses User's password */
    getPassword() {
        return this.password;
    }

    /* Accesses User's assigned readings */
    getReadings() {
        return this.readings;
    }

    /* Mutates first name field to match input
    @param n: string repersenting first name to update field */
    setFirstN(n) {
        this.firstN = n;
    }

    /* Mutates last name field to match input
    @param n: string repersenting last name to update field */
    setLastN(n) {
        this.lastN = n;
    }

    /* Mutates email field to match input
    @param a: string repersenting address of email to update field */
    setEmail(a) {
        this.email = a; // future expansion: return false if string does not match email format "@", "."-com, etc.
    }

    /* Mutates password field to match input
    @param p: string repersenting address of password field */
    setPassword(p) {
        this.password = p; // future expansion: return false is string does not match password format
    }

    /* Adds reading to list of this.readings, list of assigned readings
     * @param p: ParshaEvent repersenting parsha to be added to this.readings */
    addReading(p) {
        this.readings.push(p);
    }

    /* Removes specified reading from this.readings
     * @param p: ParshaEvent to remove  from User's assigned reading list */
    removeReading(p) {
        let newReadings = [];

        for (let i = 0; i < this.readings.length; i++) {
            if (this.readings[i] != p) {
                newReadings.push(this.readings[i]);
            } 
        }

        this.readings = newReadings;
    }

    /* Converts an exisiting user to an admin. Removes exisiting user from shul's users array and adds an
     * appropriate instance of Admin to shul's admin array
     * @param user: instance of User repersenting existing user to become an Admin
     * @param title: string repsenting the title of the position this admin holds
     * @param shul: instance of Shul repersenting the shul for which this admin will administrate
     * @param key: repersents key to verify admin's association with shul */
    convertToAdmin(key, shul, title) {
        if (key == shul?.getKey()) {
            shul?.removeUser(this);
            let newAdmin = new Admin(this.firstN,
                                     this.lastN,
                                     this.email,
                                     this.password,
                                     title,
                                     shul,
                                     key);
        
            shul?.addAdmin(newAdmin);
            return newAdmin;
        }
        return null;
    }

    /* Returns user data for current user
     * @returns: object retaining all user data */
    getUserData() {
        return {
            firstN: this.firstN,
            lastN: this.lastN,
            email: this.email,
            password: this.password
        }
    }
}