function Welcome({fName}: {fName: string}) {
    let hour = new Date().getHours();
    let greeting = "";

    if (hour < 12) {
        greeting = "Boker Tov"
    } else if (hour < 19) {
        greeting = "Tazaharayim Tovim"
    } else {
        greeting = "Erev Tov"
    }

    return (
        <div>
            <h4>{greeting}, {fName}!</h4>
        </div>
    )
}

export default Welcome;