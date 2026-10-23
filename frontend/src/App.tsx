import { AuthPage } from "./Pages/auth.tsx"
import Navbar from "./Components/navbar.tsx"
import Aside from "./Components/aside.tsx"
import Footer from "./Components/footer.tsx"
import WelcomeBar from "./Components/welcomeBar.tsx"
import Schedule from "./Components/schedule.tsx"
import AliyahRegistration from "./Pages/aliyahRegistration.tsx"
import type { ParshaObj } from "./Components/parsha.tsx"
import { useEffect, useState } from "react"
import MyShul from "./Pages/myShul.js"
import ShulSettings from "./Pages/shulSettings.js"
import { UserSettings } from "./Pages/userSettings.tsx"
import { UserView } from "./Pages/userView.tsx"
import { LoadingSkeleton } from "./Components/loadingSkeleton.tsx"
import { getCurrentUser, getJson } from "./api.js"
import type { Shul, User } from "./api.js"

function App() {
    const [schedule, setSchedule] = useState<ParshaObj[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scheduleLoading, setScheduleLoading] = useState(true);
    const [scheduleError, setScheduleError] = useState<string | null>(null);
    const [shul, setShul] = useState<Shul | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const isRegistrationPage = window.location.pathname.replace(/\/$/, "") === "/registration";
    const isShulPage = window.location.pathname.replace(/\/$/, "") === "/shul";
    const isShulSettingsPage = window.location.pathname.replace(/\/$/, "") === "/shulSettings";
    const isUserSettingsPage = window.location.pathname.replace(/\/$/, "") === "/userSettings";
    const isUserViewPage = window.location.pathname.replace(/\/$/, "") === "/userView";
    const authPath = window.location.pathname.replace(/\/$/, '');
    const isAuthPage = authPath === '/signin' || authPath === '/signup';
    const isSchedulePage = !isRegistrationPage && !isShulPage && !isShulSettingsPage && !isUserSettingsPage && !isUserViewPage && !isAuthPage;
    const viewedUserId = new URLSearchParams(window.location.search).get('user') || '';

    useEffect(() => {
        const controller = new AbortController();
        async function load() {
            try {
                const currentUser = await getCurrentUser(controller.signal);
                if (controller.signal.aborted) return;
                setUser(currentUser);
                if (isAuthPage) return;
                const selected = currentUser?.shulId || new URLSearchParams(window.location.search).get('shul');
                if (!selected) {
                    if (isRegistrationPage) throw new Error('Open a reading registration link to choose a shul and aliyah.');
                    return;
                }
                const profile = await getJson<Shul>(`/api/shuls/${encodeURIComponent(selected)}`, controller.signal);
                if (controller.signal.aborted) return;
                setUser(currentUser);
                setShul(profile);
            } catch (failure) {
                if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to load your shul.');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        void load();
        return () => controller.abort();
    }, [isAuthPage, isRegistrationPage]);

    const shulId = shul?.id;
    const scheduleSettings = shul?.settings;
    useEffect(() => {
        if (!shulId || !scheduleSettings) return;
        const controller = new AbortController();
        const path = `/api/schedule?${new URLSearchParams({ shul: shulId })}`;
        async function loadSchedule() {
            setScheduleLoading(true);
            setScheduleError(null);
            try {
                const readings = await getJson<ParshaObj[]>(
                    path,
                    controller.signal,
                );
                if (!controller.signal.aborted) setSchedule(readings);
            } catch (failure) {
                if (!controller.signal.aborted) {
                    setScheduleError(failure instanceof Error ? failure.message : 'Unable to load your schedule.');
                }
            } finally {
                if (!controller.signal.aborted) setScheduleLoading(false);
            }
        }
        void loadSchedule();
        return () => controller.abort();
    }, [shulId, scheduleSettings]);

    function handleReadingCancelled(dateString: string, desc: string, aliyah: number): void {
        const keepReading = (reading: { dateString: string; desc: string; aliyah: number }) =>
            reading.dateString !== dateString || reading.desc !== desc || reading.aliyah !== aliyah;
        setSchedule(previous => previous.map(reading => ({
            ...reading,
            readers: reading.readers.map((reader, index) => {
                if (reading.dateString === dateString && reading.desc === desc && index === aliyah - 1) return null;
                return reader && reader.id === user?.id
                    ? { ...reader, assignedReadings: reader.assignedReadings.filter(keepReading) } : reader;
            }),
        })));
        setUser(previous => previous ? { ...previous, assignedReadings: previous.assignedReadings.filter(keepReading) } : previous);
    }

    if (isAuthPage) return <AuthPage key={authPath} mode={authPath === '/signup' ? 'signup' : 'signin'} />;
    if (!loading && !error && !user && !isRegistrationPage
        && (!shul || isUserSettingsPage || isShulSettingsPage || isUserViewPage)) return <AuthPage mode="signin" />;

    return (
        <div>
            <div className="app-layout">
              <Navbar user={user}></Navbar>
              <Aside user={user}></Aside>
            <div className={`content-window${isShulSettingsPage || isUserSettingsPage || isUserViewPage || isRegistrationPage ? ' content-window-settings' : ''}${isSchedulePage ? ' content-window-schedule' : ''}`}>
              {isRegistrationPage ? (
                <AliyahRegistration shulId={shulId} schedule={schedule} loading={loading || (!error && scheduleLoading)} error={error || scheduleError} user={user} />
              ) : loading ? <LoadingSkeleton page variant={isShulSettingsPage || isUserSettingsPage ? 'settings' : isUserViewPage ? 'profile' : isShulPage ? 'shul' : 'schedule'} />
              : isUserViewPage ? (
                user && ['member', 'admin'].includes(user.role)
                    ? <UserView key={viewedUserId} userId={viewedUserId} />
                    : <p className="shul-context" role="alert">Only signed-in members and administrators can view user profiles.</p>
              )
              : isUserSettingsPage ? (
                user ? <UserSettings key={user.id} user={user} shul={shul} onSaved={setUser} /> : <p className="shul-context" role="alert">Sign in to view your preferences.</p>
              )
              : error ? <div className="shul-context" role="alert">{error} <a href="/">Back to schedule</a></div>
              : !shul ? <p className="shul-context">Your account is not associated with a shul. Contact your shul administrator.</p>
              : isShulSettingsPage ? (
                user?.role === 'admin' ? <ShulSettings shul={shul} currentUserId={user.id} schedule={schedule} scheduleLoading={scheduleLoading} scheduleError={scheduleError} onSaved={setShul}
                    onReadingUpdated={(updated) => setSchedule((previous) => previous.map((reading) =>
                        reading.dateString === updated.dateString && reading.desc === updated.desc ? updated : reading))} />
                : <p className="shul-context" role="alert">Only shul administrators can access these settings.</p>
              ) : isShulPage ? <MyShul shul={shul} /> : <main className="schedule-page">
              <WelcomeBar fName={user?.firstName}></WelcomeBar>
              {scheduleLoading ? <LoadingSkeleton variant="schedule" />
              : scheduleError ? <p className="shul-context" role="alert">{scheduleError}</p>
              : <Schedule
                shulId={shulId} parshiyot = {schedule}
                currentUserId={user?.id} onReadingCancelled={handleReadingCancelled}>
              </Schedule>}
              </main>}
            </div>
        </div>
          <Footer></Footer>
        </div>
    );
}

export default App;
