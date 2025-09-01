import React from 'react';

// Simple modal to display contract data
export default function ContractModal({ contract, onClose }) {
  if (!contract) return null;

  const displayNames = {
    contractNo: 'Contract No.',
    revenueDate: 'Revenue Date',
    bookingNumber: 'Booking Number',
    customer: 'Customer',
    invygoModel: 'Model',
    invygoPlate: 'Plate No.',
    ejarModel: 'Replace Model',
    ejarPlate: 'Rep Plate no.',
    phoneNumber: 'Phone Number',
    pickupBranch: 'Pick-up Branch',
    pickupDate: 'Pick-up Date',
    replacementDate: 'Replacement Date',
    dropoffDate: 'Drop-off Date',
    model1: 'Model (Repeated)',
    contact: 'Contact',
    contractType: 'Contract Type'
  };

  const finalDisplayContract = {};
  for(const key in contract) {
    if(displayNames[key] && contract[key]) {
      finalDisplayContract[displayNames[key]] = contract[key];
    }
  }

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex',
        alignItems: 'center', justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff9e5', borderRadius: 20, width: '90%',
          maxWidth: 550, boxShadow: '0 6px 24px rgba(0,0,0,0.25)', 
          border: '2px solid #6a1b9a',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            backgroundColor: '#ffd600', padding: '12px 20px',
            borderBottom: '2px solid #6a1b9a'
        }}>
            <h2 style={{ color: '#6a1b9a', margin: 0, fontSize: '22px' }}>Contract Details</h2>
            <button
              onClick={onClose}
              style={{
                background: '#6a1b9a', color: '#ffd600', border: 'none', 
                borderRadius: '50%', width: 30, height: 30,
                fontWeight: 'bold', cursor: 'pointer', fontSize: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              X
            </button>
        </div>
        <div style={{padding: '20px', maxHeight: '70vh', overflowY: 'auto'}}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {Object.entries(finalDisplayContract).map(([key, val], index) => (
                  <tr key={key} style={{ backgroundColor: index % 2 === 0 ? '#fffde7' : '#fff' }}>
                    <td style={{ fontWeight: 'bold', padding: '10px', borderBottom: '1px solid #eee', color: '#6a1b9a', width: '40%' }}>{key}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
