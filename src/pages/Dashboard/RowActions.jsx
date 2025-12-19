import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { normalizePhoneNumber } from '../../utils/normalize';
import { isMismatch, getLatestDateIn } from '../../utils/analysis';

const RowActions = ({ row, maintenanceData, onCopy }) => {
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const buttonRef = useRef(null);

    const toggle = () => {
        if (!open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const MENU_HEIGHT = 200; // Estimated height
            const isUp = spaceBelow < MENU_HEIGHT;

            setCoords({
                top: isUp ? rect.top + window.scrollY - 5 : rect.bottom + window.scrollY + 5,
                left: rect.left + window.scrollX,
                isUp
            });
        }
        setOpen(!open);
    };

    const handleAction = (action) => {
        action.action();
        setOpen(false);
    };

    // Close on scroll to avoid detached dropdowns
    useEffect(() => {
        if (open) {
            const onScroll = () => setOpen(false);
            window.addEventListener('scroll', onScroll, true);
            return () => window.removeEventListener('scroll', onScroll, true);
        }
    }, [open]);

    const copyAndOpenWhatsApp = (row, messageTemplate, toastMsg) => {
        const normalizedPhone = normalizePhoneNumber(row.phoneNumber);
        const message = messageTemplate.replace('#XXXXXX', `#${row.bookingNumber}`);
        onCopy(message, toastMsg);
        window.open(`https://wa.me/${normalizedPhone}`, "_blank");
    };

    const options = [
        { label: '1 - Open WhatsApp', action: () => window.open(`https://wa.me/${normalizePhoneNumber(row.phoneNumber)}`, "_blank") },
        {
            label: '2 - Welcome Message', action: () => {
                const template = `Good day,\n\nThis is Mohamed from Invygo – Yelo Rent A Car. Regarding your booking (#XXXXXX), we have received a service request for the car.\n\nTo assist you as quickly as possible, please provide:\n\n* A photo of the car’s current mileage (KM)\n\n* A photo of the maintenance sticker once open driver door\n\n* or details of the issue (if available)\n\nWe are here to serve you, Thank you.`;
                copyAndOpenWhatsApp(row, template, 'Welcome message copied!');
            }
        },
        ...(isMismatch(row) && getLatestDateIn(row, maintenanceData) ? [{
            label: '3 - Switch Back Request', action: () => {
                const template = `Good day, this is Mohamed from Invygo – Yelo Rent A Car. Your original car is ready, and we need to switch it back as per your booking (#XXXXXX). Please let me know a suitable time today and share your location. Thank you!`;
                copyAndOpenWhatsApp(row, template, 'Switch back request copied!');
            }
        }] : []),
        {
            label: `${isMismatch(row) && getLatestDateIn(row, maintenanceData) ? '4' : '3'} - Close Complaint`, action: () => {
                const template = `now i will close the request maybe you will receive schedule email please ignore it, as we need to schedule a service in order to close it in the system.`;
                copyAndOpenWhatsApp(row, template, 'Complaint closing message copied!');
            }
        }
    ];

    const menu = open ? (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999 }}>
            <div
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                onClick={() => setOpen(false)}
            />
            <div style={{
                position: 'absolute',
                top: coords.top,
                left: coords.left,
                transform: coords.isUp ? 'translateY(-100%)' : 'none',
                zIndex: 10000,
                background: 'white',
                border: '1px solid #ccc',
                borderRadius: 4,
                boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                minWidth: 200
            }}>
                {options.map((opt, i) => (
                    <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); handleAction(opt); }}
                        style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', borderBottom: i < options.length - 1 ? '1px solid #eee' : 'none' }}
                        type="button"
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    ) : null;

    return (
        <>
            <button
                ref={buttonRef}
                className="phone-link"
                onClick={(e) => { e.stopPropagation(); toggle(); }}
                type="button"
                aria-haspopup="true"
                aria-expanded={open}
            >
                {row.phoneNumber}
            </button>
            {open && ReactDOM.createPortal(menu, document.body)}
        </>
    );
};

export default RowActions;
