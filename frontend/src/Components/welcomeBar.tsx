export function getGreeting(): string {
    const hour = new Date().getHours();

    if (hour < 12) {
        return "Boker Tov";
    } else if (hour < 18) {
        return "Tazaharayim Tovim";
    } else {
        return "Erev Tov";
    }
}

function WelcomeBar({ fName }: { fName?: string }) {
    return (
        <div className="welcome-bar">
            <h4>{getGreeting()}{fName ? `, ${fName}` : ''}!</h4>
        </div>
    );
}

export default WelcomeBar;
