import { userTitles } from '../../../interfaces/titles.mts';
import type { UserProfile } from '../api.js';
import { PictureEditor } from './profilePicture.tsx';

const userEditorFields = [
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'firstName', label: 'First Name', type: 'text' },
    { key: 'lastName', label: 'Last Name', type: 'text' },
    { key: 'hebrewName', label: 'Hebrew Name', type: 'text' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'tel' },
] as const;

export function UserEditor({ id, saved, draft, disabled, pictureUrl, pictureChanged, onPictureChange, onPictureReset, onPictureBusyChange, onChange, onReset, onClose }: {
    id: string; saved: UserProfile; draft: Partial<UserProfile>; disabled: boolean;
    onChange: (key: keyof UserProfile, value: string) => void; onReset: () => void; onClose: () => void;
    pictureUrl?: string; pictureChanged: boolean; onPictureChange: (picture: string | null) => void;
    onPictureReset: () => void; onPictureBusyChange: (busy: boolean) => void;
}) {
    return <>
        <div className="inline-user-editor-heading">
            <h3 id={`${id}-heading`}>Edit {saved.firstName} {saved.lastName}</h3>
            <button type="button" className="settings-reset-btn" disabled={disabled} onClick={onClose}>Close editor</button>
        </div>
        <fieldset className="shul-edit" disabled={disabled}>
            <legend className="visually-hidden">User information</legend>
            <div className="inline-user-editor-body">
            <div className="inline-user-editor-picture">
                <span className="settings-field-label">Profile picture</span>
                <PictureEditor pictureUrl={pictureUrl} name={`${saved.firstName} ${saved.lastName}`}
                changed={pictureChanged} disabled={disabled} onChange={onPictureChange}
                onReset={onPictureReset} onBusyChange={onPictureBusyChange} />
            </div>
            <div className="user-settings-fields">
                {userEditorFields.map(field => {
                    const value = draft[field.key] ?? saved[field.key];
                    const fieldId = `${id}-${field.key}`;
                    return <div className={`user-settings-field inline-user-field-${field.key}`} data-changed={value !== saved[field.key]} key={field.key}>
                        <div className="settings-field-edit">
                            <label htmlFor={fieldId}>{field.label}</label>
                            {field.key === 'title' ? <select id={fieldId} value={value} onChange={event => onChange(field.key, event.currentTarget.value)}>
                                <option value="">Select</option>
                                {saved.title && !userTitles.some(title => title === saved.title) && <option value={saved.title}>{saved.title}</option>}
                                {userTitles.map(title => <option key={title} value={title}>{title}</option>)}
                            </select> : <input id={fieldId} type={field.type} value={value} maxLength={254}
                                autoComplete="off" required={['firstName', 'lastName', 'email'].includes(field.key)}
                                onChange={event => onChange(field.key, event.currentTarget.value)} />}
                            <div className="settings-field-reset-row">
                                <button type="button" className="settings-field-reset" tabIndex={-1} aria-label={`Reset ${field.label}`} disabled={value === saved[field.key]}
                                    onClick={() => onChange(field.key, saved[field.key])}>Reset</button>
                            </div>
                        </div>
                    </div>;
                })}
            </div>
            </div>
            <div className="inline-user-editor-footer">
                <span>Changes take effect when you publish section changes.</span>
                <button type="button" className="settings-reset-btn" disabled={!Object.keys(draft).length && !pictureChanged} onClick={onReset}>Reset user changes</button>
            </div>
        </fieldset>
    </>;
}
