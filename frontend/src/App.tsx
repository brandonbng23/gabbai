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
import { getCurrentUser, getJson } from "./api.js"
import type { Shul, User } from "./api.js"

function App() {
    const [schedule, setSchedule] = useState<ParshaObj[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [shul, setShul] = useState<Shul | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const isRegistrationPage = window.location.pathname.replace(/\/$/, "") === "/registration";
    const isShulPage = window.location.pathname.replace(/\/$/, "") === "/shul";
    const isShulSettingsPage = window.location.pathname.replace(/\/$/, "") === "/shulSettings";

    useEffect(() => {
        const controller = new AbortController();
        async function load() {
            try {
                const currentUser = await getCurrentUser(controller.signal);
                if (controller.signal.aborted) return;
                if (!currentUser) throw new Error('Sign in to view your shul.');
                const selected = currentUser.shulId;
                const [profile, readings] = await Promise.all([
                    getJson<Shul>(`/api/shuls/${encodeURIComponent(selected)}`, controller.signal),
                    getJson<ParshaObj[]>(`/api/schedule?${new URLSearchParams({ shul: selected })}`, controller.signal),
                ]);
                if (controller.signal.aborted) return;
                const url = new URL(window.location.href);
                url.searchParams.delete('shul');
                window.history.replaceState(null, '', url);
                setUser(currentUser);
                setShul(profile);
                setSchedule(readings);
            } catch (failure) {
                if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to load your shul.');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        void load();
        return () => controller.abort();
    }, []);

    return (
        <div>
            <div className="app-layout">
              <Navbar></Navbar>
              <Aside user={user}></Aside>
            <div className="content-window">
              {isRegistrationPage ? (
                <AliyahRegistration schedule={schedule} loading={loading} error={error} user={user} />
              ) : loading ? <p className="shul-context" role="status">Loading your shul…</p>
              : error ? <div className="shul-context" role="alert">{error} <a href="/">Back to schedule</a></div>
              : !shul ? <p className="shul-context">Your shul is not available yet.</p>
              : isShulSettingsPage ? (
                user?.role === 'admin' ? <ShulSettings shul={shul} onSaved={setShul} />
                : <p className="shul-context" role="alert">Only shul administrators can access these settings.</p>
              ) : isShulPage ? <MyShul shul={shul} /> : <>
              <WelcomeBar fName={user?.firstName}></WelcomeBar>
              <Schedule
                parshiyot = {schedule}>
              </Schedule>
              </>}
            </div>
        </div>
          <Footer></Footer>
        </div>
    );
}

export default App;
