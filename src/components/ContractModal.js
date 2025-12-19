import React, { useEffect, useRef } from 'react';
import { formatDateForDisplay } from '../utils/dates';

const ContractModal = ({ contract, onClose }) => {
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const focusable = modalRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!contract) return null;

  const fields = [
    { label: 'Contract No.', key: row => row.contractNo || row['Contract No.'] },
    { label: 'Booking Number', key: row => row.bookingNumber || row['Booking Number'] },
    { label: 'Customer', key: row => row.customer || row['Customer Name'] },
    { label: 'Phone', key: row => row.phoneNumber || row['Phone Number'] },
    { label: 'Type', key: row => row.contractType || row.type },
    { label: 'Status', key: row => row.status || 'Active' },
    { label: 'Invygo Model', key: row => row.invygoModel || row['Model'] },
    { label: 'Invygo Plate', key: row => row.invygoPlate || row['INVYGO'] },
    { label: 'Ejar Model', key: row => row.ejarModel || row['Model ( Ejar )'] },
    { label: 'Ejar Plate', key: row => row.ejarPlate || row['EJAR'] },
    { label: 'Pick-up Date', key: row => formatDateForDisplay(row.pickupDate || row['Pick-up Date']) },
    { label: 'Drop-off Date', key: row => formatDateForDisplay(row.dropoffDate || row['Drop-off Date']) },
    { label: 'Replacement Date', key: row => formatDateForDisplay(row.replacementDate || row['Replacement Date']) },
    { label: 'Pick-up Branch', key: row => row.pickupBranch || row['Pick-up Branch'] },
  ];

  const validFields = fields.filter(f => f.key(contract));

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      role="button"
      tabIndex={-1}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        style={{
          backgroundColor: '#fff', padding: '24px', borderRadius: '12px',
          maxWidth: '600px', width: '90%', maxHeight: '90vh',
          overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          cursor: 'default'
        }}
        onClick={e => e.stopPropagation()}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div style={{
          marginBottom: '20px', paddingBottom: '10px',
          borderBottom: '2px solid #ffd600', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h2 id="modal-title" style={{ margin: 0, color: '#6a1b9a' }}>Contract Details</h2>
          <button
            ref={closeButtonRef}
            style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#6a1b9a' }}
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <div>
          {validFields.map((field, index) => (
            <div key={index} style={{ display: 'flex', marginBottom: '12px', borderBottom: '1px solid #f0f0f0', paddingBottom: '8px' }}>
              <div style={{ fontWeight: 'bold', width: '180px', color: '#6a1b9a', flexShrink: 0 }}>{field.label}:</div>
              <div style={{ flexGrow: 1, wordBreak: 'break-word' }}>{field.key(contract)}</div>
            </div>
          ))}
          {contract.issue && (
            <div style={{ display: 'flex', marginBottom: '12px', color: 'red' }}>
              <div style={{ fontWeight: 'bold', width: '180px' }}>Reported Issue:</div>
              <div style={{ fontWeight: 'bold' }}>{contract.issue}</div>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right', marginTop: '20px' }}>
          <button
            onClick={onClose}
            style={{ padding: '10px 20px', background: '#6a1b9a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContractModal;
