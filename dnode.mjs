export class Dnode {

    /* prev: link to the linked node preceeding current node
     * value: value stored at current node
     * next: link to the linked node succeeding current node */
    constructor(value) {
        this.prev = null;
        this.value = value;
        this.next = null;
    }
}