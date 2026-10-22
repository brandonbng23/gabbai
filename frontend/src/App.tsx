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

    useEffect(() => {
        const controller = new AbortController();
        async function load() {
            try {
                const currentUser = await getCurrentUser(controller.signal);
                if (controller.signal.aborted) return;
                const selected = currentUser?.shulId || new URLSearchParams(window.location.search).get('shul');
                if (!selected) throw new Error('Open a shul registration link or sign in to view your shul.');
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
    }, []);

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

    return (
        <div>
            <div className="app-layout">
              <Navbar></Navbar>
              <Aside user={user}></Aside>
            <div className={`content-window${isShulSettingsPage || isUserSettingsPage ? ' content-window-settings' : ''}`}>
              {isRegistrationPage ? (
                <AliyahRegistration shulId={shulId} schedule={schedule} loading={loading || (!error && scheduleLoading)} error={error || scheduleError} user={user} />
              ) : loading ? <p className="shul-context" role="status">Loading your shul…</p>
              : error ? <div className="shul-context" role="alert">{error} <a href="/">Back to schedule</a></div>
              : !shul ? <p className="shul-context">Your shul is not available yet.</p>
              : isShulSettingsPage ? (
                user?.role === 'admin' ? <ShulSettings shul={shul} schedule={schedule} onSaved={setShul}
                    onReadingUpdated={(updated) => setSchedule((previous) => previous.map((reading) =>
                        reading.dateString === updated.dateString && reading.desc === updated.desc ? updated : reading))} />
                : <p className="shul-context" role="alert">Only shul administrators can access these settings.</p>
              ) : isUserSettingsPage ? (
                user ? <UserSettings key={user.id} user={user} shul={shul} onSaved={setUser} /> : <p className="shul-context" role="alert">Sign in to view your preferences.</p>
              ) : isShulPage ? <MyShul shul={shul} /> : <>
              <WelcomeBar fName={user?.firstName}></WelcomeBar>
              {scheduleLoading ? <p className="shul-context" role="status">Loading your schedule…</p>
              : scheduleError ? <p className="shul-context" role="alert">{scheduleError}</p>
              : <Schedule
                shulId={shulId} parshiyot = {schedule}>
              </Schedule>}
              </>}
            </div>
        </div>
          <Footer></Footer>
        </div>
    );
}

export default App;
