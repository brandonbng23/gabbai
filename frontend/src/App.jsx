import Navbar from "./Components/navbar"
import Aside from "./Components/aside.tsx"
import Footer from "./Components/footer"
import WelcomeBar from "./Components/welcomeBar.tsx"
// import Filter from "./Components/filter.tsx"
// import Parsha from "./Components/parsha.tsx"
import Schedule from "./Components/schedule.tsx"
//import ScheduleC from "./Components/schedule";

/* const sampleParsha = {
  hDate: "29 Tishrei 5785",
  gregDate: "10 October 2025",
  parsha: "Bereshit",
  psukim: ["Genesis 1:1-2:3", "Genesis 2:4-2:19", "Genesis 2:20-3:21", "Genesis 3:22-4:18", "Genesis 4:19-4:22", "Genesis 4:23-5:24", "Genesis 5:25-6:8", "Genesis 6:5-6:8", "Isaiah 42:5-43:10"],
  user: "",
} */

const sampleParshiyot = [
  {
    id: 1,
    hDate: "29 Tishrei 5787",
    gregDate: "10 October 2026",
    desc: "Bereshit",
    occassion: "Shabbat",
    psukim: ["Genesis 1:1-2:3", "Genesis 2:4-2:19", "Genesis 2:20-3:21", "Genesis 3:22-4:18", "Genesis 4:19-4:22", "Genesis 4:23-5:24", "Genesis 5:25-6:8", "Genesis 6:5-6:8", "Isaiah 42:5-43:10"],
    readers: [],
    searchTerms: ["Bereshit", "Bereshith", "Bereishit", "Bereishis", "Bereshis", "Genesis"],
    dateString: "2026-10-10",
  },
  {
    id: 2,
    hDate: "6 Cheshvan 5787",
    gregDate: "17 October 2026",
    desc: "Noach",
    occassion: "Shabbat",
    psukim: ["Genesis 6:9-6:22", "Genesis 7:1-7:16", "Genesis 7:17-8:14", "Genesis 8:15-9:7", "Genesis 9:8-9:17", "Genesis 9:18-10:32", "Genesis 11:1-11:32", "Genesis 11:29-11:32", "Isaiah 54:1-55:5"],
    reader: [],
    searchTerms: ["Noach", "Noah", "Noahch", "Noakh"],
    dateString: "2026-10-17",
  }
]

function App() {
  return (
  <>
    <div className="app-layout">
      <Navbar></Navbar>
      <Aside></Aside>
      <div className="content-window">
        <WelcomeBar fName="Brandon"></WelcomeBar>
        <Schedule
          parshiyot = {sampleParshiyot}>
        </Schedule>
      </div>
      
    </div>
    <Footer></Footer>
  </>
    );
}

export default App;