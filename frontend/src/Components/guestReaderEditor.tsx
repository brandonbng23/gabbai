import { useEffect, useId, useRef, useState } from 'react';
import { userTitles } from '../../../interfaces/titles.mts';
import type { UserProfile } from '../api.ts';

const fields = [
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'firstName', label: 'First Name', type: 'text' },
    { key: 'lastName', label: 'Last Name', type: 'text' },
    { key: 'hebrewName', label: 'Hebrew Name', type: 'text' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'tel' },
] as const;

export function GuestReaderEditor({ readingName, aliyah, disabled, onAssign, onClose }: {
    readingName: string; aliyah: string; disabled: boolean;
    onAssign: (guest: UserProfile) => void; onClose: () => void;
}) {
    const id = useId();
    const editor = useRef<HTMLElement>(null);
    const [guest, setGuest] = useState<UserProfile>({ title: '', firstName: '', lastName: '', hebrewName: '', email: '', phone: '' });
    useEffect(() => { editor.current?.querySelector('select')?.focus(); }, []);

    return <section ref={editor} className="inline-user-editor guest-reader-editor" aria-labelledby={`${id}-heading`}
        onKeyDown={event => {
            if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
            if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault();
        }}>
        <div className="inline-user-editor-heading">
            <h3 id={`${id}-heading`}>Guest for {readingName} {aliyah}</h3>
            <button type="button" className="settings-reset-btn" disabled={disabled} onClick={onClose}>Cancel</button>
        </div>
        <fieldset className="settings-fieldset" disabled={disabled}>
            <legend className="visually-hidden">Guest information</legend>
            <div className="user-settings-fields">
                {fields.map(field => <div className={`user-settings-field inline-user-field-${field.key}`} key={field.key}>
                    <div className="settings-field-edit">
                        <label htmlFor={`${id}-${field.key}`}>{field.label}{['hebrewName', 'phone'].includes(field.key) ? ' (optional)' : ''}</label>
                        {field.key === 'title' ? <select id={`${id}-${field.key}`} required value={guest.title}
                            onChange={event => setGuest(previous => ({ ...previous, title: event.target.value }))}>
                            <option value="">Select</option>
                            {userTitles.map(title => <option key={title} value={title}>{title}</option>)}
                        </select> : <input id={`${id}-${field.key}`} type={field.type} value={guest[field.key]} maxLength={254}
                            pattern={['firstName', 'lastName'].includes(field.key) ? '.*\\S.*' : undefined}
                            required={['firstName', 'lastName', 'email'].includes(field.key)} autoComplete="off"
                            onChange={event => setGuest(previous => ({ ...previous, [field.key]: event.target.value }))} />}
                    </div>
                </div>)}
            </div>
            <div className="inline-user-editor-footer">
                <span>The guest and assignment are saved when you publish section changes.</span>
                <button type="button" className="submit-btn" onClick={() => {
                    const controls = editor.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select');
                    if (controls && [...controls].every(control => control.reportValidity())) {
                        const values = Object.fromEntries(Object.entries(guest).map(([key, value]) => [key, value.trim()])) as UserProfile;
                        if (!values.firstName || !values.lastName) return;
                        onAssign(values);
                    }
                }}>Assign guest</button>
            </div>
        </fieldset>
    </section>;
}
