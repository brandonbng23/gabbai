import React, { useEffect, useId, useRef, useState } from "react";
import type { ShulUser } from "../api.ts";

export function UserDropDown({ options = [], selected, onSelect, disabled = false }: {
    options: ShulUser[];
    selected: ShulUser | null;
    onSelect: (reader: ShulUser | null) => void;
    disabled?: boolean;
}): React.JSX.Element {
    const [expanded, setExpanded] = useState(false);
    const container = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const menuId = useId();

    useEffect(() => {
        if (!expanded) return;
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
                    onClick={() => setExpanded(previous => !previous)}>
                    {selected ? `${selected.firstName} ${selected.lastName}` : "Available"}
                </button>
            </div>
            {expanded && !disabled && (
                <div className="selections" id={menuId}>
                    {options.map(user => (
                        <button key={user.id} type="button" onClick={() => {
                            onSelect(user);
                            setExpanded(false);
                            trigger.current?.focus();
                        }}>
                            {user.firstName} {user.lastName}
                        </button>
                    ))}
                    {options.length === 0 && <span className="dropdown-empty">No users available.</span>}
                </div>
            )}
        </div>
    );
}
