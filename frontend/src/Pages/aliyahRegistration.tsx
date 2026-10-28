import { useEffect, useState } from 'react';
import type { SubmitEvent } from 'react';
import { userTitles } from '../../../interfaces/titles.mts';
import { getNotificationPolicy, registerForReading } from '../api.js';
import type { GuestRegistration, User, NotificationPolicy } from '../api.js';
import type { ParshaObj } from '../Components/parsha.tsx';
import InfoIcon from '../Components/infoTip.tsx';
import { LoadingSkeleton } from '../Components/loadingSkeleton.tsx';
import { ProfilePicture } from '../Components/profilePicture.tsx';

interface RegistrationProps {
    shulId?: string;
    schedule: ParshaObj[];
    loading: boolean;
    error: string | null;
    user: User | null;
}

const aliyahLabels = ['Rishon', 'Sheni', 'Shlishi', "Revi'i", 'Chamishi', 'Shishi', "Shvi'i", 'Maftir', 'Haftarah'];
const englishLabels = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh'];

export default function AliyahRegistration({ shulId, schedule, loading, error, user }: RegistrationProps) {
    const [mode, setMode] = useState<'profile' | 'guest'>('profile');
    const [submitting, setSubmitting] = useState(false);
    const [registered, setRegistered] = useState(false);
    const [registrationError, setRegistrationError] = useState('');
    const [emailConfirmation, setEmailConfirmation] = useState(false);
    const [emailNotice, setEmailNotice] = useState('');
    const [emailPolicy, setEmailPolicy] = useState<NotificationPolicy | null>(null);
    const [policyError, setPolicyError] = useState('');
    const useProfile = mode === 'profile' && Boolean(user);
    const backUrl = shulId ? `/schedule?${new URLSearchParams({ shul: shulId })}` : '/schedule';

    const params = new URLSearchParams(window.location.search);
    const parshaId = Number(params.get('parsha'));
    const aliyah = Number(params.get('aliyah'));
    const parsha = schedule.find(reading => {
        if (params.has('date') && params.has('desc')) {
            return reading.dateString === params.get('date') && reading.desc === params.get('desc');
        }
        return params.has('parsha') && Number.isInteger(parshaId) && reading.id === parshaId;
    });
    const validSelection = parsha && Number.isInteger(aliyah) && aliyah >= 1 && aliyah <= aliyahLabels.length
        && Boolean(parsha.psukim[aliyah - 1]) && parsha.psukim[aliyah - 1] !== 'null';
    const locked = Boolean(parsha?.locked || parsha?.lockedArr[aliyah - 1]);
    const unavailable = Boolean(parsha?.readers[aliyah - 1]);
    const canRegister = Boolean(validSelection && shulId && !locked && !unavailable && !loading && !error);

    useEffect(() => {
        if (!shulId) return;
        const controller = new AbortController();
        getNotificationPolicy(shulId, controller.signal)
            .then(policy => { if (!controller.signal.aborted) { setEmailPolicy(policy); setPolicyError(''); } })
            .catch(() => { if (!controller.signal.aborted) setPolicyError('Email availability could not be checked. You can still register and receive an inbox confirmation.'); });
        return () => controller.abort();
    }, [shulId]);

    useEffect(() => {
        const previousTitle = document.title;
        document.title = 'Aliyah registration | Gabbai';
        return () => { document.title = previousTitle; };
    }, []);

    function selectMode(next: 'profile' | 'guest'): void {
        if (submitting) return;
        setMode(next);
        setRegistrationError('');
    }

    async function confirmRegistration(details?: GuestRegistration): Promise<void> {
        if (submitting || !canRegister || !parsha || !shulId) return;
        setSubmitting(true);
        setRegistrationError('');
        try {
            const result = await registerForReading(shulId, parsha, aliyah, details, emailConfirmation);
            const status = result.emailConfirmation?.status;
            setEmailNotice(status === 'queued' ? 'Confirmation email requested. Delivery is subject to the app-wide daily limit.'
                : status === 'daily_limit' ? 'Your daily confirmation email limit has been reached. Your registration and inbox confirmation are saved.'
                : status === 'unavailable' ? 'Email is currently unavailable. Your registration and inbox confirmation are saved.'
                : 'Your system confirmation has been saved to the platform inbox.');
            setRegistered(true);
        } catch (failure) {
            setRegistrationError(failure instanceof Error ? failure.message : 'Unable to register. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    function submitRegistration(event: SubmitEvent<HTMLFormElement>): void {
        event.preventDefault();
        if (useProfile) {
            void confirmRegistration();
            return;
        }
        const form = new FormData(event.currentTarget);
        const value = (name: string) => String(form.get(name) ?? '').trim();
        const title = userTitles.find(item => item === value('titleRegister'));
        if (!title) {
            setRegistrationError('Choose a title from the list.');
            return;
        }
        void confirmRegistration({
            title,
            firstName: value('firstNameRegister'),
            lastName: value('lastNameRegister'),
            hebrewName: value('hebrewNameRegister'),
            email: value('emailRegister'),
        });
    }

    let heading = `Register for ${parsha?.desc ?? 'a reading'}`;
    if (loading) heading = 'Aliyah Registration';
    else if (!validSelection) heading = 'Oy Gevalt!';
    else if (locked || unavailable) heading = 'Registration is closed';
    if (registered) heading = 'Registration confirmed';

    return (
        <main className="aliyah-registration registration-page">
            <a className="registration-back" href={backUrl}>← Back to schedule</a>
            <header className="registration-header">
                <span className="registration-eyebrow">Aliyah registration</span>
                <h1>{heading}</h1>
                {canRegister && !registered && <p>Review your reading and choose how you’d like to register.</p>}
            </header>
            {registrationError && <p role="alert">{registrationError}</p>}
            {registered ? (
                <section className="registration-details registration-success" aria-label="Registration complete">
                    <p role="status">You’re registered for {aliyahLabels[aliyah - 1]} of {parsha?.desc} on {parsha?.gregDate}.</p>
                    <p>{emailNotice}</p>
                    <a className="registration-back" href={backUrl}>← Return to schedule</a>
                </section>
            ) : loading ? (
                <LoadingSkeleton variant="registration" />
            ) : error ? (
                <p role="alert">{error}</p>
            ) : !validSelection || !parsha ? (
                <p role="alert">This reading could not be found. Choose another aliyah from the schedule.</p>
            ) : (
                <>
                    {canRegister && <div className="register-identity">
                        <div className={`register-switch${useProfile ? '' : ' register-switch-guest'}`}>
                            <div className="register-switch-options" role="group" aria-label="Registration method">
                                <button type="button" disabled={submitting || !user} aria-pressed={useProfile}
                                    className={`register-option${useProfile ? ' register-option-focus' : ''}`}
                                    onClick={() => selectMode('profile')}>Register with Profile</button>
                                <button type="button" disabled={submitting} aria-pressed={!useProfile}
                                    className={`register-option${useProfile ? '' : ' register-option-focus'}`}
                                    onClick={() => selectMode('guest')}>Register as Guest</button>
                            </div>
                        </div>
                        <div className="register-switch-info">
                            Use your Gabbai profile to register with your saved details, or register as a guest.
                        </div>
                    </div>}
                    <section className="registration-details" aria-labelledby="aliyah-summary-heading">
                        <h2 id="aliyah-summary-heading">Your reading</h2>
                        <dl>
                            <div><dt>Date</dt><dd>{parsha.gregDate}<span className="registration-hebrew-date">{parsha.hDate}</span></dd></div>
                            <div><dt>Parsha</dt><dd>{parsha.desc}</dd></div>
                            <div><dt>Aliyah</dt><dd>
                                <span className="registration-aliyah-label">{aliyahLabels[aliyah - 1]}</span>
                                {englishLabels[aliyah - 1] && <InfoIcon message={englishLabels[aliyah - 1]} />}
                            </dd></div>
                            <div><dt>Psukim</dt><dd>{parsha.psukim[aliyah - 1]}</dd></div>
                        </dl>
                    </section>
                    <form id="guest-registration" onSubmit={submitRegistration} aria-busy={submitting}>
                        {canRegister && useProfile && user && (
                            <section className="registration-details" aria-labelledby="profile-heading">
                                <h2 id="profile-heading">Registering as</h2>
                                <div className="registration-profile">
                                    <ProfilePicture src={user.pictureUrl} name={`${user.firstName} ${user.lastName}`} small />
                                    <div>
                                        <strong>{[user.title, user.firstName, user.lastName].filter(Boolean).join(' ')}</strong>
                                        <span>{user.email}</span>
                                    </div>
                                </div>
                            </section>
                        )}
                        {canRegister && !useProfile && <section className="registration-details" aria-labelledby="guest-heading">
                            <h2 id="guest-heading">Guest details</h2>
                            <fieldset className="guest-registration-fields" disabled={submitting}>
                                <legend className="visually-hidden">Guest details</legend>
                                <div className="registration-names">
                                    <div className="registration-item">
                                        <label className="registration-label" htmlFor="guest-title">Title</label>
                                        <select id="guest-title" name="titleRegister" required defaultValue="">
                                            <option value="" disabled>Select</option>
                                            {userTitles.map(title => <option key={title} value={title}>{title}</option>)}
                                        </select>
                                    </div>
                                    <div className="registration-item">
                                        <label className="registration-label" htmlFor="guest-first-name">First Name</label>
                                        <input id="guest-first-name" type="text" name="firstNameRegister" required maxLength={254}
                                            autoComplete="given-name" placeholder="e.g. Josh" />
                                    </div>
                                    <div className="registration-item">
                                        <label className="registration-label" htmlFor="guest-last-name">Last Name</label>
                                        <input id="guest-last-name" type="text" name="lastNameRegister" required maxLength={254}
                                            autoComplete="family-name" placeholder="e.g. Cohen" />
                                    </div>
                                </div>
                                <div className="registration-item">
                                    <label className="registration-label" htmlFor="guest-hebrew-name">Hebrew Name <span className="registration-optional">(optional)</span></label>
                                    <input id="guest-hebrew-name" type="text" name="hebrewNameRegister" maxLength={254}
                                        placeholder="e.g. Moishe ben Shlomo v'et Devorah" />
                                </div>
                                <div className="registration-item">
                                    <label className="registration-label" htmlFor="guest-email">Email</label>
                                    <input id="guest-email" type="email" name="emailRegister" required maxLength={254}
                                        autoComplete="email" placeholder="e.g. josh@example.com" />
                                </div>
                            </fieldset>
                        </section>}
                        <section className="registration-email-options" aria-labelledby="confirmation-email-heading">
                            <h3 id="confirmation-email-heading">Confirmation</h3>
                            <div className="settings-check-options"><label>
                                <input type="checkbox" checked={emailConfirmation} disabled={submitting || !canRegister || !emailPolicy?.emailAvailable}
                                    onChange={event => setEmailConfirmation(event.target.checked)} aria-describedby="confirmation-email-rules" />
                                Email me a registration confirmation
                            </label></div>
                            <p id="confirmation-email-rules">You are limited to {user && ['member', 'admin'].includes(user.role)
                                ? emailPolicy?.memberDailyLimit ?? 5
                                : emailPolicy?.guestDailyLimit ?? 1} confirmation {user && ['member', 'admin'].includes(user.role) ? 'emails' : 'email'} per day.</p>
                            {policyError ? <p role="status">{policyError}</p> : emailPolicy && !emailPolicy.emailAvailable && <p>Email is currently unavailable. Registration and inbox confirmations still work.</p>}
                        </section>
                        <div className="registration-actions">
                          <p id="registration-status" role="status">
                            {locked ? 'Your shul has locked this aliyah. Choose another aliyah from the schedule.'
                                : unavailable ? 'Another reader has already registered for this reading. Choose another aliyah from the schedule.'
                                : submitting ? 'Registering…'
                                : useProfile ? 'Register using your saved profile details.'
                                : 'Confirm your details to reserve this aliyah.'}
                          </p>
                          {canRegister && <button type="submit" className="registration-confirm" disabled={submitting}
                            aria-describedby="registration-status">{submitting ? 'Registering…' : 'Confirm registration'}</button>}
                        </div>
                    </form>
                </>
            )}
        </main>
    );
}
