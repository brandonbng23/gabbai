import Welcome from "./welcome"

function ScheduleC() {
    let settings = new Settings(5787);
    settings.setTriennial(false);    
    let schedule = new Schedule(settings, settings.getHebYear());

    let readings = [];
    let counter = 0;

    let current = schedule.head;
    while(current && counter < 2100) {
        readings.push(current);
        current = current.next;
        counter++;
    }
     
    return (
        <div className="content">
            <Welcome name="Brandon"/>
        </div>
    )
}

export default ScheduleC;