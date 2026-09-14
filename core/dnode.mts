export class Dnode {

    /* Node to construct a linked list
     * 
     * @field prev: link to the linked node preceeding current node
     * @field value: value stored at current node
     * @field next: link to the linked node succeeding current node */
    prev: null | Dnode = null;
    value: any;
    next: null | Dnode = null;

    constructor(value: any) {
        this.value = value;
    }
}