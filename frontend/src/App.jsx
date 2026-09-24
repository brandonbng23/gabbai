import Navbar from "./Components/navbar"
import Aside from "./Components/aside.tsx"
import Footer from "./Components/footer"
import WelcomeBar from "./Components/welcomeBar.tsx"
import Parsha from "./Components/parsha.tsx"
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
    hDate: "29 Tishrei 5787",
    gregDate: "10 October 2026",
    parsha: "Bereshit",
    psukim: ["Genesis 1:1-2:3", "Genesis 2:4-2:19", "Genesis 2:20-3:21", "Genesis 3:22-4:18", "Genesis 4:19-4:22", "Genesis 4:23-5:24", "Genesis 5:25-6:8", "Genesis 6:5-6:8", "Isaiah 42:5-43:10"],
    reader: "",
    user: "",
  },
  {
    hDate: "6 Cheshvan 5787",
    gregDate: "17 October 2026",
    parsha: "Noach",
    psukim: ["Genesis 6:9-6:22", "Genesis 7:1-7:16", "Genesis 7:17-8:14", "Genesis 8:15-9:17", "Genesis 9:18-10:32", "Genesis 11:1-11:32", "Genesis 11:29-11:32", "Isaiah 54:1-55:5"],
    reader: "",
    user: "",
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
        <div className="aliyot">
          {sampleParshiyot.map((p, index) => <Parsha key={index} {...p}></Parsha>)}
        </div>
      </div>
      
    </div>
    <Footer></Footer>
  </>
    );
}

export default App;