import Navbar from "./Components/navbar"
import Aside from "./Components/aside"
import Schedule from "./Components/schedule"
import Footer from "./Components/footer"
//import ScheduleC from "./Components/schedule";

function App() {
  return (
  <>
    <div className="app-layout">
      <Navbar/>
      <Aside/>
    </div>
    <Footer />
  </>
    );
}

export default App;