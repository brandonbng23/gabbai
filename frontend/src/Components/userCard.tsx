import type { ShulUser } from '../api.js';

export function UserCard({ user }: { user: ShulUser }): React.JSX.Element {
    return (
        <div className="user-card">
            <div style={{ width: "15px" }}>
                {`${user.firstName} ${user.lastName}`}
            </div>
        </div>
    )
}