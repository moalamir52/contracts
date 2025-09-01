import React, { useEffect } from 'react';

// Dropdown menu for phone number actions
export default function DropdownMenu({ options, position, onClose }) {
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.phone-dropdown-menu')) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onClose]);

    if (!position) return null;

    return (
        <div
            className="phone-dropdown-menu"
            style={{
                position: 'fixed',
                top: `${position.top}px`,
                left: `${position.left}px`,
                backgroundColor: 'white',
                border: '1px solid #ddd',
                borderRadius: '8px',
                boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
                zIndex: 10001,
                padding: '5px 0',
                minWidth: '200px',
            }}
        >
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {options.map((option, index) => (
                    <li
                        key={index}
                        onClick={() => { option.action(); onClose(); }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                        style={{
                            padding: '10px 15px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            color: '#333',
                            fontSize: '14px',
                            transition: 'background-color 0.2s'
                        }}
                    >
                        {option.label}
                    </li>
                ))}
            </ul>
        </div>
    );
}
