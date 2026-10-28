import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { getNotificationSettings, getShulUsers, updateNotificationSettings } from '../api.ts';
import type { NotificationSettings as Settings, ShulUser } from '../api.ts';
import { LoadingSkeleton } from './loadingSkeleton.tsx';

export default function NotificationSettings({ shulId }: { shulId: string }) {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [admins, setAdmins] = useState<ShulUser[]>([]);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setError('');
        Promise.all([getNotificationSettings(shulId, controller.signal), getShulUsers(shulId, controller.signal)])
            .then(([result, users]) => { if (!controller.signal.aborted) { setSettings(result); setAdmins(users.filter(user => user.role === 'admin')); } })
            .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to load notification settings.'); });
        return () => controller.abort();
    }, [shulId, attempt]);
    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!settings || busy) return;
        setBusy(true); setError(''); setNotice('');
        try { setSettings(await updateNotificationSettings(shulId, settings)); setNotice('Notification settings saved.'); }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save.'); }
        finally { setBusy(false); }
    }
    return <section className="settings-panel notification-settings" aria-labelledby="notification-settings-heading">
        <h2 id="notification-settings-heading">Notifications and email</h2>
        <p>Every current admin receives a daily system inbox roundup at 4 PM in the timezone below, with registrations and a compact vacancy list for the next three months. The roundup is also queued for email when email is available.</p>
        {error && <p role="alert">{error} {!settings && <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button>}</p>}
        {!settings ? !error && <LoadingSkeleton variant="users" /> : <form onSubmit={save}>
            <label htmlFor="notification-timezone">Shul timezone</label>
            <input id="notification-timezone" list="notification-timezones" required disabled={busy} value={settings.timezone} onChange={event => setSettings({ ...settings, timezone: event.target.value })} placeholder="America/New_York" />
            <datalist id="notification-timezones">{['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Asia/Jerusalem', 'Australia/Sydney', 'UTC'].map(zone => <option value={zone} key={zone} />)}</datalist>
            <label htmlFor="instant-registration-admin">Instant registration notifications</label>
            <select id="instant-registration-admin" disabled={busy} value={settings.instantAdminUserId ?? ''} onChange={event => setSettings({ ...settings, instantAdminUserId: event.target.value || null })}>
                <option value="">No instant notification admin</option>
                {settings.instantAdminUserId && !admins.some(admin => admin.id === settings.instantAdminUserId) && <option value={settings.instantAdminUserId}>Previously selected admin (no longer eligible)</option>}
                {admins.map(admin => <option key={admin.id} value={admin.id}>{admin.firstName} {admin.lastName}</option>)}
            </select>
            <p>Choose one admin to receive a system inbox message for every new registration and, when available, an email. Only the selected admin receives these instant alerts.</p>
            <p>All confirmation, instant-alert, and roundup emails share 100 emails across the entire app per UTC day. Email stops once that cap is reached; platform inbox messages continue. Member confirmation requests are limited to 5 per shul-local day; guests to 1 per email address per shul-local day.</p>
            <div className="settings-form-footer"><span role="status">{notice}</span><button className="submit-btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save notification settings'}</button></div>
        </form>}
    </section>;
}
