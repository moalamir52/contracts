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

export const normalize = (str) => {
    if (!str) return "";
    let s = str.toLowerCase();
    // Transliterate common Cyrillic look-alikes to Latin
    s = s.replace(/а/g, 'a');
    s = s.replace(/с/g, 'c');
    s = s.replace(/е/g, 'e');
    s = s.replace(/о/g, 'o');
    s = s.replace(/р/g, 'r');
    
    const cleanStr = s.replace(/[^a-z0-9]/g, '');
    const letters = (cleanStr.match(/[a-z]/g) || []).sort().join('');
    const numbers = (cleanStr.match(/[0-9]/g) || []).join('');
    return numbers + letters;
};

export const formatDateForDisplay = (dateStr) => {
    if (!dateStr || dateStr.trim() === '') return '';
    // Takes the part before the first space, to remove the time part
    return dateStr.split(' ')[0];
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

export const normalizePhoneNumber = (phone) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('05') && cleaned.length === 10) return `971${cleaned.substring(1)}`;
    if (cleaned.startsWith('971') && cleaned.length === 12) return cleaned;
    return cleaned;
};
