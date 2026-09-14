export class Dnode {
    /* @class repersenting a node to construct a doubly-linked list

    /* @field prev: repersents previous node (Dnode) of a linked list. Null if first element */
    prev: null | Dnode = null;

    /* @field value: repersents value of current node (Dnode) of a linked list */
    value: any;

    /* @field next: repersents next node (Dnode) of a linked list. Null if final element */
    next: null | Dnode = null;

    constructor(value: any) {
        this.value = value;
    }
}