// Canonical normalization functions
// PRESERVED EXACT COMPLIANCE with original src/utils.js

export const normalize = (str) => {
    if (!str) return "";
    let s = str.toLowerCase();
    // Transliterate common Cyrillic look-alikes to Latin
    s = s.replace(/а/g, 'a');
    s = s.replace(/с/g, 'c');
    s = s.replace(/е/g, 'e');
    s = s.replace(/о/g, 'o');
    s = s.replace(/р/g, 'p');

    const cleanStr = s.replace(/[^a-z0-9]/g, '');
    const letters = (cleanStr.match(/[a-z]/g) || []).sort().join('');
    const numbers = (cleanStr.match(/[0-9]/g) || []).join('');
    return numbers + letters;
};

export const normalizePhoneNumber = (phone) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('05') && cleaned.length === 10) return `971${cleaned.substring(1)}`;
    if (cleaned.startsWith('971') && cleaned.length === 12) return cleaned;
    return cleaned;
};
