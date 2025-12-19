import { parseRevenueDate, formatDateDDMMYYYY, parseSheetDate } from '../dates';

describe('parseRevenueDate', () => {
    it('should parse ISO string with T and Z', () => {
        const date = parseRevenueDate('2023-01-01T10:00:00Z');
        expect(date).toBeInstanceOf(Date);
        expect(date.toISOString()).toContain('2023-01-01');
    });

    it('should parse YYYY-MM-DD HH:mm:ss', () => {
        const date = parseRevenueDate('2023-05-15 12:00:00');
        expect(date).toBeInstanceOf(Date);
        // Note: The function uses Date.UTC with month-1.
        // 2023, 5-1 (Apr), 15 => 2023-04-15 ???
        // Wait -> parseInt(month, 10) - 1. 
        // If input is 05 (May), it becomes 4 (May index? No Jan=0, May=4).
        // So 2023-05-15 -> UTC(2023, 4, 15) -> 2023-05-15.
        // Let's verify via formatting
        expect(date.getUTCMonth()).toBe(4); // May
        expect(date.getUTCDate()).toBe(15);
    });
});

describe('formatDateDDMMYYYY', () => {
    it('should format date correctly', () => {
        const d = new Date(Date.UTC(2023, 11, 25)); // Dec 25
        expect(formatDateDDMMYYYY(d)).toBe('25/12/2023');
    });
});

describe('parseSheetDate', () => {
    it('should parse DD-MM-YYYY', () => {
        const d = parseSheetDate('25-12-2023');
        expect(d).toBeInstanceOf(Date);
        expect(d.getUTCFullYear()).toBe(2023);
        expect(d.getUTCMonth()).toBe(11);
    });

    it('should handle / separator', () => {
        const d = parseSheetDate('25/12/2023');
        expect(d).toBeInstanceOf(Date);
        expect(d.getUTCFullYear()).toBe(2023);
    });

    it('should handle short year < 100', () => {
        const d = parseSheetDate('01-01-23');
        expect(d.getUTCFullYear()).toBe(2023);
    });
});
