import { DismissMessageButton } from '../Components/dismissMessageButton.tsx';
import { PictureEditor, ProfilePicture } from '../Components/profilePicture.tsx';
import type { Shul, ShulInfo, Settings, ShulUser } from '../api.js';
import searchIcon from '../Assets/magnifying-glass-solid-full-white.svg';
import type { ParshaObj } from '../Components/parsha.tsx';
import type { Yontifs } from "../../../interfaces/yontifs.mts"
import { getShulUsers, getInitialShulVersion, publishReadingLocks, updateShul, updateShulSettings } from '../api.js';
import { useEffect, useState } from "react";
import type { SubmitEvent } from "react";
import { SearchResult } from "../Components/searchResults.tsx";
import { occasionChangeLog, pendingReadingCounts, stageReadingCount, pendingReadingLocks, pendingReadingOccasions, previewReadingLocks, readingKey, stageReadingLock, stageReadingOccasions, stageReadingReader, pendingReadingReaders } from '../readingAdjustments.ts';
import type { CountDrafts, ReadingDrafts, OccasionDrafts, ReaderDrafts } from '../readingAdjustments.ts';
import { UserCard } from "../Components/userCard.tsx";
import { LoadingSkeleton } from '../Components/loadingSkeleton.tsx';
import InfoIcon  from "../Components/infoTip.tsx"

type SettingsSection = 'info' | 'schedule' | 'readings';
type SubmissionFeedback = { tone: 'progress' | 'success' | 'error' | 'info'; text: string };

function SubmissionMessage({ message, onDismiss }: { message: SubmissionFeedback | null; onDismiss?: () => void }) {
    return (
        <div className={`submission-msg${message ? ` submission-msg-${message.tone}` : ''}`}
            role={message?.tone === 'error' ? 'alert' : 'status'} aria-atomic="true">
            {message && <>
                <span>{message.text}</span>
                {message.tone !== 'progress' && onDismiss && <DismissMessageButton onDismiss={onDismiss} />}
            </>}
        </div>
    );
}

function SettingsNoResults() {
    return (
        <div className="settings-no-results" role="status">
            <h3>Oy Gevalt!</h3>
            <p>No Results. Try a Different Search Phrase</p>
        </div>
    );
}

function FieldReset({ label, changed, onReset }: { label: string; changed: boolean; onReset: () => void }) {
    return (
        <div className="settings-field-reset-row">
            <button type="button" className="settings-field-reset" tabIndex={-1} disabled={!changed}
                aria-label={`Reset ${label} to its last saved value`} title="Reset to last saved value" onClick={onReset}>Reset</button>
        </div>
    );
}

function RestoreMenu({ section, disabled, onRestore }: { section: string; disabled: boolean; onRestore: () => void }) {
    return (
        <details className="settings-restore-menu" onKeyDown={(event) => {
            if (event.key === 'Escape') {
                event.currentTarget.open = false;
                event.currentTarget.querySelector('summary')?.focus();
            }
        }}>
            <summary aria-label={`${section} actions`} aria-disabled={disabled}
                onClick={(event) => { if (disabled) event.preventDefault(); }}>
                <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
            </summary>
            <div className="settings-restore-popover">
                <button type="button" disabled={disabled} onClick={(event) => {
                    event.currentTarget.closest('details')?.removeAttribute('open');
                    onRestore();
                }}>Restore first saved version</button>
                <span>Review the changes, then save to apply.</span>
            </div>
        </details>
    );
}

