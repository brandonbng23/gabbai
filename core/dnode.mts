export class Dnode {

    /* Node to construct a linked list
     * 
     * @field prev: link to the linked node preceeding current node
     * @field value: value stored at current node
     * @field next: link to the linked node succeeding current node */
    prev: null = null;
    value: any;
    next: null = null;

    constructor(value: any) {
        this.value = value;
    }
}