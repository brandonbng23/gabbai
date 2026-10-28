import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { getNotificationSettings, getShulUsers, updateNotificationSettings } from '../api.ts';
import type { NotificationSettings as Settings, ShulUser } from '../api.ts';
import { LoadingSkeleton } from './loadingSkeleton.tsx';
import { northAmericanTimezoneGroups, timezoneLabel } from '../northAmericanTimezones.ts';

const summaryWindows = [
    { value: '2weeks', label: '2 weeks' },
    { value: '4weeks', label: '4 weeks' },
    { value: '6weeks', label: '6 weeks' },
    { value: '8weeks', label: '8 weeks' },
    { value: '10weeks', label: '10 weeks' },
    { value: '12weeks', label: '12 weeks (about 3 months)' },
] as const;

export default function NotificationSettings({ shulId }: { shulId: string }) {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [savedSettings, setSavedSettings] = useState<Settings | null>(null);
    const [admins, setAdmins] = useState<ShulUser[]>([]);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setError('');
        setSettings(null);
        setSavedSettings(null);
        setNotice('');
        Promise.all([getNotificationSettings(shulId, controller.signal), getShulUsers(shulId, controller.signal)])
            .then(([result, users]) => { if (!controller.signal.aborted) { setSettings(result); setSavedSettings(result); setAdmins(users.filter(user => user.role === 'admin')); } })
            .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to load notification settings.'); });
        return () => controller.abort();
    }, [shulId, attempt]);
    const changes: string[] = [];
    const adminName = (id: string | null) => {
        const admin = admins.find(user => user.id === id);
        return admin ? `${admin.firstName} ${admin.lastName}` : id ? 'Previously selected admin' : 'Off';
    };
    const frequencies = { daily: 'Daily', mon_thu: 'Monday & Thursday', mon_wed_fri: 'Monday, Wednesday & Friday' };
    if (settings && savedSettings) {
        if (settings.timezone !== savedSettings.timezone) changes.push(`Shul timezone: ${timezoneLabel(savedSettings.timezone)} → ${timezoneLabel(settings.timezone)}`);
        if (settings.reportTime !== savedSettings.reportTime) changes.push(`Summary send time: ${savedSettings.reportTime} → ${settings.reportTime}`);
        if (settings.reportFrequency !== savedSettings.reportFrequency) changes.push(`Summary frequency: ${frequencies[savedSettings.reportFrequency]} → ${frequencies[settings.reportFrequency]}`);
        if (settings.reportRange !== savedSettings.reportRange) changes.push(`Look ahead: ${summaryWindows.find(window => window.value === savedSettings.reportRange)?.label} → ${summaryWindows.find(window => window.value === settings.reportRange)?.label}`);
        for (const admin of admins) {
            const wasEnabled = savedSettings.dailyReports.find(preference => preference.userId === admin.id)?.enabled ?? true;
            const enabled = settings.dailyReports.find(preference => preference.userId === admin.id)?.enabled ?? true;
            if (enabled !== wasEnabled) changes.push(`Summaries for ${adminName(admin.id)}: ${wasEnabled ? 'On' : 'Off'} → ${enabled ? 'On' : 'Off'}`);
        }
        if (settings.instantAdminUserId !== savedSettings.instantAdminUserId) changes.push(`Instant alerts: ${adminName(savedSettings.instantAdminUserId)} → ${adminName(settings.instantAdminUserId)}`);
    }
    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!settings || busy || changes.length === 0) return;
        setBusy(true); setError(''); setNotice('');
        try {
            const result = await updateNotificationSettings(shulId, settings);
            setSettings(result);
            setSavedSettings(result);
            setNotice('Communication settings saved.');
        }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save.'); }
        finally { setBusy(false); }
    }
    return <section className="settings-panel notification-settings" aria-labelledby="notification-settings-heading">
        <h2 id="notification-settings-heading">Communication Settings</h2>
        <p>Manage registration summaries and new-booking alerts for your admins.</p>
        {error && <p role="alert">{error} {!settings && <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button>}</p>}
        {!settings ? !error && <LoadingSkeleton variant="users" /> : <form onSubmit={save}>
            <section className="notification-section" aria-labelledby="registration-reports-heading">
                <h3 id="registration-reports-heading">Registration Summaries</h3>
                <p>A scheduled summary of upcoming readings: who is registered for each aliyah and which slots still need a reader.</p>
                <div className="notification-report-fields">

                <div className="notification-field">
            <label htmlFor="notification-report-time">Delivery time</label>
            <input id="notification-report-time" type="time" required disabled={busy} value={settings.reportTime} onChange={event => setSettings({ ...settings, reportTime: event.target.value })} aria-describedby="notification-time-help" />
            <span className="notification-field-help" id="notification-time-help">Choose a time before sundown.</span>
                </div>

                <div className="notification-field">
            <label htmlFor="notification-timezone">Shul timezone</label>
            <select id="notification-timezone" required disabled={busy} value={settings.timezone} onChange={event => setSettings({ ...settings, timezone: event.target.value })}>
                {!northAmericanTimezoneGroups.some(group => group.zones.some(zone => zone.value === settings.timezone)) && <option value={settings.timezone}>{timezoneLabel(settings.timezone)} (current)</option>}
                {northAmericanTimezoneGroups.map(group => <optgroup key={group.label} label={group.label}>
                    {group.zones.map(zone => <option key={zone.value} value={zone.value}>{zone.label}</option>)}
                </optgroup>)}
            </select>
                </div>
                
                <div className="notification-field">
            <label htmlFor="notification-report-frequency">Frequencey</label>
            <select id="notification-report-frequency" disabled={busy} value={settings.reportFrequency} onChange={event => setSettings({ ...settings, reportFrequency: event.target.value as Settings['reportFrequency'] })}>
                <option value="daily">Daily</option>
                <option value="mon_thu">Monday &amp; Thursday (M/R)</option>
                <option value="mon_wed_fri">Monday, Wednesday &amp; Friday (M/W/F)</option>
            </select>
                </div>
                <div className="notification-field">
            <div className="notification-range-heading">
                <label htmlFor="notification-report-range">Summary Window</label>
                <output htmlFor="notification-report-range">{summaryWindows.find(window => window.value === settings.reportRange)?.label}</output>
            </div>
            <div className="slide-container notification-slider">
            <input id="notification-report-range" className="slider" type="range" min={0} max={5} step={1} disabled={busy}
                value={summaryWindows.findIndex(window => window.value === settings.reportRange)}
                aria-valuetext={summaryWindows.find(window => window.value === settings.reportRange)?.label}
                onChange={event => setSettings({ ...settings, reportRange: summaryWindows[Number(event.target.value)].value })} />
            <div className="slider-labels notification-range-labels" aria-hidden="true">
                {summaryWindows.map((window, index) => <span className="slider-tick" key={window.value}><span>{(index + 1) * 2} wk</span></span>)}
            </div>
            </div>
                </div>
                </div>
            <fieldset className="notification-admin-switches" disabled={busy}>
                <legend>Send summaries to</legend>
                <p>Selected admins receive each summary in their platform inbox and by email when available.</p>
                {admins.map(admin => {
                    const enabled = settings.dailyReports.find(preference => preference.userId === admin.id)?.enabled ?? true;
                    return <div className="notification-admin-row" key={admin.id}>
                        <span id={`daily-report-admin-${admin.id}`}>{admin.firstName} {admin.lastName}</span>
                        <button type="button" className="notification-toggle" role="switch" aria-checked={enabled}
                            aria-labelledby={`daily-report-admin-${admin.id} daily-report-switch-label`}
                            onClick={() => setSettings({ ...settings, dailyReports: [
                                ...settings.dailyReports.filter(preference => preference.userId !== admin.id), { userId: admin.id, enabled: !enabled },
                            ] })}>
                            <span>{enabled ? 'On' : 'Off'}</span><span className="notification-toggle-track" aria-hidden="true" />
                        </button>
                    </div>;
                })}
                <span id="daily-report-switch-label" className="visually-hidden">registration summaries</span>
            </fieldset>
            </section>
            <section className="notification-section" aria-labelledby="instant-alerts-heading">
                <h3 id="instant-alerts-heading">Instant Registration Alerts</h3>
                <p>Notify one admin whenever someone registers for a reading.</p>
                <div className="notification-field">
            <label htmlFor="instant-registration-admin">Notify</label>
            <select id="instant-registration-admin" disabled={busy} value={settings.instantAdminUserId ?? ''} onChange={event => setSettings({ ...settings, instantAdminUserId: event.target.value || null })}>
                <option value="">Off — no instant alerts</option>
                {settings.instantAdminUserId && !admins.some(admin => admin.id === settings.instantAdminUserId) && <option value={settings.instantAdminUserId}>Previously selected admin (no longer eligible)</option>}
                {admins.map(admin => <option key={admin.id} value={admin.id}>{admin.firstName} {admin.lastName}</option>)}
            </select>
                </div>
                <p className="notification-field-help">Alerts appear in the selected admin’s platform inbox and are also emailed when available. Summary switches above do not affect these alerts.<br></br>Your congregation's service leader or most-frequent Torah reader may benefit from these notification.</p>
            </section>
            <div className="notification-delivery-note">
                <h3>Email delivery limits</h3>
                <p>All email types share a limit of 100 emails per day across Gabbai, resetting at midnight UTC. Summaries and alerts still arrive in platform inboxes when email is unavailable or the limit is reached.</p>
            </div>
            <div className="settings-form-footer">
                <div className="change-log">
                    <h5>Section Change Log</h5>
                    {changes.length > 0 ? <ul>{changes.map(change => <li key={change}>{change}</li>)}</ul> : 'Your changes will be summarized here.'}
                </div>
                <div className="settings-footer-actions">
                    <span>Changes take effect after saving.</span>
                    <div className="settings-footer-buttons">
                        <button className="settings-reset-btn" type="button" disabled={busy || changes.length === 0} onClick={() => {
                            setSettings(savedSettings);
                            setError('');
                            setNotice('');
                        }}>Reset changes</button>
                        <button className="submit-btn" type="submit" disabled={busy || changes.length === 0}>{busy ? 'Saving…' : 'Save Changes'}</button>
                    </div>
                    <span role="status">{changes.length === 0 ? notice : ''}</span>
                </div>
            </div>
        </form>}
    </section>;
}
