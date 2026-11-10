import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { getJson } from '../api.js';
import type { UserViewProfile } from '../api.js';
import { UserReadingStats } from '../Components/userReadingStats.tsx';
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
        ...(profile.role === 'admin' ? [{ label: 'Role', value: 'Admin' }] : []),
    ] : [];

    return (
        <main className="account-page user-page">
            <header className="account-page-header">
                <div>
                    <span className="section-eyebrow">VISIT PROFILE</span>
                    <h1>User Profile</h1>
                </div>
            </header>
            {!userId || error ? <p className="page-message" role="alert">{error || 'Choose a user to view.'}</p>
                : !profile ? <LoadingSkeleton variant="profile" />
                : <div className="account-page-content">
                    <div className="account-page-sections">
                        <section className="summary-card" aria-labelledby="user-profile-heading">
                            <div className="summary-card-heading user-profile-heading">
                                <ProfilePicture src={profile.pictureUrl} name={fullName} />
                                <div>
                                    <span className="section-eyebrow">SUMMARY</span>
                                    <h2 id="user-profile-heading">{fullName}</h2>
                                </div>
                            </div>
                            <dl className="settings-contact-grid user-profile-fields">
                                {fields.map(field => (
                                    <div key={field.label}>
                                        <dt className="summary-field-label">{field.label}</dt>
                                        <dd>{field.value || '-'}</dd>
                                    </div>
                                ))}
                            </dl>
                        </section>

                        <UserReadingStats user={profile} />
                    </div>
                </div>}
        </main>
    );
}