export default function ShulSettings({ shul, onSaved, schedule, scheduleLoading = false, scheduleError = null, onReadingUpdated }: {
    shul: Shul;
    onSaved: (shul: Shul) => void;
    schedule: ParshaObj[];
    scheduleLoading?: boolean;
    scheduleError?: string | null;
    onReadingUpdated: (reading: ParshaObj) => void;
}): React.JSX.Element {
    const settings = shul.settings;
    

    const [restoring, setRestoring] = useState<'info' | 'schedule' | null>(null);
    const [messages, setMessages] = useState<Record<SettingsSection, SubmissionFeedback | null>>({ info: null, schedule: null, readings: null });

    const [readingDrafts, setReadingDrafts] = useState<ReadingDrafts>({});
    const [countDrafts, setCountDrafts] = useState<CountDrafts>({});
    const [occasionDrafts, setOccasionDrafts] = useState<OccasionDrafts>({});
    const [readerDrafts, setReaderDrafts] = useState<ReaderDrafts>({});
    const [users, setUsers] = useState<ShulUser[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [usersError, setUsersError] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        setUsers([]);
        setUsersLoading(true);
        setUsersError('');
        getShulUsers(shul.id, controller.signal)
            .then(data => { if (!controller.signal.aborted) setUsers(data); })
            .catch(() => { if (!controller.signal.aborted) setUsersError('Unable to load shul users. Please try again.'); })
            .finally(() => { if (!controller.signal.aborted) setUsersLoading(false); });
        return () => controller.abort();
    }, [shul.id]);

    const members = users.filter(user => user.role === 'member');
    const admins = users.filter(user => user.role === 'admin');
    const [userSort, setUserSort] = useState<'name' | 'email' | 'role'>("name");
    const [nameSortClicks, setNameSortClicks] = useState<number>(0);
    const [emailSortClicks, setEmailSortClicks] = useState<number>(0);
    const [roleSortClicks, setRoleSortClicks] = useState<number>(0);
    const [userSearch, setUserSearch] = useState<string>("");
    const [nameClick, setNameClick] = useState<boolean>(false);

    function searchUsers(usersToSort: ShulUser[]): ShulUser[] {
        return usersToSort.filter((u: ShulUser) => `${u.firstName} ${u.lastName}`.toLowerCase().includes(userSearch.trim().toLowerCase()))
    }

    function sortUsers(): ShulUser[] {
        if (userSort === "name") {
            if (nameSortClicks % 2 === 1) {
                return users.sort((a, b) => b.lastName.localeCompare(a.lastName));
            } 
        } else if (userSort === "email") {
            if (emailSortClicks % 2 === 0) {
                return users.sort((a, b) => a.email.localeCompare(b.email));
            } else {
                return users.sort((a, b) => b.email.localeCompare(a.email));
            }
        } else if (userSort === "role") {
            if (roleSortClicks % 3 === 0) {
                return [
                    ...users.filter((u: ShulUser) => u.role === "admin"),
                    ...users.filter((u: ShulUser) => u.role === "member"),
                    ...users.filter((u: ShulUser) => u.role === "guest")
                ]
            } else if (roleSortClicks % 3 === 1){
                return [
                    ...users.filter((u: ShulUser) => u.role === "guest"),
                    ...users.filter((u: ShulUser) => u.role === "admin"),
                    ...users.filter((u: ShulUser) => u.role === "member")
                ]
            } else {
                return [
                    ...users.filter((u: ShulUser) => u.role === "member"),
                    ...users.filter((u: ShulUser) => u.role === "guest"),
                    ...users.filter((u: ShulUser) => u.role === "admin")
                ]
            }
        } 

        return users.sort((a, b) => a.lastName.localeCompare(b.lastName));
    }

    const [name, setName] = useState<string>(shul.name);
    const [address, setAddress] = useState<string>(shul.address);
    const [phone, setPhone] = useState<string>(shul.phone);
    const [email, setEmail] = useState<string>(shul.email);
    const [website, setWebsite] = useState<string>(shul.websiteUrl);
    const [donation, setDonation] = useState<string>(shul.donationUrl);
    const [saving, setSaving] = useState(false);
    const [pictureBusy, setPictureBusy] = useState(false);
    const [pictureDraft, setPictureDraft] = useState<string | null | undefined>();
    const picturePreview = pictureDraft === undefined ? shul.pictureUrl : pictureDraft ?? undefined;
    const [activeForm, setActiveForm] = useState<SettingsSection>('info');

    const [hebYear, setHebYear] = useState(settings.hebYear);
    const [a, setA] = useState<number>(settings.a);
    const [il, setIl] = useState<boolean>(settings.il);
    const [hhRespect, setHhRespect] = useState<boolean>(settings.hhRespect);
    const [yRespect, setYRespect] = useState<boolean>(settings.yRespect);
    const [yontifs, setYontifs] = useState<Yontifs>(settings.yontifs);
    const [specialSeventh, setSpecialSeventh] = useState<boolean>(settings.specialSeventh);
    const [tri, setTri] = useState<boolean>(settings.triennial.tri);
    const [triMaftir, setTriMaftir] = useState<boolean>(settings.triennial.triMaftir);
    const [tradMaftir, setTradMaftir] = useState<boolean>(settings.triennial.tradMaftir);
    const [yitro, setYitro] = useState<boolean>(settings.triennial.yitro);
    const [vaetchanan, setVaetchanan] = useState<boolean>(settings.triennial.vaetchanan);
        
    const yontifAbr: (keyof Yontifs)[] = ["rh1", "rh2", "yk", "sukkot1", "sukkot2", "sukkotSA", "sukkotST", "pesach1", "pesach2", "pesach7", "pesach8", "shavuot1", "shavuot2"]
    const yontifNames = ["Rosh Hashana Day I",
                         "Rosh Hashana Day II",
                         "Yom Kippur",
                         "Sukkot Day I",
                         "Sukkot Day II",
                         "Shmini Atzeret",
                         "Simchat Torah",
                         "Pesach Day I",
                         "Pesach Day II",
                         "Pesach Day VII",
                         "Pesach Day VIII",
                         "Shavuot Day I",
                         "Shavuot Day II"];

    const contactFields = [
        { id: 'name', label: 'Shul Name', value: name, savedValue: shul.name, setValue: setName, multiline: true },
        { id: 'address', label: 'Shul Address', value: address, savedValue: shul.address, setValue: setAddress, multiline: true },
        { id: 'phone', label: 'Phone', value: phone, savedValue: shul.phone, setValue: setPhone, type: 'tel' },
        { id: 'email', label: 'Email', value: email, savedValue: shul.email, setValue: setEmail, type: 'email' },
        { id: 'website', label: 'Website URL', value: website, savedValue: shul.websiteUrl, setValue: setWebsite, type: 'url' },
        { id: 'donation', label: 'Donation URL', value: donation, savedValue: shul.donationUrl, setValue: setDonation, type: 'url' },
    ];
    const contactChangeLog = contactFields
        .filter((field) => field.value !== field.savedValue)
        .map((field) => `Changed ${field.label} to ${field.value ? `“${field.value}”` : '(empty)'}.`);

    if (pictureDraft !== undefined) contactChangeLog.push(pictureDraft === null ? 'Remove shul picture.' : 'Change shul picture.');

    const scheduleChanges = [
        { label: 'Schedule Hebrew year', value: hebYear, savedValue: settings.hebYear },
        { label: 'Shabbat aliyot', value: a, savedValue: settings.a },
        { label: 'Calendar', value: il ? 'Israel' : 'Diaspora', savedValue: settings.il ? 'Israel' : 'Diaspora' },
        { label: 'High Holiday aliyot', value: hhRespect ? 'Traditional' : 'Shabbat', savedValue: settings.hhRespect ? 'Traditional' : 'Shabbat' },
        { label: 'Yontif aliyot', value: yRespect ? 'Traditional' : 'Shabbat', savedValue: settings.yRespect ? 'Traditional' : 'Shabbat' },
        { label: 'Special final aliyah', value: specialSeventh, savedValue: settings.specialSeventh },
        { label: 'Triennial schedule', value: tri, savedValue: settings.triennial.tri },
        { label: 'Maftir', value: triMaftir ? 'Triennial' : tradMaftir ? 'Traditional' : 'None', savedValue: settings.triennial.triMaftir ? 'Triennial' : settings.triennial.tradMaftir ? 'Traditional' : 'None' },
        { label: 'Yitro triennial reading', value: yitro, savedValue: settings.triennial.yitro },
        { label: 'Vaetchanan triennial reading', value: vaetchanan, savedValue: settings.triennial.vaetchanan },
        ...yontifAbr.map((abbreviation, index) => ({
            label: `Observe ${yontifNames[index]}`,
            value: yontifs[abbreviation],
            savedValue: settings.yontifs[abbreviation],
        })),
    ];
    const scheduleChangeLog = scheduleChanges
        .filter((field) => field.value !== field.savedValue)
        .map((field) => `Changed ${field.label} to ${typeof field.value === 'boolean' ? (field.value ? 'enabled' : 'disabled') : field.value}.`);

    const countChanges = pendingReadingCounts(countDrafts, schedule);
    const readingChanges = pendingReadingLocks(readingDrafts, schedule);
    const occasionChanges = pendingReadingOccasions(occasionDrafts, schedule);
    const readerChanges = pendingReadingReaders(readerDrafts, schedule);
    const hasReadingChanges = countChanges.length > 0 || readingChanges.length > 0 || occasionChanges.length > 0 || readerChanges.length > 0;
    const hasUnsavedChanges = contactChangeLog.length > 0 || scheduleChangeLog.length > 0 || hasReadingChanges;

    useEffect(() => {
        if (!hasUnsavedChanges) return;
        const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warnBeforeLeaving);
        return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
    }, [hasUnsavedChanges]);

    const aliyahLabels = ["Rishon", "Sheni", "Shlishi", "Revi'i", "Chamishi", "Shishi", "Shvi'i", "Maftir", "Haftarah"];
    const readingDates = new Map(schedule.map(reading => [readingKey(reading), reading.gregDate]));
    const readingAdjustmentChangeLog = readingChanges.map(change =>
        `${change.locked ? 'Lock' : 'Unlock'} ${change.desc} (${readingDates.get(readingKey(change)) ?? change.dateString})${change.aliyah === undefined ? '' : ` — ${aliyahLabels[change.aliyah - 1]}`}.`);

    for (const change of countChanges) {
        readingAdjustmentChangeLog.push(`Set ${change.desc} (${readingDates.get(readingKey(change)) ?? change.dateString}) to ${change.aliyahCount === null ? 'the schedule rule' : `${change.aliyahCount} aliyot`}.`);
    }
    readingAdjustmentChangeLog.push(...occasionChangeLog(occasionDrafts, schedule));

    for (const change of readerChanges) {
        const saved = schedule.find(reading => readingKey(reading) === readingKey(change));
        const previousReader = saved?.readers[change.aliyah - 1];
        const reader = users.find(user => user.id === change.readerId)
            ?? Object.values(readerDrafts).find(draft => readingKey(draft) === readingKey(change) && draft.aliyah === change.aliyah)?.reader;
        const readerName = reader ? [reader.title, reader.firstName, reader.lastName].filter(Boolean).join(' ') : `user ${change.readerId}`;
        const previousName = previousReader
            ? [previousReader.title, previousReader.firstName, previousReader.lastName].filter(Boolean).join(' ')
            : 'the assigned reader';
        const target = `${aliyahLabels[change.aliyah - 1]} of ${change.desc} (${readingDates.get(readingKey(change)) ?? change.dateString})`;
        if (change.readerId === null)
            readingAdjustmentChangeLog.push(`Remove ${previousName} from ${target}.`);
        else if (previousReader)
            readingAdjustmentChangeLog.push(`Replace ${previousName} with ${readerName} for ${target}.`);
        else
            readingAdjustmentChangeLog.push(`Assign ${readerName} to ${target}.`);
    }

    const allYontifsSelected = yontifAbr.every((abbreviation) => yontifs[abbreviation]);

    const [search, setSearch] = useState<string>("");
    const matchingReadings = schedule.filter(reading => reading.searchTerms.some(term =>
        term.toLowerCase().includes(search.trim().toLowerCase())));
    const matchingUsers = searchUsers(sortUsers());


    const busy = saving || pictureBusy || restoring !== null;

    function showFeedback(section: SettingsSection, tone: SubmissionFeedback['tone'], text: string): void {
        setMessages((previous) => ({ ...previous, [section]: { tone, text } }));
    }

    function clearFeedback(section: SettingsSection): void {
        setMessages((previous) => previous[section] ? { ...previous, [section]: null } : previous);
    }

    function changeReadingLock(reading: ParshaObj, locked: boolean, aliyah?: number): void {
        if (busy) return;
        const saved = schedule.find(item => readingKey(item) === readingKey(reading));
        if (!saved) return;
        setReadingDrafts(previous => stageReadingLock(previous, saved, locked, aliyah));
        clearFeedback('readings');
    }

    function changeReadingCount(reading: ParshaObj, count: number | null): void {
        if (busy) return;
        const saved = schedule.find(item => readingKey(item) === readingKey(reading));
        if (!saved) return;
        setCountDrafts(previous => stageReadingCount(previous, saved, count));
        clearFeedback('readings');
    }

    function changeReadingOccasions(reading: ParshaObj, labels: string[]): void {
        if (busy) return;
        const saved = schedule.find(item => readingKey(item) === readingKey(reading));
        if (!saved) return;
        setOccasionDrafts(previous => stageReadingOccasions(previous, saved, labels));
        clearFeedback('readings');
    }

    function changeReadingReader(reading: ParshaObj, aliyah: number, reader: ShulUser | null): void {
        if (busy || reading.locked || reading.lockedArr[aliyah - 1]) return;
        const saved = schedule.find(item => readingKey(item) === readingKey(reading));
        if (!saved) return;
        setReaderDrafts(previous => stageReadingReader(previous, saved, aliyah, reader));
        clearFeedback('readings');
    }

    function resetReadingAdjustments(): void {
        if (busy) return;
        setReadingDrafts({});
        setOccasionDrafts({});
        setReaderDrafts({});
        setCountDrafts({});
        showFeedback('readings', 'info', 'Unsaved reading adjustments reset.');
    }

    async function publishReadingAdjustments(event: SubmitEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (busy || !hasReadingChanges) return;
        setActiveForm('readings');
        setSaving(true);
        showFeedback('readings', 'progress', 'Publishing reading adjustments…');
        try {
            const updated = await publishReadingLocks(shul.id, [...countChanges, ...readingChanges, ...occasionChanges, ...readerChanges]);
            updated.forEach(onReadingUpdated);
            setReadingDrafts({});
            setOccasionDrafts({});
            setReaderDrafts({});
            setCountDrafts({});
            showFeedback('readings', 'success', 'Reading adjustments published.');
        } catch (failure) {
            showFeedback('readings', 'error', failure instanceof Error ? failure.message : 'Could not publish reading adjustments. Your changes are still here.');
        } finally {
            setSaving(false);
        }
    }

    function applyContactValues(values: ShulInfo): void {
        setName(values.name);
        setAddress(values.address);
        setPhone(values.phone);
        setEmail(values.email);
        setWebsite(values.websiteUrl);
        setDonation(values.donationUrl);
    }

    function applyScheduleValues(values: Settings): void {
        setHebYear(values.hebYear);
        setA(values.a);
        setIl(values.il);
        setHhRespect(values.hhRespect);
        setYRespect(values.yRespect);
        setYontifs({ ...values.yontifs });
        setSpecialSeventh(values.specialSeventh);
        setTri(values.triennial.tri);
        setTriMaftir(values.triennial.triMaftir);
        setTradMaftir(values.triennial.tradMaftir);
        setYitro(values.triennial.yitro);
        setVaetchanan(values.triennial.vaetchanan);
    }

    function resetContactChanges(): void {
        setPictureDraft(undefined);
        applyContactValues(shul);
        showFeedback('info', 'info', 'Unsaved changes reset.');
    }

    function resetScheduleChanges(): void {
        applyScheduleValues(settings);
        showFeedback('schedule', 'info', 'Unsaved changes reset.');
    }

    function resetField(action: () => void, section: 'info' | 'schedule' = 'schedule'): void {
        action();
        clearFeedback(section);
    }

    async function restoreFirstVersion(section: 'info' | 'schedule'): Promise<void> {
        if (busy) return;
        showFeedback(section, 'progress', 'Loading first saved version…');
        setActiveForm(section);
        setRestoring(section);
        try {
            const initial = await getInitialShulVersion(shul.id);
            if (section === 'info') applyContactValues(initial.info);
            else applyScheduleValues(initial.settings);
            clearFeedback(section);
        } catch (failure) {
            showFeedback(section, 'error', failure instanceof Error ? failure.message : 'Could not load the first saved version. Please try again.');
        } finally {
            setRestoring(null);
        }
    }

    function updateAliyot(aliyot: number): void {
        if (aliyot < 1) {
            setA(1);
        } else if (aliyot > 7) {
            setA(7);
        } else {
            setA(aliyot);
        }
    }

    function updateMaftir(maftir: string): void {
        if (maftir === "none") {
            setTriMaftir(false);
            setTradMaftir(false);
        } else if (maftir === "tri") {
            setTriMaftir(true);
            setTradMaftir(false);
        } else if (maftir === "trad") {
            setTriMaftir(false);
            setTradMaftir(true);
        }
    }

    function updateTenCommandments(tri: boolean): void {
        setYitro(tri);
        setVaetchanan(tri);
    }

    async function updateShulInfo(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy || contactChangeLog.length === 0) return;
        setActiveForm('info');
        setSaving(true);
        showFeedback('info', 'progress', 'Publishing changes…');
        try {
            const updated = await updateShul(shul.id, {
                name, address, phone, email, websiteUrl: website, donationUrl: donation,
                ...(pictureDraft !== undefined ? { picture: pictureDraft } : {}),
            });
            setPictureDraft(undefined);
            setName(updated.name);
            setAddress(updated.address);
            setPhone(updated.phone);
            setEmail(updated.email);
            setWebsite(updated.websiteUrl);
            setDonation(updated.donationUrl);
            onSaved(updated);
            showFeedback('info', 'success', 'Shul information published.');
        } catch (failure) {
            showFeedback('info', 'error', failure instanceof Error ? failure.message : 'Could not publish changes. Please try again.');
        } finally {
            setSaving(false);
        }
    }

    function ChangeLog({ changes }: { changes: string[] }): React.JSX.Element {
        return (
            <div className="change-log">
                <h5>Section Change Log</h5>
                {changes.length > 0 ? (
                    <ul>{changes.map((change) => <li key={change}>{change}</li>)}</ul>
                ) : "Your changes will be summarized here."}
            </div>
        )
    }

    async function updateShulSchedule(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy || scheduleChangeLog.length === 0) return;
        setActiveForm('schedule');
        setSaving(true);
        showFeedback('schedule', 'progress', 'Saving schedule settings…');
        try {
            const updated = await updateShulSettings(shul.id, {
                hebYear, a, il, hhRespect, yRespect, yontifs, specialSeventh, triennial: {tri, triMaftir, tradMaftir, yitro, vaetchanan}

            });
            setHebYear(updated.settings.hebYear);
            setA(updated.settings.a);
            setIl(updated.settings.il);
            setHhRespect(updated.settings.hhRespect);
            setYRespect(updated.settings.yRespect);
            setYontifs(updated.settings.yontifs);
            setSpecialSeventh(updated.settings.specialSeventh);
            setTri(updated.settings.triennial.tri);
            setTriMaftir(updated.settings.triennial.triMaftir);
            setTradMaftir(updated.settings.triennial.tradMaftir);
            setYitro(updated.settings.triennial.yitro);
            setVaetchanan(updated.settings.triennial.vaetchanan);
            onSaved(updated);
            showFeedback('schedule', 'success', 'Schedule settings saved.');
        } catch (failure) {
            showFeedback('schedule', 'error', failure instanceof Error ? failure.message : 'Could not save schedule settings. Please try again.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="shul-admin-page">
            <header className="settings-page-header">
                <div>
                    <span className="settings-eyebrow">SHUL MANAGEMENT</span>
                    <h1>Administration Settings</h1>
                    <p>Manage your shul’s details and shape your congregation’s reading schedule.</p>
                </div>
                <div className="settings-page-actions">
                    <span className="settings-admin-badge"><span aria-hidden="true" />Administrator access</span>
                </div>
            </header>

            <main className="shul-settings">
                <div className="settings-view">
                    <aside className="shul-card" aria-label="Published shul information">
                        <div className="settings-summary-heading shul-profile-heading">
                            <ProfilePicture src={shul.pictureUrl} name={shul.name} square />
                            <div>
                                <span className="settings-eyebrow">YOUR CONGREGATION</span>
                                <h2>{shul.name}</h2>
                            </div>
                            <span className="settings-published-badge">Published details</span>
                        </div>
                        <div className="settings-contact-grid">
                            <div className="shul-card-item">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="currentColor" d="M128 252.6C128 148.4 214 64 320 64C426 64 512 148.4 512 252.6C512 371.9 391.8 514.9 341.6 569.4C329.8 582.2 310.1 582.2 298.3 569.4C248.1 514.9 127.9 371.9 127.9 252.6zM320 320C355.3 320 384 291.3 384 256C384 220.7 355.3 192 320 192C284.7 192 256 220.7 256 256C256 291.3 284.7 320 320 320z"/></svg>
                                <div><span className="settings-contact-label">Address</span><span>{shul.address || 'Not provided'}</span></div>
                            </div>
                            <div className="shul-card-item">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="currentColor" d="M224.2 89C216.3 70.1 195.7 60.1 176.1 65.4L170.6 66.9C106 84.5 50.8 147.1 66.9 223.3C104 398.3 241.7 536 416.7 573.1C493 589.3 555.5 534 573.1 469.4L574.6 463.9C580 444.2 569.9 423.6 551.1 415.8L453.8 375.3C437.3 368.4 418.2 373.2 406.8 387.1L368.2 434.3C297.9 399.4 241.3 341 208.8 269.3L253 233.3C266.9 222 271.6 202.9 264.8 186.3L224.2 89z"/></svg>
                                <div><span className="settings-contact-label">Phone</span><span>{shul.phone || 'Not provided'}</span></div>
                            </div>
                            <div className="shul-card-item">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="currentColor" d="M320 128C214 128 128 214 128 320C128 426 214 512 320 512C337.7 512 352 526.3 352 544C352 561.7 337.7 576 320 576C178.6 576 64 461.4 64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320L576 352C576 405 533 448 480 448C450.7 448 424.4 434.8 406.8 414.1C384 435.1 353.5 448 320 448C249.3 448 192 390.7 192 320C192 249.3 249.3 192 320 192C347.9 192 373.7 200.9 394.7 216.1C400.4 211.1 407.8 208 416 208C433.7 208 448 222.3 448 240L448 352C448 369.7 462.3 384 480 384C497.7 384 512 369.7 512 352L512 320C512 214 426 128 320 128zM384 320C384 284.7 355.3 256 320 256C284.7 256 256 284.7 256 320C256 355.3 284.7 384 320 384C355.3 384 384 355.3 384 320z"/></svg>
                                <div><span className="settings-contact-label">Email</span><span>{shul.email || 'Not provided'}</span></div>
                            </div>
                            <div className="shul-card-item">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="currentColor" d="M451.5 160C434.9 160 418.8 164.5 404.7 172.7C388.9 156.7 370.5 143.3 350.2 133.2C378.4 109.2 414.3 96 451.5 96C537.9 96 608 166 608 252.5C608 294 591.5 333.8 562.2 363.1L491.1 434.2C461.8 463.5 422 480 380.5 480C294.1 480 224 410 224 323.5C224 322 224 320.5 224.1 319C224.6 301.3 239.3 287.4 257 287.9C274.7 288.4 288.6 303.1 288.1 320.8C288.1 321.7 288.1 322.6 288.1 323.4C288.1 374.5 329.5 415.9 380.6 415.9C405.1 415.9 428.6 406.2 446 388.8L517.1 317.7C534.4 300.4 544.2 276.8 544.2 252.3C544.2 201.2 502.8 159.8 451.7 159.8zM307.2 237.3C305.3 236.5 303.4 235.4 301.7 234.2C289.1 227.7 274.7 224 259.6 224C235.1 224 211.6 233.7 194.2 251.1L123.1 322.2C105.8 339.5 96 363.1 96 387.6C96 438.7 137.4 480.1 188.5 480.1C205 480.1 221.1 475.7 235.2 467.5C251 483.5 269.4 496.9 289.8 507C261.6 530.9 225.8 544.2 188.5 544.2C102.1 544.2 32 474.2 32 387.7C32 346.2 48.5 306.4 77.8 277.1L148.9 206C178.2 176.7 218 160.2 259.5 160.2C346.1 160.2 416 230.8 416 317.1C416 318.4 416 319.7 416 321C415.6 338.7 400.9 352.6 383.2 352.2C365.5 351.8 351.6 337.1 352 319.4C352 318.6 352 317.9 352 317.1C352 283.4 334 253.8 307.2 237.5z"/></svg>
                                <div><span className="settings-contact-label">Website</span><span>{shul.websiteUrl.replace("https://", "") || 'Not provided'}</span></div>
                            </div>
                            <div className="shul-card-item">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="currentColor" d="M305 151.1L320 171.8L335 151.1C360 116.5 400.2 96 442.9 96C516.4 96 576 155.6 576 229.1L576 231.7C576 343.9 436.1 474.2 363.1 529.9C350.7 539.3 335.5 544 320 544C304.5 544 289.2 539.4 276.9 529.9C203.9 474.2 64 343.9 64 231.7L64 229.1C64 155.6 123.6 96 197.1 96C239.8 96 280 116.5 305 151.1z"/></svg>
                                <div><span className="settings-contact-label">Donations</span><span>{shul.donationUrl.replace("https://", "") || 'Not provided'}</span></div>
                            </div>
                            <div className="shul-card-item">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">{/* Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc. */}<path fill="currentColor" d="M280 88C280 57.1 254.9 32 224 32C193.1 32 168 57.1 168 88C168 118.9 193.1 144 224 144C254.9 144 280 118.9 280 88zM304 300.7L341 350.6C353.8 333.1 369.5 317.9 387.3 305.6L331.1 229.9C306 196 266.3 176 224 176C181.7 176 142 196 116.8 229.9L46.3 324.9C35.8 339.1 38.7 359.1 52.9 369.7C67.1 380.3 87.1 377.3 97.7 363.1L144 300.7L144 576C144 593.7 158.3 608 176 608C193.7 608 208 593.7 208 576L208 416C208 407.2 215.2 400 224 400C232.8 400 240 407.2 240 416L240 576C240 593.7 254.3 608 272 608C289.7 608 304 593.7 304 576L304 300.7zM496 608C575.5 608 640 543.5 640 464C640 384.5 575.5 320 496 320C416.5 320 352 384.5 352 464C352 543.5 416.5 608 496 608zM512 400L512 448L560 448C568.8 448 576 455.2 576 464C576 472.8 568.8 480 560 480L512 480L512 528C512 536.8 504.8 544 496 544C487.2 544 480 536.8 480 528L480 480L432 480C423.2 480 416 472.8 416 464C416 455.2 423.2 448 432 448L480 448L480 400C480 391.2 487.2 384 496 384C504.8 384 512 391.2 512 400z"/></svg>
                                <div><span className="settings-contact-label">Shul Code</span><span>{shul.code}</span></div>
                            </div>
                        </div>
                    </aside>

                    <section className="settings-panel" aria-labelledby="shul-info-heading">
                        <div className="settings-section-header">
                            <div><h2 id="shul-info-heading">Shul Information</h2><p>Keep your congregation’s contact details up to date.</p></div>
                            <RestoreMenu section="Shul information" disabled={busy} onRestore={() => { void restoreFirstVersion('info'); }} />
                        </div>
                        <form className="shul-settings-edit" onSubmit={updateShulInfo} onChange={() => clearFeedback('info')}>
                            <fieldset className="shul-edit" disabled={busy}>
                                <legend className="visually-hidden">Shul information</legend>
                                <div className="settings-field-row shul-picture-field">
                                    <div className="settings-field-edit">
                                        <span className="settings-field-label">Shul Profile Picture</span>
                                        <PictureEditor pictureUrl={picturePreview} name={shul.name} square showPicture={false}
                                            onChange={picture => {
                                                setPictureDraft(picture === null && !shul.pictureUrl ? undefined : picture);
                                                clearFeedback('info');
                                            }} onReset={() => setPictureDraft(undefined)} changed={pictureDraft !== undefined}
                                            disabled={busy} onBusyChange={setPictureBusy} />
                                    </div>
                                    <div className="settings-field-preview">
                                        <span className="settings-field-label">Shul Profile Picture</span>
                                        <ProfilePicture src={picturePreview} name={shul.name} square />
                                    </div>
                                </div>
                                {contactFields.map((field) => (
                                    <div className="settings-field-row" key={field.id}>
                                        <div className="settings-field-edit">
                                            <div className="settings-field-heading">
                                                <label htmlFor={`shul-${field.id}`}>{field.label}</label>
                                            </div>
                                            {field.multiline ? (
                                                <textarea
                                                    id={`shul-${field.id}`}
                                                    rows={1}
                                                    value={field.value}
                                                    required
                                                    onChange={(event) => field.setValue(event.target.value)}
                                                />
                                            ) : (
                                                <input
                                                    id={`shul-${field.id}`}
                                                    type={field.type}
                                                    value={field.value}
                                                    required
                                                    onChange={(event) => field.setValue(event.target.value)}
                                                />
                                            )}
                                            <FieldReset label={field.label} changed={field.value !== field.savedValue}
                                                    onReset={() => resetField(() => field.setValue(field.savedValue), 'info')} />
                                        </div>
                                        <div className="settings-field-preview">
                                            <span className="settings-field-label">{field.label}</span>
                                            <div className="settings-preview-value">{field.value}</div>
                                        </div>
                                    </div>
                                ))}
                                <div className="settings-form-footer">
                                    <ChangeLog changes={contactChangeLog} />
                                    <div className="settings-footer-actions">
                                        <span>Changes appear after publishing.</span>
                                        <div className="settings-footer-buttons">
                                            <button className="settings-reset-btn" type="button" onClick={resetContactChanges} disabled={busy || contactChangeLog.length === 0}>Reset changes</button>
                                            <button className="submit-btn" type="submit" disabled={busy || contactChangeLog.length === 0}>{saving && activeForm === 'info' ? 'Publishing…' : 'Publish Changes'}</button>
                                        </div>
                                        <SubmissionMessage message={messages.info} onDismiss={() => clearFeedback('info')} />
                                    </div>
                                </div>
                            </fieldset>
                        </form>
                    </section>

                    <section className="settings-panel" aria-labelledby="adjustments-heading">
                        <div className="settings-section-header">
                            <div><h2 id="adjustments-heading">Reading Adjustments</h2><p>Search for a reading. Then, manage its details, aliyot, and readers.</p></div>
                        </div>
                        <form className="shul-settings-edit" onSubmit={publishReadingAdjustments}>
                            <fieldset className="shul-edit" disabled={busy || scheduleLoading || Boolean(scheduleError)}>
                                <legend className="visually-hidden">Reading adjustments</legend>
                                <div className="reading-search">
                                    <label htmlFor="reading-search">Search by Parsha or Yontif name</label>
                                    <div className="reading-search-control">
                                        <input
                                            id="reading-search"
                                            type="text"
                                            placeholder="e.g. Pinchas or Pesach"
                                            value={search}
                                            onChange={(event) => setSearch(event.target.value)}
                                            onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault(); }}
                                        />
                                        <img className="reading-search-icon" src={searchIcon} alt="" aria-hidden="true" />
                                    </div>
                                </div>

                                <div className="results">
                                        {scheduleLoading ? <LoadingSkeleton variant="readings" />
                                        : scheduleError ? <p role="alert">{scheduleError}</p>
                                        : <>
                                        {search.trim() && matchingReadings.length === 0 && <SettingsNoResults />}
                                        {search ? matchingReadings
                                            .map((reading) => (
                                                <SearchResult
                                                    key={`${reading.dateString}:${reading.desc}`}
                                                    savedOccasions={reading.manualOccasions ?? []}
                                                    reading={previewReadingLocks(reading, readingDrafts, occasionDrafts, readerDrafts, countDrafts)}
                                                    users={users}
                                                    disabled={busy}
                                                    onLockChange={changeReadingLock}
                                                    onCountChange={changeReadingCount}
                                                    onOccasionsChange={changeReadingOccasions}
                                                    onReaderChange={changeReadingReader}
                                                />
                                            ))
                                        : 
                                        <>
                                            <span style={{ color: "#bdbcc3"}}>Readings Upcoming in the Next 30 Days</span>
                                            {schedule
                                                .filter((reading) => new Date(reading.dateString) >= new Date() && new Date(reading.dateString) <= new Date(new Date().setDate(new Date().getDate() + 30)))
                                                .map((reading) => (
                                                    <SearchResult
                                                        key={`${reading.dateString}:${reading.desc}`}
                                                        savedOccasions={reading.manualOccasions ?? []}
                                                        reading={previewReadingLocks(reading, readingDrafts, occasionDrafts, readerDrafts, countDrafts)}
                                                        users={users}
                                                        disabled={busy}
                                                        onLockChange={changeReadingLock}
                                                        onCountChange={changeReadingCount}
                                                        onOccasionsChange={changeReadingOccasions}
                                                        onReaderChange={changeReadingReader}
                                                    />

                                                ))}
                                        </>
                                        }
                                        </>}
                                </div>

                                <div className="settings-form-footer">
                                    <ChangeLog changes={readingAdjustmentChangeLog} />
                                    <div className="settings-footer-actions">
                                        <span>Changes take effect after publishing.</span>
                                        <div className="settings-footer-buttons">
                                            <button className="settings-reset-btn" type="button" onClick={resetReadingAdjustments} disabled={busy || !hasReadingChanges}>Reset changes</button>
                                            <button className="submit-btn" type="submit" disabled={busy || !hasReadingChanges}>{saving && activeForm === 'readings' ? 'Publishing…' : 'Publish Changes'}</button>
                                        </div>
                                        <SubmissionMessage message={messages.readings} onDismiss={() => clearFeedback('readings')} />
                                    </div>
                                </div>
                            </fieldset>
                        </form>
                    </section>

                    <section className="settings-panel" aria-labelledby="schedule-heading">
                        <div className="settings-section-header">
                            <div><h2 id="schedule-heading">Schedule Settings</h2><p>Set reading preferences to reflect your congregation’s traditions.</p></div>
                            <RestoreMenu section="Schedule settings" disabled={busy} onRestore={() => { void restoreFirstVersion('schedule'); }} />
                        </div>
                        <form className="shul-settings-edit" onSubmit={updateShulSchedule} onChange={() => clearFeedback('schedule')}>
                            <fieldset className="shul-edit" disabled={busy}>
                                <legend className="visually-hidden">Schedule settings</legend>
                                <div className="settings-preference-row">
                                    <div>
                                        <div className="settings-field-heading">
                                            <label htmlFor="shul-aliyot">Shabbat Aliyot</label>
                                        </div>
                                        <p>Number of aliyot to be read each Shabbat.</p>
                                    </div>
                                    <div className="settings-field-controls">
                                        <div className="settings-aliyot-control">
                                            <input id="shul-aliyot" type="number" min="1" max="7" step="1" value={a}
                                                onChange={(event) => updateAliyot(+event.target.value )} />
                                            <div className="slide-container">
                                                <input type="range" min="1" max="7" step="1" value={a} className="slider" aria-label="Shabbat aliyot"
                                                    onChange={(event) => updateAliyot(+event.target.value )} />
                                                <div className="slider-labels" aria-hidden="true">
                                                    {[1, 2, 3, 4, 5, 6, 7].map((value) => <span className="slider-tick" key={value}><span>{value}</span></span>)}
                                                </div>
                                            </div>
                                        </div>
                                        <FieldReset label="Shabbat aliyot" changed={a !== settings.a} onReset={() => resetField(() => setA(settings.a))} />
                                    </div>
                                </div>

                                {a < 7 ? <>
                                    <div className="settings-preference-row">
                                        <div>
                                            <div className="settings-field-heading">
                                                <span id="special-seven-label" className="settings-field-label">Special Seven</span>
                                            </div>
                                            <p>Rarely, the seventh aliyot is replaced by a special reading. When<br></br>reading less than seven aliyot, choose to read the special seventh<br></br>aliyah in place of the last aliyah.</p>
                                        </div>
                                        <div className="settings-field-controls">
                                            <div className="settings-bi-radio-options" role="group" aria-labelledby="yRespect-label">
                                                <label className={specialSeventh ? 'is-selected' : ''}>
                                                    <input
                                                        name="special-seventh"
                                                        type="radio"
                                                        value="traditional"
                                                        checked={specialSeventh}
                                                        onChange={() => setSpecialSeventh(true)}
                                                    />
                                                    <span>Special Final Aliyah</span>
                                                </label>

                                                <label className={!specialSeventh ? 'is-selected' : ''}>
                                                    <input
                                                        name="special-seventh"
                                                        type="radio"
                                                        value="scheduled"
                                                        checked={!specialSeventh}
                                                        onChange={() => setSpecialSeventh(false)}
                                                    />
                                                    <span>Traditional{a === 1 ? " First "
                                                                : (a === 2 ? " Second "
                                                                    : (a === 3 ? " Third "
                                                                        : (a === 4 ? " Fourth  "
                                                                            : (a === 5 ? " Fifth "
                                                                                : " Sixth "
                                                                            )
                                                                        )
                                                                    )
                                                                )
                                                        }Aliyah</span>
                                                </label>
                                            </div>
                                            <FieldReset label="Special final aliyah" changed={specialSeventh !== settings.specialSeventh} onReset={() => resetField(() => setSpecialSeventh(settings.specialSeventh))} />
                                        </div>
                                    </div>
                                </> : null}

                                <div className="settings-preference-row">
                                    <div>
                                        <div className="settings-field-heading">
                                            <span id="hhRespect-label" className="settings-field-label">High Holiday Aliyot</span>
                                        </div>
                                        <p>On High Holidays, follow traditional aliyot count for Rosh Hashana (5)<br></br>and Yom Kippur (6), or your congregation's Shabbat aliyot count.</p>
                                    </div>
                                    <div className="settings-field-controls">
                                        <div className="settings-bi-radio-options" role="group" aria-labelledby="hhRespect-label">
                                            <label className={hhRespect ? 'is-selected' : ''}>
                                                <input
                                                    name="hhRespect"
                                                    type="radio"
                                                    value="traditional"
                                                    checked={hhRespect}
                                                    onChange={() => setHhRespect(true)}
                                                />
                                                <span>Traditional High Holiday</span>
                                            </label>

                                            <label className={!hhRespect ? 'is-selected' : ''}>
                                                <input
                                                    name="hhRespect"
                                                    type="radio"
                                                    value="shabbat"
                                                    checked={!hhRespect}
                                                    onChange={() => setHhRespect(false)}
                                                />
                                                <span>Shabbat</span>
                                            </label>
                                        </div>
                                        <FieldReset label="High Holiday aliyot" changed={hhRespect !== settings.hhRespect} onReset={() => resetField(() => setHhRespect(settings.hhRespect))} />
                                    </div>
                                </div>

                                <div className="settings-preference-row">
                                    <div>
                                        <div className="settings-field-heading">
                                            <span id="yRespect-label" className="settings-field-label">Yontif Aliyot</span>
                                        </div>
                                        <p>On Yontifs, follow traditional aliyot count for Sukkot, Shmini Atzeret,<br></br>Pesach, Shavuot (5), and Simchat Torah (7), or your congregation's<br></br>Shabbat aliyot count.</p>
                                    </div>
                                    <div className="settings-field-controls">
                                        <div className="settings-bi-radio-options" role="group" aria-labelledby="yRespect-label">
                                            <label className={yRespect ? 'is-selected' : ''}>
                                                <input
                                                    name="yRespect"
                                                    type="radio"
                                                    value="yontif"
                                                    checked={yRespect}
                                                    onChange={() => setYRespect(true)}
                                                />
                                                <span>Traditional Yontif</span>
                                            </label>

                                            <label className={!yRespect ? 'is-selected' : ''}>
                                                <input
                                                    name="yRespect"
                                                    type="radio"
                                                    value="shabbat"
                                                    checked={!yRespect}
                                                    onChange={() => setYRespect(false)}
                                                />
                                                <span>Shabbat</span>
                                            </label>
                                        </div>
                                        <FieldReset label="Yontif aliyot" changed={yRespect !== settings.yRespect} onReset={() => resetField(() => setYRespect(settings.yRespect))} />
                                    </div>
                                </div>

                                <div className="settings-preference-row">
                                    <div>
                                        <div className="settings-field-heading">
                                            <span id="calendar-label" className="settings-field-label">Calendar</span>
                                        </div>
                                        <p>The geographical calendar your shul follows.</p>
                                    </div>
                                    <div className="settings-field-controls">
                                        <div className="settings-bi-radio-options" role="group" aria-labelledby="calendar-label">
                                            <label className={!il ? 'is-selected' : ''}>
                                                <input
                                                    name="calendar"
                                                    type="radio"
                                                    value="diaspora"
                                                    checked={!il}
                                                    onChange={() => setIl(false)}
                                                />
                                                <span>Diaspora</span>
                                            </label>
                                            <label className={il ? 'is-selected' : ''}>
                                                <input
                                                    name="calendar"
                                                    type="radio"
                                                    value="israel"
                                                    checked={il}
                                                    onChange={() => setIl(true)}
                                                />
                                                <span>Israel</span>
                                            </label>
                                        </div>
                                        <FieldReset label="Calendar" changed={il !== settings.il} onReset={() => resetField(() => setIl(settings.il))} />
                                    </div>
                                </div>

                                <div className="settings-preference-row settings-preference-row-top">
                                    <div>
                                        <div className="settings-field-heading">
                                            <span id="yontifs-label" className="settings-field-label">Observed Yontifs</span>
                                        </div>
                                        <p>Select all Yontifs your shul observes with a Torah reading.</p>
                                    </div>
                                    <div className="settings-field-controls">
                                        <div className="settings-check-options" role="group" aria-labelledby="yontifs-label">
                                            {yontifNames.map((y: string, index) => {
                                                const abbreviation = yontifAbr[index];
                                                return (
                                                    <label key={abbreviation} className={yontifs[abbreviation] ? 'is-selected' : ''}>
                                                            <input
                                                                type="checkbox"
                                                                checked={yontifs[abbreviation]}
                                                                onChange={(event) => setYontifs({ ...yontifs, [abbreviation]: event.target.checked })}
                                                            />
                                                            <span>{y}</span>
                                                    </label>
                                                );
                                            })}
                                            <button
                                                type="button"
                                                className="settings-select-all"
                                                onClick={() => {
                                                    clearFeedback('schedule');
                                                    setYontifs((previous) => {
                                                        const checked = !yontifAbr.every((abbreviation) => previous[abbreviation]);
                                                        const updated = { ...previous };
                                                        yontifAbr.forEach((abbreviation) => {
                                                            updated[abbreviation] = checked;
                                                        });
                                                        return updated;
                                                    });
                                                }}
                                            >
                                                {allYontifsSelected ? 'Unselect all' : 'Select all'}
                                            </button>
                                        </div>
                                        <FieldReset label="Observed Yontifs" changed={yontifAbr.some((key) => yontifs[key] !== settings.yontifs[key])} onReset={() => resetField(() => setYontifs({ ...settings.yontifs }))} />
                                    </div>
                                </div>

                                <div className="settings-preference-row">
                                    <div>
                                        <div className="settings-field-heading">
                                            <span id="triennial-label" className="settings-field-label">Triennial</span>
                                        </div>
                                        <p>Subscribe to the triennial or traditional reading schedule.</p>
                                    </div>
                                    <div className="settings-field-controls">
                                        <div className="settings-bi-radio-options" role="group" aria-labelledby="triennial-label">
                                            <label className={!tri ? 'is-selected' : ''}>
                                                <input
                                                    name="triennial"
                                                    type="radio"
                                                    value="traditional"
                                                    checked={!tri}
                                                    onChange={() => setTri(false)}
                                                ></input>
                                                <span>Traditional Schedule</span>
                                            </label>

                                            <label className={tri ? 'is-selected' : ''}>
                                                <input
                                                    name="triennial"
                                                    type="radio"
                                                    value="triennial"
                                                    checked={tri}
                                                    onChange={() => setTri(true)}
                                                ></input>
                                                <span>Triennial Schedule</span>
                                            </label>
                                        </div>
                                        <FieldReset label="Triennial" changed={tri !== settings.triennial.tri} onReset={() => resetField(() => setTri(settings.triennial.tri))} />
                                    </div>
                                </div>

                                {tri? <>
                                    <div className="settings-preference-row">
                                        <div>
                                            <div className="settings-field-heading">
                                                <span id="maftir-label" className="settings-field-label">Maftir</span>
                                            </div>
                                            <p>Select the maftir to be read each week.</p>
                                        </div>
                                        <div className="settings-field-controls">
                                            <div className="settings-bi-radio-options" role="group" aria-labelledby="maftir-label">
                                                <label className={triMaftir ? 'is-selected' : ''}>
                                                    <input
                                                        name="maftir"
                                                        type="radio"
                                                        value="tri"
                                                        checked={triMaftir}
                                                        onChange={() => updateMaftir("tri")}
                                                    ></input>
                                                    <span>Triennial Maftir</span>
                                                </label>


                                                <label className={tradMaftir ? 'is-selected' : ''}>
                                                    <input
                                                        name="maftir"
                                                        type="radio"
                                                        value="trad"
                                                        checked={tradMaftir}
                                                        onChange={() => updateMaftir("trad")}
                                                    ></input>
                                                    <span>Annual Maftir</span>
                                                </label>

                                                <label className={!triMaftir && !tradMaftir ? 'is-selected' : ''}>
                                                    <input
                                                        name="maftir"
                                                        type="radio"
                                                        value="tri"
                                                        checked={!triMaftir && !tradMaftir}
                                                        onChange = {() => updateMaftir("none")}
                                                    ></input>
                                                    <span>No Maftir</span>
                                                </label>
                                            </div>
                                            <FieldReset label="Maftir" changed={triMaftir !== settings.triennial.triMaftir || tradMaftir !== settings.triennial.tradMaftir} onReset={() => resetField(() => { setTriMaftir(settings.triennial.triMaftir); setTradMaftir(settings.triennial.tradMaftir); })} />
                                        </div>
                                    </div>

                                    <div className="settings-preference-row">
                                        <div>
                                            <div className="settings-field-heading">
                                                <span id="ten-commandments-label" className="settings-field-label">Ten Commandments</span>
                                            </div>
                                            <p>For parshiyot that include the Ten Commandments, Yitro<br></br>and Vaetchanan, choose to apply the traditional or triennial<br></br>schedule.</p>
                                        </div>
                                        <div className="settings-field-controls">
                                            <div className="settings-bi-radio-options" role="group" aria-labelledby="ten-commendments-label">
                                            <label className={!yitro ? 'is-selected' : ''}>
                                                <input
                                                    name="ten-commandments"
                                                    type="radio"
                                                    value="traditional"
                                                    checked={!yitro}
                                                    onChange={() => updateTenCommandments(false)}
                                                ></input>
                                                <span>Traditional Schedule</span>
                                            </label>

                                            <label className={yitro ? 'is-selected' : ''}>
                                                <input
                                                    name="ten-commandments"
                                                    type="radio"
                                                    value="triennial"
                                                    checked={yitro}
                                                    onChange={() => updateTenCommandments(true)}
                                                ></input>
                                                <span>Triennial Schedule</span>
                                            </label>
                                        </div>
                                            <FieldReset label="Ten Commandments" changed={yitro !== settings.triennial.yitro || vaetchanan !== settings.triennial.vaetchanan} onReset={() => resetField(() => { setYitro(settings.triennial.yitro); setVaetchanan(settings.triennial.vaetchanan); })} />
                                        </div>
                                    </div>
                                </>
                                : null}

                                <div className="settings-form-footer">
                                    <ChangeLog changes={scheduleChangeLog} />
                                    <div className="settings-footer-actions">
                                        <span>Changes take effect after publishing.</span>
                                        <div className="settings-footer-buttons">
                                            <button className="settings-reset-btn" type="button" onClick={resetScheduleChanges} disabled={busy || scheduleChangeLog.length === 0}>Reset changes</button>
                                            <button className="submit-btn" type="submit" disabled={busy || scheduleChangeLog.length === 0}>{saving && activeForm === 'schedule' ? 'Saving…' : 'Publish Changes'}</button>
                                        </div>
                                        <SubmissionMessage message={messages.schedule} onDismiss={() => clearFeedback('schedule')} />
                                    </div>
                                </div>
                            </fieldset>
                        </form>
                    </section>

                    <section className="settings-panel" aria-labelledby="permissions-heading">
                        <div className="settings-section-header">
                            <div><h2 id="permissions-heading">Users &amp; Permissions</h2><p>Guests, members, and administrators of {shul.name}.</p></div>
                        </div>
                        <div className="settings-users" aria-busy={usersLoading}>
                            <div className="user-search">
                                <label htmlFor="user-search">Search Users by Name</label>
                                <div className="reading-search-control">
                                <input
                                    id="user-search"
                                    type="text"
                                    placeholder="e.g. Josh Cohen"
                                    value={userSearch}
                                    onChange={(event) => setUserSearch(event.target.value)}
                                    onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault(); }}
                                />
                                <img className="reading-search-icon" src={searchIcon} alt="" aria-hidden="true" />
                                </div>
                            </div>

                            <div className="user-list">
                                {usersLoading && <LoadingSkeleton variant="users" />}
                                {usersError && <p role="alert">{usersError}</p>}
                                
                                {!usersLoading && !usersError && userSearch.trim() && matchingUsers.length === 0 && <SettingsNoResults />}
                                {matchingUsers.map((u: ShulUser, index) => {
                                    return index % 10 === 0 ? <>
                                        {index !== 0 ? <br></br> : null}
                                        <div className="list-heading">
                                            <div className="user-name-heading">
                                                <button
                                                    onClick={() => {
                                                        setUserSort("name")
                                                        setNameSortClicks(nameSortClicks+1)
                                                    }}
                                                    className="field-btn"
                                                    style={{ color: "#bdbcc3", fontWeight: "800"}}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M130.4 268.2C135.4 280.2 147 288 160 288L480 288C492.9 288 504.6 280.2 509.6 268.2C514.6 256.2 511.8 242.5 502.7 233.3L342.7 73.3C330.2 60.8 309.9 60.8 297.4 73.3L137.4 233.3C128.2 242.5 125.5 256.2 130.5 268.2zM130.4 371.7C125.4 383.7 128.2 397.4 137.3 406.6L297.3 566.6C309.8 579.1 330.1 579.1 342.6 566.6L502.6 406.6C511.8 397.4 514.5 383.7 509.5 371.7C504.5 359.7 492.9 352 480 352L160 352C147.1 352 135.4 359.8 130.4 371.8z"/></svg>
                                                        Name
                                                        </button>
                                                <InfoIcon message="Click on a name to toggle name formatting"
                                                    iconStyle={{ width: '14px', height: '14px', fontSize: '9px' }}
                                                    style={{
                                                        width: '220px',
                                                        left: '50%',
                                                        right: 'auto',
                                                        top: 'calc(100% + 10px)',
                                                        transform: 'translateX(-50%)',
                                                        backgroundColor: 'var(--settings-surface)',
                                                        color: '#f6f5f7',
                                                        border: '1px solid var(--settings-border)',
                                                        fontSize: '13px',
                                                        zIndex: 350,
                                                    }} />
                                            </div>
                                            <div>
                                                <button
                                                    onClick={() => {
                                                        setUserSort("email")
                                                        setEmailSortClicks(emailSortClicks+1)}}
                                                    className="field-btn"
                                                    style={{ color: "#bdbcc3", fontWeight: "800"}}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M130.4 268.2C135.4 280.2 147 288 160 288L480 288C492.9 288 504.6 280.2 509.6 268.2C514.6 256.2 511.8 242.5 502.7 233.3L342.7 73.3C330.2 60.8 309.9 60.8 297.4 73.3L137.4 233.3C128.2 242.5 125.5 256.2 130.5 268.2zM130.4 371.7C125.4 383.7 128.2 397.4 137.3 406.6L297.3 566.6C309.8 579.1 330.1 579.1 342.6 566.6L502.6 406.6C511.8 397.4 514.5 383.7 509.5 371.7C504.5 359.7 492.9 352 480 352L160 352C147.1 352 135.4 359.8 130.4 371.8z"/></svg>
                                                        Email</button>
                                            </div>
                                            <div>
                                                <button
                                                    onClick={() => {
                                                        setUserSort("role")
                                                        setRoleSortClicks(roleSortClicks+1)
                                                    }}
                                                    className="field-btn"
                                                    style={{ color: "#bdbcc3", fontWeight: "800"}}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M130.4 268.2C135.4 280.2 147 288 160 288L480 288C492.9 288 504.6 280.2 509.6 268.2C514.6 256.2 511.8 242.5 502.7 233.3L342.7 73.3C330.2 60.8 309.9 60.8 297.4 73.3L137.4 233.3C128.2 242.5 125.5 256.2 130.5 268.2zM130.4 371.7C125.4 383.7 128.2 397.4 137.3 406.6L297.3 566.6C309.8 579.1 330.1 579.1 342.6 566.6L502.6 406.6C511.8 397.4 514.5 383.7 509.5 371.7C504.5 359.7 492.9 352 480 352L160 352C147.1 352 135.4 359.8 130.4 371.8z"/></svg>
                                                        Role
                                                        </button>
                                            </div>
                                            <div>Actions</div>
                                        </div>
                                        <div className="divider" style={{ width: "100%", borderBottom: "0.5px solid #504f52"}}></div>
                                        <UserCard user={u} nameClick={nameClick} setNameClick={setNameClick}></UserCard>
                                    </> : <> <UserCard user={u} nameClick={nameClick} setNameClick={setNameClick} ></UserCard> </>;
                                })}
                                    
                            </div>
                            <div className="settings-form-footer">
                                <ChangeLog changes={[]} />
                                <div className="settings-footer-actions">
                                    <span>Changes take effect after publishing.</span>
                                    <div className="settings-footer-buttons">
                                        <button className="settings-reset-btn" type="button" disabled>Reset changes</button>
                                        <button className="submit-btn" type="button" disabled>Publish Changes</button>
                                    </div>
                                    <SubmissionMessage message={null} />
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
