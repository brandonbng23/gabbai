import Navbar from "./Components/navbar.tsx"
import Aside from "./Components/aside.tsx"
import Footer from "./Components/footer.tsx"
import WelcomeBar from "./Components/welcomeBar.tsx"
import Schedule from "./Components/schedule.tsx"
import AliyahRegistration from "./Pages/aliyahRegistration.tsx"
import type { ParshaObj } from "./Components/parsha.tsx"
import { useEffect, useState } from "react"

function App() {
    const [schedule, setSchedule] = useState<ParshaObj[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const hebYear = 5787;
    const isRegistrationPage = window.location.pathname.replace(/\/$/, "") === "/registration";

    useEffect(() => {
        fetch(`/api/schedule?year=${hebYear}`)
            .then(response => {
                if (!response.ok) throw new Error("Unable to load readings. Please try again.");
                return response.json();
            })
            .then(data => {
                setSchedule(data);
            })
            .catch(() => setError("Unable to load readings. Please try again."))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div>
            <div className="app-layout">
              <Navbar></Navbar>
              <Aside></Aside>
            <div className="content-window">
              {isRegistrationPage ? (
                <AliyahRegistration schedule={schedule} loading={loading} error={error} />
              ) : <>
              <WelcomeBar fName="Brandon"></WelcomeBar>
              {error && <div role="alert">{error}</div>}
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
