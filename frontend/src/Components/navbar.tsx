import React, { useEffect, useId, useRef, useState } from "react";
import type { User } from "../api.js";
import { ProfilePicture } from "./profilePicture";

function Navbar({ user }: { user: User | null }): React.JSX.Element {
    const [signingOut, setSigningOut] = useState(false);
    const [error, setError] = useState('');
    const [accountOpen, setAccountOpen] = useState(false);
    const accountRef = useRef<HTMLDivElement>(null);
    const accountButton = useRef<HTMLButtonElement>(null);
    const accountMenuId = useId();
    useEffect(() => {
        if (!accountOpen) return;
        function closeOutside(event: PointerEvent) {
            if (event.target instanceof Node && !accountRef.current?.contains(event.target)) setAccountOpen(false);
        }
        function closeOnEscape(event: KeyboardEvent) {
            if (event.key !== 'Escape') return;
            setAccountOpen(false);
            accountButton.current?.focus();
        }
        document.addEventListener('pointerdown', closeOutside);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOutside);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [accountOpen]);
    const next = window.location.pathname + window.location.search;
    const signinUrl = `/signin?${new URLSearchParams({ next })}`;
    async function signout() {
        if (signingOut) return;
        setSigningOut(true);
        setError('');
        try {
            const response = await fetch('/api/auth/signout', { method: 'POST' });
            if (!response.ok) throw new Error('Unable to sign out. Try again.');
            window.location.replace('/signin');
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Unable to sign out.');
            setSigningOut(false);
        }
    }
    return (
        <nav className="navbar navbar-expand-lg">
            <div className="container-fluid">
                <span>
                    <a className="navbar-brand" href="/">Gabbai</a>
                    <span className="vert-divider"></span>
                    <span className="dashboard-label">Dashboard</span>
                </span>

                <button type="button" className="alpha-btn">Alpha</button>
                <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-tager="#nabarNavAltMarkup" aria-controls="navbarNavAltMarkup" aria-label="Toggle navigation">
                    <span className="navbar-toggler-icon"></span>
                </button>

                <div className="collapse navbar-collapse" id="navbarNavAltMarkup">
                </div>

                <div ref={accountRef} className="navbar-nav ms-auto navbar-account-actions"
                    onBlur={event => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setAccountOpen(false);
                    }}>
                    {user ? <>
                        <button ref={accountButton} type="button" className="navbar-account-toggle"
                            title="My account" aria-label="My account" aria-expanded={accountOpen} aria-controls={accountMenuId}
                            onClick={() => setAccountOpen(open => !open)}>
                            <ProfilePicture src={user.pictureUrl} name={`${user.firstName} ${user.lastName}`} small />
                        </button>
                        {accountOpen && <div id={accountMenuId} className="navbar-account-dropdown" aria-label="My account">
                            <a href={`/userView?${new URLSearchParams({ user: user.id })}`}>View profile</a>
                            <a href="/userSettings">Edit profile</a>
                            <button type="button" disabled={signingOut} onClick={() => { void signout(); }}>
                                {signingOut ? 'Signing out…' : 'Sign out'}
                            </button>
                            {error && <span className="navbar-auth-error" role="alert">{error}</span>}
                        </div>}
                    </> : <a className="navbar-link account" href={signinUrl} title="Sign in" aria-label="Sign in">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M463 448.2C440.9 409.8 399.4 384 352 384L288 384C240.6 384 199.1 409.8 177 448.2C212.2 487.4 263.2 512 320 512C376.8 512 427.8 487.3 463 448.2zM64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320zM320 336C359.8 336 392 303.8 392 264C392 224.2 359.8 192 320 192C280.2 192 248 224.2 248 264C248 303.8 280.2 336 320 336z"/></svg>
                    </a>}
                </div>
            </div>
        </nav>
    );
}

export default Navbar;
