import { normalize, normalizePhoneNumber } from '../normalize';

describe('normalize', () => {
    it('should remove special characters and whitespace', () => {
        expect(normalize(' 123 - abc ')).toBe('123abc');
    });

    it('should transliterate Cyrillic look-alikes', () => {
        const cyrillic = 'асеор'; // Cyrillic chars
        expect(normalize(cyrillic)).toBe('aceop'); // Latin
    });

    it('should sort letters after numbers', () => {
        // Original logic: returns numbers + letters
        // letters are sorted
        expect(normalize('b1a2')).toBe('12ab');
    });
});

describe('normalizePhoneNumber', () => {
    it('should format 05xxxxxxxx as 9715xxxxxxxx', () => {
        expect(normalizePhoneNumber('0501234567')).toBe('971501234567');
    });

    it('should keep 971xxxxxxxxxxxx as is', () => {
        expect(normalizePhoneNumber('971501234567')).toBe('971501234567');
    });

    it('should strip non-digits', () => {
        expect(normalizePhoneNumber('050-123-4567')).toBe('971501234567');
    });
});
