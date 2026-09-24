import Navbar from "./Components/navbar"
import Aside from "./Components/aside.tsx"
import Footer from "./Components/footer"
import Welcome from "./Components/welcome.tsx"
import Aliyah from "./Components/aliyah"
//import ScheduleC from "./Components/schedule";

function App() {
  return (
  <>
    <div className="app-layout">
      <Navbar></Navbar>
      <Aside></Aside>
      <div className="content-window">
        <Welcome fName="Brandon"></Welcome>
        <Aliyah></Aliyah>
      </div>
      
    </div>
    <Footer></Footer>
  </>
    );
}

export default App;