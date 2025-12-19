import React, { useRef } from 'react';

const UploadArea = ({ onFileUpload, onBookingIdUpload, uploading }) => {
    const fileInputRef = useRef(null);
    const bookingInputRef = useRef(null);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            onFileUpload(e.target.files[0]);
            // Reset input to allow selecting same file again
            e.target.value = '';
        }
    };

    const handleBookingChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            onBookingIdUpload(e.target.files[0]);
            e.target.value = '';
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0', gap: 16, flexWrap: 'wrap' }}>
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                    background: '#ffd600', color: '#6a1b9a', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'none', fontSize: 16, display: 'inline-block', minWidth: 180, textAlign: 'center', marginBottom: 0
                }}>
                ⬆️ Upload Multi-Car File
            </button>
            <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                ref={fileInputRef}
            />

            <button
                onClick={() => bookingInputRef.current?.click()}
                style={{
                    background: '#6a1b9a', color: '#ffd600', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'none', fontSize: 16, display: 'inline-block', minWidth: 180, textAlign: 'center', marginBottom: 0
                }}>
                📎 Upload Invygo ID File
            </button>
            <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleBookingChange}
                style={{ display: 'none' }}
                ref={bookingInputRef}
            />
        </div>
    );
};

export default UploadArea;
