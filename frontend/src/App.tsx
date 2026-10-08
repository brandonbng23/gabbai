import Navbar from "./Components/navbar.tsx"
import Aside from "./Components/aside.tsx"
import Footer from "./Components/footer.tsx"
import WelcomeBar from "./Components/welcomeBar.tsx"
import Schedule from "./Components/schedule.tsx"
import type { ParshaObj } from "./Components/parsha.tsx"
import { useEffect, useState } from "react"

function App() {
    const [schedule, setSchedule] = useState<ParshaObj[]>([]);
    const hebYear = 5787;

    useEffect(() => {
        fetch(`/api/schedule?year=${hebYear}`)
            .then(response => response.json())
            .then(data => {
                setSchedule(data);
            });
    }, []);

    return (
        <div>
            <div className="app-layout">
              <Navbar></Navbar>
              <Aside></Aside>
            <div className="content-window">
              <WelcomeBar fName="Brandon"></WelcomeBar>
              <Schedule
                parshiyot = {schedule}>
              </Schedule>
            </div>
        </div>
          <Footer></Footer>
        </div>
    );
}

export default App;
