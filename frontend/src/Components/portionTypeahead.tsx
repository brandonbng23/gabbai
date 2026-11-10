import { useEffect, useId, useRef, useState } from 'react';
import { parshiot } from '@hebcal/core';

const searchKey = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f'’\-\s]/g, '');

export function PortionTypeahead({ id, value, onChange }: {
    id: string;
    value: string;
    onChange: (value: string) => void;
}) {
    const listId = useId();
    const input = useRef<HTMLInputElement>(null);
    const list = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(-1);
    const matches = parshiot.filter(portion => searchKey(portion).includes(searchKey(query)));

    useEffect(() => {
        if (open && active >= 0) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
    }, [active, open]);

    function select(portion: string) {
        onChange(portion);
        input.current?.focus();
        setOpen(false);
        setActive(-1);
    }

    return <div className="portion-typeahead" onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
        <input ref={input} id={id} value={value} required maxLength={100} autoComplete="off"
            role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId}
            aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
            placeholder="Search parshiyot…" onFocus={() => { setQuery(''); setActive(-1); setOpen(true); }}
            onChange={event => {
                onChange(event.target.value);
                setQuery(event.target.value);
                setActive(-1);
                setOpen(true);
            }} onKeyDown={event => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    setOpen(true);
                    if (matches.length) setActive(previous => event.key === 'ArrowDown'
                        ? (previous + 1) % matches.length
                        : previous <= 0 ? matches.length - 1 : previous - 1);
                } else if (event.key === 'Enter' && open) {
                    event.preventDefault();
                    if (active >= 0 && matches[active]) select(matches[active]);
                    else setOpen(false);
                } else if (event.key === 'Escape' && open) {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen(false);
                }
            }} />
        {open && <div className="portion-typeahead-menu">
            <div ref={list} id={listId} role="listbox" aria-label="Parshiyot">
                {matches.map((portion, index) => <button type="button" role="option" tabIndex={-1}
                    id={`${listId}-${index}`} key={portion} aria-selected={active === index}
                    onMouseDown={event => event.preventDefault()} onClick={() => select(portion)}>{portion}</button>)}
            </div>
            {matches.length === 0 && <span className="portion-typeahead-empty" role="status">No matching parshiyot. You can keep your custom entry.</span>}
        </div>}
    </div>;
}
