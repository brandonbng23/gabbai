import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { getJson } from '../api.js';
import type { UserViewProfile } from '../api.js';
import { ProfilePicture } from '../Components/profilePicture.tsx';
import { LoadingSkeleton } from '../Components/loadingSkeleton.tsx';

export function UserView({ userId }: { userId: string }): JSX.Element {
    const [profile, setProfile] = useState<UserViewProfile | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!userId) return;
        const controller = new AbortController();
        getJson<UserViewProfile>(`/api/users/${encodeURIComponent(userId)}`, controller.signal)
            .then(result => {
                if (!controller.signal.aborted) setProfile(result);
            })
            .catch(failure => {
                if (!controller.signal.aborted)
                    setError(failure instanceof Error ? failure.message : 'Unable to load this user.');
            });
        return () => controller.abort();
    }, [userId]);

    const fullName = profile ? [profile.title, profile.firstName, profile.lastName].filter(Boolean).join(' ') : '';
    const fields = profile ? [
        { label: 'Full Name', value: fullName },
        { label: 'Hebrew Name', value: profile.hebrewName },
        { label: 'Shul', value: profile.shulName },
        { label: 'Assigned Readings', value: String(profile.assignedReadingCount) },
        ...(profile.role === 'admin' ? [{ label: 'Role', value: 'Admin' }] : []),
    ] : [];

    return (
        <main className="shul-admin-page user-page">
            <header className="settings-page-header">
                <div>
                    <span className="settings-eyebrow">YOUR CONGREGATION</span>
                    <h1>User Profile</h1>
                </div>
            </header>
            {!userId || error ? <p className="shul-context" role="alert">{error || 'Choose a user to view.'}</p>
                : !profile ? <LoadingSkeleton variant="profile" />
                : <div className="shul-settings">
                    <div className="settings-view">
                        <section className="shul-card" aria-labelledby="user-profile-heading">
                            <div className="settings-summary-heading user-profile-heading">
                                <ProfilePicture src={profile.pictureUrl} name={fullName} />
                                <div>
                                    <span className="settings-eyebrow">PROFILE</span>
                                    <h2 id="user-profile-heading">{fullName}</h2>
                                </div>
                            </div>
                            <dl className="settings-contact-grid user-profile-fields">
                                {fields.map(field => (
                                    <div key={field.label}>
                                        <dt className="settings-contact-label">{field.label}</dt>
                                        <dd>{field.value || '-'}</dd>
                                    </div>
                                ))}
                            </dl>
                        </section>
                    </div>
                </div>}
        </main>
    );
}
