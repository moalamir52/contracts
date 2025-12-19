export const GOOGLE_SHEETS_URLS = {
    openContracts: process.env.REACT_APP_OPEN_CONTRACTS_URL,
    closedInvygo: process.env.REACT_APP_CLOSED_INV_URL,
    closedOther: process.env.REACT_APP_CLOSED_OTHER_URL,
    maintenance: process.env.REACT_APP_MAINTENANCE_URL,
    cars: process.env.REACT_APP_CARS_URL,
};

export const COLUMN_MAPPINGS = {
    open: {
        'Contract No.': 'contractNo', 'Revenue Date': 'revenueDate', 'Booking Number': 'bookingNumber', 'Customer': 'customer',
        'Model ( Ejar )': 'ejarModel', 'EJAR': 'ejarPlate', 'Model': 'invygoModel',
        'INVYGO': 'invygoPlate', 'Phone Number': 'phoneNumber', 'Pick-up Date': 'pickupDate',
        'Replacement Date': 'replacementDate', 'Drop-off Date': 'dropoffDate',
        // Likely real headers for Ejar/Invygo based on legacy code
        'Rep Plate no.': 'ejarPlate', 'Replace Model': 'ejarModel',
        'Plate No.': 'invygoPlate'
    },
    closed_invygo: {
        'Contract No.': 'contractNo', 'Revenue Date': 'revenueDate', 'Booking Number': 'bookingNumber', 'Customer': 'customer',
        'Pick-up Branch': 'pickupBranch', 'Plate No.': 'invygoPlate', 'Model': 'invygoModel',
        'Plate No. ': 'ejarPlate', 'Model ': 'model1', 'Pick-up Date': 'pickupDate',
        'Contact': 'contact', 'Drop-off Date': 'dropoffDate'
    },
    closed_other: {
        'Contract No.': 'contractNo', 'Revenue Date': 'revenueDate', 'Booking Number': 'bookingNumber', 'Customer': 'customer',
        'Pick-up Branch': 'pickupBranch', 'Plate No.': 'invygoPlate', 'Model': 'invygoModel',
        'Pick-up Date': 'pickupDate',
        'Drop-off Date': 'dropoffDate'
    }
};

export const PROXY_URL = 'https://corsproxy.io/?';

// Read-only guard
export function assertReadOnlyConfig() {
    const missing = [];
    Object.entries(GOOGLE_SHEETS_URLS).forEach(([key, url]) => {
        if (!url) missing.push(`REACT_APP_${key.toUpperCase()}_URL`);
    });
    if (missing.length > 0) {
        console.warn('Missing Environment Variables (Read-Only Mode):', missing.join(', '));
    }
}
