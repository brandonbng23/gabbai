export class User {
    /* Repersents a user in its most basic form
     *
     * firstN: string repersenting user's first name
     * lastN: string repersenting user's last name
     * email: string repersenting user's email address
     * password: password repersenting user's password as a protective measure */
    constructor(firstN, lastN, email, password) {
        this.firstN = firstN;
        this.lastN = lastN;
        this.email = email;
        this.password = password;
    }

    /* Accesses user's first name */
    getFirstN() {
        return this.firstN;
    }

    /* Accesses user's last name */
    getLastN() {
        return this.lastN;
    }

    /* Assembles and formats first and last name fields as string: ex. "BEN COHEN" */
    nameToString() {
        return this.firstN + " " + this.lastN;
    }

    /* Accesses user's email address */
    getEmail() {
        return this.email;
    }

    /* Accesses user's password */
    getPassword() {
        return this.password;
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
}