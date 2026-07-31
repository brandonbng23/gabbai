function Welcome({ name }) {

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
        <h4>{greeting}, {name}!</h4>
    )
}

export default Welcome;