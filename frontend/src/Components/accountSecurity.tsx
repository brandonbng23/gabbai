import { useEffect, useState } from 'react';
import type { SubmitEvent } from 'react';
import { LoadingSkeleton } from './loadingSkeleton.tsx';
import { DismissMessageButton } from './dismissMessageButton.tsx';

export function AccountSecurity() {
    const [configured, setConfigured] = useState<boolean | null>(null);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/auth/password', { signal: controller.signal }).then(async response => {
            if (!response.ok) throw new Error('Unable to load password settings. Refresh to try again.');
            const status = await response.json();
            if (!controller.signal.aborted) setConfigured(status.configured);
        }).catch(error => {
            if (!controller.signal.aborted) setFeedback({ error: true, text: error.message });
        });
        return () => controller.abort();
    }, []);
    async function save(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;
        const form = event.currentTarget;
        const values = new FormData(form);
        const password = String(values.get('password') ?? '');
        if (password !== values.get('confirmPassword')) { setFeedback({ error: true, text: 'Your passwords don’t match.' }); return; }
        setSaving(true);
        setFeedback(null);
        try {
            const response = await fetch('/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, ...(configured ? { currentPassword: values.get('currentPassword') } : {}) }) });
            if (!response.ok) {
                const failure = await response.json().catch(() => null);
                throw new Error(failure?.error || 'Unable to save your password.');
            }
            form.reset();
            setConfigured(true);
            setFeedback({ error: false, text: 'Your password has been saved. Other sessions have been signed out.' });
        } catch (error) { setFeedback({ error: true, text: error instanceof Error ? error.message : 'Unable to save your password.' }); }
        finally { setSaving(false); }
    }
    return <section className="settings-panel" aria-labelledby="account-security-heading">
        <div className="settings-section-header"><div><h2 id="account-security-heading">Sign-in &amp; Security</h2>
            <p>{configured ? 'Update the password you use to sign in.' : 'Set a password to sign in to your existing profile with your email.'}</p></div></div>
        {configured === null ? feedback ? <p role="alert">{feedback.text}</p> : <LoadingSkeleton variant="readings" />
            : <form onSubmit={save}>
                <fieldset className="shul-edit" disabled={saving}>
                    <legend className="visually-hidden">Password settings</legend>
                    <div className="account-password-fields">
                        {configured && <div className="settings-field-edit"><label htmlFor="account-current-password">Current password</label>
                            <input id="account-current-password" name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} /></div>}
                        <div className="settings-field-edit"><label htmlFor="account-new-password">New password</label>
                            <input id="account-new-password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} aria-describedby="account-password-hint" /></div>
                        <div className="settings-field-edit"><label htmlFor="account-confirm-password">Confirm password</label>
                            <input id="account-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></div>
                    </div>
                    <div className="account-password-footer"><span id="account-password-hint">Use 12–128 characters.</span>
                        <button type="submit" className="submit-btn">{saving ? 'Saving…' : configured ? 'Change password' : 'Set password'}</button></div>
                </fieldset>
                {feedback && <div className={`submission-msg submission-msg-${feedback.error ? 'error' : 'success'}`} role={feedback.error ? 'alert' : 'status'}>
                    <span>{feedback.text}</span><DismissMessageButton onDismiss={() => setFeedback(null)} /></div>}
            </form>}
    </section>;
}
