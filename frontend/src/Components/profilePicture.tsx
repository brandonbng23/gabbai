import { useId, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

export function ProfilePicture({ src, name, square = false, small = false }: {
    src?: string; name: string; square?: boolean; small?: boolean;
}) {
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
    return <span className={`profile-picture${square ? ' profile-picture-square' : ''}${small ? ' profile-picture-small' : ''}`}>
        {src && failedSrc !== src
            ? <img src={src} alt={`${name} profile picture`} onError={() => setFailedSrc(src)} />
            : <span role="img" aria-label={`${name} profile picture`}>{initials}</span>}
    </span>;
}

async function preparePicture(file: File): Promise<Blob> {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
        throw new Error('Choose a PNG, JPG, or WebP image.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
    const bitmap = await createImageBitmap(file).catch(() => { throw new Error('This image could not be opened. Choose another image.'); });
    try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 512;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Your browser could not prepare this image.');
        const size = Math.min(bitmap.width, bitmap.height);
        context.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 512, 512);
        const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('This image could not be prepared.'));
        }, 'image/png'));
        if (png.size > 1024 * 1024) throw new Error('This image has too much detail. Choose a simpler image.');
        return png;
    } finally {
        bitmap.close();
    }
}

export function PictureEditor({ pictureUrl, name, onChange, onReset, changed = false, disabled = false, square = false, showPicture = true, onBusyChange }: {
    pictureUrl?: string; name: string; onChange: (picture: string | null) => void; onReset: () => void;
    changed?: boolean; disabled?: boolean; square?: boolean; showPicture?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
    const input = useRef<HTMLInputElement>(null);
    const hintId = useId();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function selectPicture(event: ChangeEvent<HTMLInputElement>): Promise<void> {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file || disabled || busy) return;
        setBusy(true);
        onBusyChange?.(true);
        setError('');
        try {
            const png = await preparePicture(file);
            const data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(new Error('This image could not be opened.'));
                reader.readAsDataURL(png);
            });
            onChange(data);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Unable to prepare the picture.');
        } finally {
            setBusy(false);
            onBusyChange?.(false);
        }
    }

    return <div className="profile-picture-editor" aria-busy={busy}>
        {showPicture && <ProfilePicture src={pictureUrl} name={name} square={square} />}
        <div className="profile-picture-actions">
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden
                aria-label={`Choose picture for ${name}`} onChange={selectPicture} disabled={disabled || busy} />
            <div className="profile-picture-buttons">
                <button type="button" className="settings-reset-btn" disabled={disabled || busy}
                    aria-describedby={hintId} onClick={() => input.current?.click()}>
                    {busy ? 'Preparing…' : pictureUrl ? 'Change picture' : 'Upload picture'}
                </button>
                <button type="button" className="settings-field-reset" disabled={disabled || busy || !pictureUrl}
                    onClick={() => { setError(''); onChange(null); }}>Remove picture</button>
                <button type="button" className="settings-field-reset" tabIndex={-1} disabled={disabled || busy || !changed}
                    onClick={() => { setError(''); onReset(); }}>Reset</button>
            </div>
            <span id={hintId} className="profile-picture-hint">
                {square
                    ? 'Shul image: square crop. PNG, JPG, or WebP · Max 10 MB.'
                    : 'Profile photo: circular crop. PNG, JPG, or WebP · Max 10 MB.'}
            </span>
            {error ? <span className="profile-picture-feedback profile-picture-error" role="alert">{error}</span>
                : changed && <span className="profile-picture-feedback" role="status">
                    {pictureUrl ? 'Picture change ready to save.' : 'Picture will be removed when you save.'}
                </span>}
        </div>
    </div>;
}
