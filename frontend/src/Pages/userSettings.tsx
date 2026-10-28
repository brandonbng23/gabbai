import { AccountSecurity } from '../Components/accountSecurity.tsx';
import { UserReadingStats } from '../Components/userReadingStats.tsx';
import { DismissMessageButton } from '../Components/dismissMessageButton.tsx';
import { useEffect, useState } from 'react';
import type { JSX, SubmitEvent } from 'react';
import { userTitles } from '../../../interfaces/titles.mts';
import { cancelReading, updateCurrentUser } from '../api.js';
import type { Shul, User, UserProfile, UserReading } from '../api.js';
import { PictureEditor, ProfilePicture } from '../Components/profilePicture.tsx';
import { getGreeting } from "../Components/welcomeBar.tsx"

const editableFields = [
    { key: 'title', label: 'Title', type: 'text', required: false, autoComplete: 'honorific-prefix' },
    { key: 'firstName', label: 'First Name', type: 'text', required: true, autoComplete: 'given-name' },
    { key: 'lastName', label: 'Last Name', type: 'text', required: true, autoComplete: 'family-name' },
    { key: 'hebrewName', label: 'Hebrew Name', type: 'text', required: false, autoComplete: 'off' },
    { key: 'email', label: 'Email', type: 'email', required: true, autoComplete: 'email' },
    { key: 'phone', label: 'Phone', type: 'tel', required: false, autoComplete: 'tel' },
] as const;

function profileValues(user: User): UserProfile {
    return { title: user.title, firstName: user.firstName, lastName: user.lastName,
        hebrewName: user.hebrewName, email: user.email, phone: user.phone };
}

