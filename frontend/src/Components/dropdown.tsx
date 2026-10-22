import React, { useEffect, useId, useRef, useState } from "react";
import type { ShulUser } from "../api.ts";

export function UserDropDown({ options = [], selected, onSelect, disabled = false }: {
    options: ShulUser[];
    selected: ShulUser | null;
    onSelect: (reader: ShulUser | null) => void;
    disabled?: boolean;
}): React.JSX.Element {
    const [expanded, setExpanded] = useState(false);
    const [search, setSearch] = useState('');
    const searchInput = useRef<HTMLInputElement>(null);
    const query = search.trim().toLowerCase();
    const filteredOptions = options.filter(user =>
        `${user.title} ${user.firstName} ${user.lastName} ${user.email}`.toLowerCase().includes(query))
        .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
    const container = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const menuId = useId();

    useEffect(() => {
        if (!expanded) return;
        searchInput.current?.focus();
        const closeOutside = (event: PointerEvent) => {
            if (event.target instanceof Node && !container.current?.contains(event.target)) setExpanded(false);
        };
        document.addEventListener('pointerdown', closeOutside);
        return () => document.removeEventListener('pointerdown', closeOutside);
    }, [expanded]);

    return (
        <div className="user-dropdown" ref={container} onKeyDown={event => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                setExpanded(false);
                trigger.current?.focus();
            }
        }} onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false);
        }}>
            <div className="selected-option">
                <button type="button" ref={trigger} disabled={disabled} aria-expanded={expanded} aria-controls={menuId}
                    onClick={() => { setSearch(''); setExpanded(previous => !previous); }}>
                    <span>{selected ? `${selected.firstName} ${selected.lastName}` : "Available"}</span>
                    {!selected && <svg className="dropdown-add-icon" aria-hidden="true" viewBox="0 0 640 640">
                        <path d="M352 128C352 110.3 337.7 96 320 96C302.3 96 288 110.3 288 128L288 288L128 288C110.3 288 96 302.3 96 320C96 337.7 110.3 352 128 352L288 352L288 512C288 529.7 302.3 544 320 544C337.7 544 352 529.7 352 512L352 352L512 352C529.7 352 544 337.7 544 320C544 302.3 529.7 288 512 288L352 288L352 128z" />
                    </svg>}
                </button>
            </div>
            {expanded && !disabled && (
                <div className="selections" id={menuId}>
                    <div className="dropdown-search">
                        <input ref={searchInput} type="search" placeholder="Search users…"
                            aria-label="Search users" value={search}
                            onChange={event => setSearch(event.target.value)}
                            onKeyDown={event => {
                                if (event.key === 'Enter') event.preventDefault();
                            }} />
                    </div>
                    {filteredOptions.map(user => (
                        <button key={user.id} type="button" onClick={() => {
                            onSelect(user);
                            setExpanded(false);
                            trigger.current?.focus();
                        }}>
                            {user.firstName} {user.lastName}
                        </button>
                    ))}
                    {filteredOptions.length === 0 && <span className="dropdown-empty" role="status">
                        {options.length === 0 ? 'No users available.' : 'No matching users.'}
                    </span>}
                </div>
            )}
        </div>
    );
}
