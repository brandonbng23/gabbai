import { ProfilePicture } from './profilePicture.tsx';
import type { ShulUser } from '../api.js';
import React, { useState } from "react";

export function UserCard({ user, nameClick, setNameClick, onRoleChange, onDiscard, onEdit, onFreeze, frozen = false, editorOpen = false, editorId, disabled = false, pendingRemoval = false, pendingRole = false, canDiscard = true, canEdit = true }: {
    user: ShulUser; nameClick: boolean; setNameClick: (click: boolean) => void;
    onRoleChange: (role: 'admin' | 'member') => void; onDiscard: () => void;
    onEdit: () => void; editorOpen?: boolean; editorId: string;
    onFreeze: () => void; frozen?: boolean;
    disabled?: boolean; pendingRemoval?: boolean; pendingRole?: boolean; canDiscard?: boolean; canEdit?: boolean;
}): React.JSX.Element {
    const [hovered, setHovered] = useState<boolean>(false);

    return (
        <div className={`user-card${hovered ? "-hover" : ""}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>          
            <div>
                <button
                    onClick={() => setNameClick(!nameClick)}
                    className="field-btn profile-picture-name"
                >
                    <ProfilePicture src={user.pictureUrl} name={`${user.firstName} ${user.lastName}`} small />
                    <span>
                    {!nameClick ?
                        !hovered ? 
                            <>
                            <span style={{ fontWeight: "200"}}>{user.title}</span> 
                            <span style={{ fontWeight: "600"}}>{` ${user.firstName} ${user.lastName}`}</span>
                            </>
                        : `${user.title} ${user.firstName} ${user.lastName}`
                    : `${user.lastName}, ${user.firstName}`}
                    </span>
                </button>
            </div>

            <div>
                {user.email}
            </div>

            <div>
                {({ admin: 'Admin', member: 'Member', guest: 'Guest' })[user.role]}
                {frozen && <span className="frozen-account-badge">Frozen</span>}
            </div>

            <div>
                <div className="action-icons">
                    <button type="button" className="freeze-user-btn" aria-pressed={frozen}
                        aria-label={`${frozen ? 'Unfreeze' : 'Freeze'} ${user.firstName} ${user.lastName}’s account`}
                        title={frozen ? 'Unfreeze account' : 'Freeze account'} disabled={disabled || pendingRemoval} onClick={onFreeze}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
                            {/* Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc. */}
                            <path d="M344.1 56C344.1 42.7 333.4 32 320.1 32C306.8 32 296.1 42.7 296.1 56L296.1 134.1L273.1 111.1C263.7 101.7 248.5 101.7 239.2 111.1C229.9 120.5 229.8 135.7 239.2 145L296.2 202L296.2 278.5L230 240.3L209.1 162.5C205.7 149.7 192.5 142.1 179.7 145.5C166.9 148.9 159.2 162 162.7 174.8L171.1 206.3L103.5 167.3C92 160.6 77.3 164.5 70.7 176C64.1 187.5 68 202.2 79.5 208.8L147.1 247.8L115.6 256.2C102.8 259.6 95.2 272.8 98.6 285.6C102 298.4 115.2 306 128 302.6L205.8 281.7L272 319.9L205.8 358.1L128 337.2C115.2 333.8 102 341.4 98.6 354.2C95.2 367 102.8 380.2 115.6 383.6L147.1 392L79.5 431C68 437.8 64.1 452.5 70.7 464C77.3 475.5 92 479.4 103.5 472.8L171.1 433.8L162.7 465.3C159.3 478.1 166.9 491.3 179.7 494.7C192.5 498.1 205.7 490.5 209.1 477.7L230 399.9L296.2 361.7L296.2 438.2L239.2 495.2C229.8 504.6 229.8 519.8 239.2 529.1C248.6 538.4 263.8 538.5 273.1 529.1L296.1 506.1L296.1 584.2C296.1 597.5 306.8 608.2 320.1 608.2C333.4 608.2 344.1 597.5 344.1 584.2L344.1 506.1L367.1 529.1C376.5 538.5 391.7 538.5 401 529.1C410.3 519.7 410.4 504.5 401 495.2L344 438.2L344 361.7L410.2 399.9L431.1 477.7C434.5 490.5 447.7 498.1 460.5 494.7C473.3 491.3 480.9 478.1 477.5 465.3L469.1 433.8L536.7 472.8C548.2 479.4 562.9 475.5 569.5 464C576.1 452.5 572.2 437.8 560.7 431.2L493.1 392.2L524.6 383.8C537.4 380.4 545 367.2 541.6 354.4C538.2 341.6 525 334 512.2 337.4L434.4 358.3L368.2 320.1L434.4 281.9L512.2 302.8C525 306.2 538.2 298.6 541.6 285.8C545 273 537.4 259.8 524.6 256.4L493.1 248L560.7 209C572.2 202.4 576.1 187.7 569.5 176.2C562.9 164.7 548.2 160.8 536.7 167.4L469.1 206.4L477.5 174.9C480.9 162.1 473.3 148.9 460.5 145.5C447.7 142.1 434.5 149.7 431.1 162.5L410.2 240.3L344 278.5L344 202L401 145C410.4 135.6 410.4 120.4 401 111.1C391.6 101.8 376.4 101.7 367.1 111.1L344.1 134.1L344.1 56z" />
                        </svg>
                    </button>
                    <button type="button" aria-label={`View ${user.firstName} ${user.lastName}'s profile`} title="View profile"
                        onClick={() => { window.location.href = `/userView?${new URLSearchParams({ user: user.id })}`; }}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M320 96C239.2 96 174.5 132.8 127.4 176.6C80.6 220.1 49.3 272 34.4 307.7C31.1 315.6 31.1 324.4 34.4 332.3C49.3 368 80.6 420 127.4 463.4C174.5 507.1 239.2 544 320 544C400.8 544 465.5 507.2 512.6 463.4C559.4 419.9 590.7 368 605.6 332.3C608.9 324.4 608.9 315.6 605.6 307.7C590.7 272 559.4 220 512.6 176.6C465.5 132.9 400.8 96 320 96zM176 320C176 240.5 240.5 176 320 176C399.5 176 464 240.5 464 320C464 399.5 399.5 464 320 464C240.5 464 176 399.5 176 320zM320 256C320 291.3 291.3 320 256 320C244.5 320 233.7 317 224.3 311.6C223.3 322.5 224.2 333.7 227.2 344.8C240.9 396 293.6 426.4 344.8 412.7C396 399 426.4 346.3 412.7 295.1C400.5 249.4 357.2 220.3 311.6 224.3C316.9 233.6 320 244.4 320 256z"/></svg>
                    </button>

                    {user.role === "member" ?
                        <button type="button" aria-label="Promote to admin" aria-pressed={pendingRole} title={pendingRole ? 'Cancel pending promotion' : 'Promote to admin'}
                            disabled={disabled || pendingRemoval} onClick={() => onRoleChange('admin')}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M285.7 368C384.2 368 464 447.8 464 546.3C464 562.7 450.7 576 434.3 576L77.7 576C61.3 576 48 562.7 48 546.3C48 447.8 127.8 368 226.3 368L285.7 368zM528 144C541.3 144 552 154.7 552 168L552 216L600 216C613.3 216 624 226.7 624 240C624 253.3 613.3 264 600 264L552 264L552 312C552 325.3 541.3 336 528 336C514.7 336 504 325.3 504 312L504 264L456 264C442.7 264 432 253.3 432 240C432 226.7 442.7 216 456 216L504 216L504 168C504 154.7 514.7 144 528 144zM256 312C189.7 312 136 258.3 136 192C136 125.7 189.7 72 256 72C322.3 72 376 125.7 376 192C376 258.3 322.3 312 256 312z"/></svg>
                        </button>
                            
                    : user.role === "admin" ? <button type="button" aria-label="Demote to member" aria-pressed={pendingRole} title={pendingRole ? 'Cancel pending demotion' : 'Demote to member'}
                        disabled={disabled || pendingRemoval} onClick={() => onRoleChange('member')}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M285.7 368C384.2 368 464 447.8 464 546.3C464 562.7 450.7 576 434.3 576L77.7 576C61.3 576 48 562.7 48 546.3C48 447.8 127.8 368 226.3 368L285.7 368zM256 312C189.7 312 136 258.3 136 192C136 125.7 189.7 72 256 72C322.3 72 376 125.7 376 192C376 258.3 322.3 312 256 312zM600 216C613.3 216 624 226.7 624 240C624 253.3 613.3 264 600 264L456 264C442.7 264 432 253.3 432 240C432 226.7 442.7 216 456 216L600 216z"/></svg>
                    </button> : null}

                    {user.role === "member" || user.role === "guest" ?
                        <button type="button" className="edit-user-btn" aria-label="Edit user" title="Edit user"
                            disabled={disabled || pendingRemoval || !canEdit} aria-expanded={editorOpen} aria-controls={editorId} onClick={onEdit}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M256.1 312C322.4 312 376.1 258.3 376.1 192C376.1 125.7 322.4 72 256.1 72C189.8 72 136.1 125.7 136.1 192C136.1 258.3 189.8 312 256.1 312zM226.4 368C127.9 368 48.1 447.8 48.1 546.3C48.1 562.7 61.4 576 77.8 576L274.3 576L285.2 521.5C289.5 499.8 300.2 479.9 315.8 464.3L383.1 397C355.1 378.7 321.7 368.1 285.7 368.1L226.3 368.1zM332.3 530.9L320.4 590.5C320.2 591.4 320.1 592.4 320.1 593.4C320.1 601.4 326.6 608 334.7 608C335.7 608 336.6 607.9 337.6 607.7L397.2 595.8C409.6 593.3 421 587.2 429.9 578.3L548.8 459.4L468.8 379.4L349.9 498.3C341 507.2 334.9 518.6 332.4 531zM600.1 407.9C622.2 385.8 622.2 350 600.1 327.9C578 305.8 542.2 305.8 520.1 327.9L491.3 356.7L571.3 436.7L600.1 407.9z"/></svg>
                        </button>
                    : null}
                
                    {canDiscard && (user.role === "member" || user.role === "guest") ?
                        <button type="button" className="discard-user-btn" aria-label="Unassociate with shul" aria-pressed={pendingRemoval}
                            title={pendingRemoval ? 'Cancel pending unassociation with shul' : 'Unassociate with shul'}
                            disabled={disabled} onClick={onDiscard}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M73 39.1C63.6 29.7 48.4 29.7 39.1 39.1C29.8 48.5 29.7 63.7 39 73.1L567 601.1C576.4 610.5 591.6 610.5 600.9 601.1C610.2 591.7 610.3 576.5 600.9 567.2L343.5 309.7C398.5 298.8 440 250.2 440 192C440 125.7 386.3 72 320 72C261.8 72 213.2 113.5 202.3 168.5L73 39.1zM267.6 369.4C179.9 380.6 112 455.5 112 546.3C112 562.7 125.3 576 141.7 576L474.2 576L267.6 369.4z"/></svg>
                        </button>
                    : null}
                </div>
            </div>
        </div>
    )
}

export type ReaderCardUser = Omit<ShulUser, 'email'>;

export function ReaderCard( {user}: {user: ReaderCardUser} ): React.JSX.Element {
    return (
        <div className="reader-card">
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", height: "45px", gap: "15px"}}>
                <ProfilePicture src={user.pictureUrl} name={`${user.firstName} ${user.lastName}`} small />
                <h2><a className="reader-profile-link" href={`/userView?${new URLSearchParams({ user: user.id })}`}>
                    {`${user.firstName} ${user.lastName}`}
                </a></h2>
            </div>
            <span>{user.role}</span>
            <span style={{padding: "0 7.5px 0 7.5px"}}>·</span>
            <span>{`${user.assignedReadings.length} Lifetime Readings`}</span>
        </div>
    )
}
