// Canonical date utilities
// PRESERVED EXACT COMPLIANCE with original src/utils.js

export const parseRevenueDate = (dateStr) => {
    // Check if it's already a Date object from cellDates:true
    if (dateStr instanceof Date) {
        return dateStr;
    }
    if (typeof dateStr !== 'string' || !dateStr) {
        return null;
    }
    // Handle ISO format with 'T' and 'Z'
    if (dateStr.includes('T') && dateStr.includes('Z')) {
        return new Date(dateStr);
    }
    // Handle 'YYYY-MM-DD HH:mm:ss' format
    const parts = dateStr.split(' ')[0].split('-');
    if (parts.length === 3) {
        const [year, month, day] = parts.map(p => parseInt(p, 10));
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            // Month is 0-indexed in JavaScript Date
            return new Date(Date.UTC(year, month - 1, day));
        }
    }
    return null;
};

export const formatDateDDMMYYYY = (date) => {
    if (!(date instanceof Date) || isNaN(date)) {
        return 'Invalid Date';
    }
    // Use UTC dates to avoid timezone issues from the UTC date object
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
};

export const formatDateForDisplay = (dateStr) => {
    if (!dateStr || dateStr.trim() === '') return '';

    // Handle different date formats and remove time
    let cleanDate = dateStr.toString();

    // Remove time part if it exists (format: DD-MM-YYYYHHMM or DD/MM/YYYYHHMM)
    const dateTimeMatch = cleanDate.match(/^(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})(\d{4})?/);
    if (dateTimeMatch) {
        cleanDate = dateTimeMatch[1]; // Get only the date part
    } else {
        // Handle space-separated date and time
        cleanDate = cleanDate.split(' ')[0];
    }

    // Convert all dates to DD/MM/YYYY format
    if (cleanDate.includes('-')) {
        return cleanDate.replace(/-/g, '/');
    }

    return cleanDate;
};

export const parseSheetDate = (dateStr) => {
    if (!dateStr || dateStr.trim() === '') return null;
    const normalizedStr = dateStr.replace(/\//g, '-');
    const parts = normalizedStr.split('-');
    if (parts.length !== 3) {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    }
    let [day, month, year] = parts.map(p => parseInt(p, 10));
    if (isNaN(day) || isNaN(month) || isNaN(year)) {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    }
    if (year < 100) year += 2000;
    const d = new Date(Date.UTC(year, month - 1, day));
    return isNaN(d.getTime()) ? null : d;
};
