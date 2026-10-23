import { useRef, useState } from 'react';
import type { SubmitEvent } from 'react';
import { userTitles } from '../../../interfaces/titles.mts';

function authReturnPath(value: string | null): string {
    if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
    try {
        const path = new URL(value, window.location.origin);
        if (path.origin !== window.location.origin || ['/signin', '/signup'].includes(path.pathname.replace(/\/$/, ''))) return '/';
        return path.pathname + path.search + path.hash;
    } catch { return '/'; }
}

function ShulCodeField() {
    const [letters, setLetters] = useState(['', '', '', '']);
    const inputs = useRef<(HTMLInputElement | null)[]>([]);

    function enterCode(value: string, position: number) {
        const code = value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 4);
        if (!code) return;
        const start = code.length === 4 ? 0 : position;
        const next = [...letters];
        for (let index = start; index < Math.min(start + code.length, 4); index++) next[index] = code[index - start];
        setLetters(next);
        inputs.current[Math.min(start + code.length, 3)]?.focus();
    }

    return <div className="auth-field auth-code-field" role="group" aria-labelledby="auth-code-label" aria-describedby="auth-code-hint">
        <label id="auth-code-label" htmlFor="auth-shulCode">Shul code</label>
        <div className="auth-code-slots">
            {letters.map((letter, index) => <input key={index}
                ref={input => { inputs.current[index] = input; }}
                id={index === 0 ? 'auth-shulCode' : `auth-shulCode-${index + 1}`}
                className={`auth-code-letter${letter ? ' auth-code-letter-filled' : ''}`} value={letter} type="text" inputMode="text"
                required pattern="[A-Z]" maxLength={4} autoCapitalize="characters" autoComplete="off" spellCheck={false}
                aria-label={`Shul code, letter ${index + 1} of 4`} aria-describedby="auth-code-hint"
                onFocus={event => event.currentTarget.select()}
                onChange={event => {
                    if (!event.target.value) setLetters(previous => previous.map((value, at) => at === index ? '' : value));
                    else enterCode(event.target.value, index);
                }}
                onPaste={event => {
                    event.preventDefault();
                    enterCode(event.clipboardData.getData('text'), index);
                }}
                onKeyDown={event => {
                    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                        event.preventDefault();
                        inputs.current[Math.max(0, Math.min(3, index + (event.key === 'ArrowLeft' ? -1 : 1)))]?.focus();
                    } else if (event.key === 'Backspace' && !letter && index > 0) {
                        event.preventDefault();
                        setLetters(previous => previous.map((value, at) => at === index - 1 ? '' : value));
                        inputs.current[index - 1]?.focus();
                    }
                }} />)}
        </div>
        <input type="hidden" name="shulCode" value={letters.join('')} />
        <span id="auth-code-hint" className="auth-hint">Enter your shul’s four-letter code, or DEMO to try it out.</span>
    </div>;
}

export function AuthPage({ mode }: { mode: 'signin' | 'signup' }) {
    const signup = mode === 'signup';
    const currentPath = window.location.pathname + window.location.search;
    const next = authReturnPath(new URLSearchParams(window.location.search).get('next')
        ?? (['/signin', '/signup'].includes(window.location.pathname.replace(/\/$/, '')) ? '/' : currentPath));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const otherUrl = `${signup ? '/signin' : '/signup'}?${new URLSearchParams({ next })}`;

    async function submit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        const form = new FormData(event.currentTarget);
        const value = (key: string) => String(form.get(key) ?? '');
        const password = value('password');
        setError('');
        if (signup && password !== value('confirmPassword')) { setError('Your passwords don’t match.'); return; }
        setBusy(true);
        try {
            const details = signup ? { title: value('title'), firstName: value('firstName').trim(), lastName: value('lastName').trim(),
                shulCode: value('shulCode').trim().toUpperCase() } : {};
            const response = await fetch(`/api/auth/${mode === 'signup' ? 'register' : 'signin'}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: value('email').trim(), password, ...details }),
            });
            if (!response.ok) {
                const failure = await response.json().catch(() => null);
                throw new Error(failure?.error || 'Unable to sign in. Please try again.');
            }
            window.location.assign(next);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Unable to sign in. Please try again.');
            setBusy(false);
        }
    }

    return <main className="auth-page">
        <a className="auth-brand" href="/">Gabbai</a>
        <section className={`auth-card${signup ? ' auth-card-signup' : ''}`} aria-labelledby="auth-heading">
            <span className="settings-eyebrow">WELCOME TO GABBAI</span>
            <h1 id="auth-heading">{signup ? 'Create your account' : 'Sign in'}</h1>
            <p>{signup ? 'Join your congregation using the shul code provided by your administrator.' : 'Your shul, readings, and preferences in one place.'}</p>
            <form onSubmit={submit}>
                <fieldset disabled={busy}>
                    <legend className="visually-hidden">{signup ? 'Create account' : 'Sign in'}</legend>
                    {signup && <>
                        <ShulCodeField />
                        <div className="auth-name-fields">
                            <div className="auth-field"><label htmlFor="auth-title">Title</label>
                                <select id="auth-title" name="title" autoComplete="honorific-prefix" required defaultValue="">
                                    <option value="" disabled>Select</option>
                                    {userTitles.map(title => <option key={title} value={title}>{title}</option>)}
                                </select>
                            </div>
                            <div className="auth-field"><label htmlFor="auth-firstName">First name</label><input id="auth-firstName" name="firstName" autoComplete="given-name" required maxLength={254} /></div>
                            <div className="auth-field"><label htmlFor="auth-lastName">Last name</label><input id="auth-lastName" name="lastName" autoComplete="family-name" required maxLength={254} /></div>
                        </div>
                    </>}
                    <div className="auth-field"><label htmlFor="auth-email">Email</label><input id="auth-email" name="email" type="email" autoComplete="username" required maxLength={254} /></div>
                    <div className={signup ? 'auth-pair' : undefined}>
                        <div className="auth-field"><label htmlFor="auth-password">Password</label>
                            <input id="auth-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'}
                                required minLength={signup ? 12 : 1} maxLength={128} aria-describedby={signup ? 'auth-password-hint' : undefined} />
                        </div>
                        {signup && <div className="auth-field"><label htmlFor="auth-confirmPassword">Confirm password</label>
                            <input id="auth-confirmPassword" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={12} maxLength={128} />
                        </div>}
                    </div>
                    <div className="auth-password-options">
                        {signup && <span id="auth-password-hint">Use 12–128 characters.</span>}
                        <label><input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} />Show password</label>
                    </div>
                    {error && <p className="auth-error" role="alert">{error}</p>}
                    <button className="auth-submit" type="submit">{busy ? signup ? 'Creating account…' : 'Signing in…' : signup ? 'Create account' : 'Sign in'}</button>
                    {busy && <span className="visually-hidden" role="status">{signup ? 'Creating your account' : 'Signing in'}</span>}
                </fieldset>
            </form>
            <p className="auth-switch">{signup ? 'Already have an account?' : 'New to Gabbai?'} <a href={otherUrl}>{signup ? 'Sign in' : 'Create an account'}</a></p>
        </section>
    </main>;
}
