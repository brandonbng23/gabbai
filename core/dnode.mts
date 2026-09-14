export class Dnode {

    /* Node to construct a linked list
     * 
     * @field prev: link to the linked node preceeding current node
     * @field value: value stored at current node
     * @field next: link to the linked node succeeding current node */
    constructor(value) {
        this.prev = null;
        this.value = value;
        this.next = null;
    }
}