export function UserSettings({ user, shul, onSaved, onReadingCancelled }: {
    user: User;
    shul: Shul | null;
    onSaved: (user: User) => void;
    onReadingCancelled: (dateString: string, desc: string, aliyah: number) => void;
}): JSX.Element {
    const [draft, setDraft] = useState<UserProfile>(() => profileValues(user));
    const [saving, setSaving] = useState(false);
    const [pictureBusy, setPictureBusy] = useState(false);
    const [pictureDraft, setPictureDraft] = useState<string | null | undefined>();
    const picturePreview = pictureDraft === undefined ? user.pictureUrl : pictureDraft ?? undefined;
    const [feedback, setFeedback] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);
    const changedFields = editableFields.filter(field => {
        const value = draft[field.key].trim();
        return (field.key === 'email' ? value.toLowerCase() : value) !== user[field.key];
    });
    const hasChanges = changedFields.length > 0 || pictureDraft !== undefined;

    useEffect(() => {
        if (!hasChanges) return;
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [hasChanges]);

    function changeField(key: keyof UserProfile, value: string): void {
        setDraft(previous => ({ ...previous, [key]: value }));
        setFeedback(null);
    }

    async function saveProfile(event: SubmitEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (saving || pictureBusy || !hasChanges) return;
        setSaving(true);
        setFeedback(null);
        try {
            const changes = Object.fromEntries(changedFields.map(field => [field.key, draft[field.key].trim()]));
            const updated = await updateCurrentUser({ ...changes, ...(pictureDraft !== undefined ? { picture: pictureDraft } : {}) });
            setPictureDraft(undefined);
            setDraft(profileValues(updated));
            onSaved(updated);
            setFeedback({ kind: 'success', text: 'Your profile has been saved.' });
        } catch (failure) {
            setFeedback({ kind: 'error', text: failure instanceof Error ? failure.message : 'Unable to save your profile.' });
        } finally {
            setSaving(false);
        }
    }

    async function cancelAssignedReading(reading: UserReading): Promise<void> {
        if (!user.shulId) throw new Error('Join a shul to manage your readings.');
        await cancelReading(user.shulId, reading.dateString, reading.desc, reading.aliyah);
        onReadingCancelled(reading.dateString, reading.desc, reading.aliyah);
    }

    const profileFields = [
        { label: 'Full Name', value: [user.title, user.firstName, user.lastName].filter(Boolean).join(' ') },
        { label: 'Hebrew Name', value: user.hebrewName },
        { label: 'Email', value: user.email },
        { label: 'Phone', value: user.phone },
        { label: 'Shul', value: shul?.name ?? '-' },
        ...(user.role === 'admin' ? [{ label: 'Role', value: 'Admin' }] : []),
    ];
    return (
        <main className="shul-admin-page user-page">
            <header className="settings-page-header">
                <div>
                    <span className="settings-eyebrow">PROFILE MANAGEMENT</span>
                    <h1>My Preferences</h1>
                    <p>Manage your profile and personal preferences.</p>
                </div>
            </header>
            <div className="shul-settings">
                <div className="settings-view">
                    <section className="shul-card" aria-labelledby="user-profile-heading">
                        <div className="settings-summary-heading user-profile-heading">
                            <ProfilePicture src={user.pictureUrl} name={`${user.firstName} ${user.lastName}`} />
                            <div>
                                <h2 id="user-profile-heading">{`${getGreeting()}, ${user.firstName}`}</h2>
                            </div>
                            <span className="settings-published-badge">Profile details</span>
                        </div>
                        <dl className="settings-contact-grid user-profile-fields">
                            {profileFields.map(field => (
                                <div key={field.label} className={field.label === 'Hebrew Name' ? 'user-profile-hebrew-name' : undefined}>
                                    <dt className="settings-contact-label">{field.label}</dt>
                                    <dd>{field.value || '-'}</dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                    <UserReadingStats user={user} onCancelReading={user.shulId ? cancelAssignedReading : undefined}
                        cancellationDisabled={saving} />
                    <section className="settings-panel" aria-labelledby="user-details-heading">
                        <div className="settings-section-header">
                            <div>
                                <h2 id="user-details-heading">Personal Information</h2>
                                <p>Update your name and contact details.</p>
                            </div>
                        </div>
                        <form className="shul-settings-edit" onSubmit={saveProfile}>
                            <span className="settings-field-label">Profile picture</span>
                            <PictureEditor pictureUrl={picturePreview} name={`${user.firstName} ${user.lastName}`}
                                onChange={picture => {
                                    setPictureDraft(picture === null && !user.pictureUrl ? undefined : picture);
                                    setFeedback(null);
                                }} onReset={() => setPictureDraft(undefined)} changed={pictureDraft !== undefined}
                                disabled={saving} onBusyChange={setPictureBusy} />
                            <fieldset className="shul-edit" disabled={saving || pictureBusy}>
                                <legend className="visually-hidden">Edit personal information</legend>
                                <div className="user-settings-fields">
                                {editableFields.map(field => (
                                    <div className={`user-settings-field${['title', 'firstName', 'lastName'].includes(field.key) ? '' : ' user-settings-field-full'}`} key={field.key}>
                                        <div className="settings-field-edit">
                                            <label htmlFor={`user-${field.key}`}>{field.label}</label>
                                            {field.key === 'title' ? (
                                                <select id="user-title" value={draft.title} autoComplete={field.autoComplete}
                                                    onChange={event => changeField('title', event.currentTarget.value)}>
                                                    <option value="">Select</option>
                                                    {user.title && !userTitles.some(title => title === user.title)
                                                        && <option value={user.title}>{user.title}</option>}
                                                    {userTitles.map(title => <option key={title} value={title}>{title}</option>)}
                                                </select>
                                            ) : (
                                                <input id={`user-${field.key}`} type={field.type} value={draft[field.key]}
                                                    autoComplete={field.autoComplete} maxLength={254} required={field.required}
                                                    onChange={event => changeField(field.key, event.currentTarget.value)} />
                                            )}
                                            <div className="settings-field-reset-row">
                                                <button type="button" className="settings-field-reset" tabIndex={-1}
                                                    aria-label={`Reset ${field.label} to its last saved value`}
                                                    disabled={!changedFields.some(changed => changed.key === field.key)}
                                                    onClick={() => changeField(field.key, user[field.key])}>Reset</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                </div>
                                <div className="settings-form-footer user-settings-footer">
                                    <div className={`submission-msg${feedback ? ` submission-msg-${feedback.kind}` : ''}`}
                                        role={feedback?.kind === 'error' ? 'alert' : 'status'} aria-live="polite">
                                        {(saving || feedback) && <>
                                            <span>{saving ? 'Saving your profile…' : feedback?.text}</span>
                                            {!saving && feedback && <DismissMessageButton onDismiss={() => setFeedback(null)} />}
                                        </>}
                                    </div>
                                    <div className="settings-footer-actions">
                                        <span>Changes take effect after saving.</span>
                                        <div className="settings-footer-buttons">
                                            <button type="button" className="settings-reset-btn" disabled={!hasChanges}
                                                onClick={() => {
                                                    setDraft(profileValues(user));
                                                    setPictureDraft(undefined);
                                                    setFeedback({ kind: 'info', text: 'Unsaved profile changes reset.' });
                                                }}>Reset changes</button>
                                            <button type="submit" className="submit-btn" disabled={!hasChanges}>
                                                {saving ? 'Saving…' : 'Save Changes'}
                                            </button>
                                        </div>

                                    </div>
                                </div>
                            </fieldset>
                        </form>
                    </section>
                    <AccountSecurity />
                </div>
            </div>
        </main>
    )
}
