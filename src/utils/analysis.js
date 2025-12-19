import { normalize, normalizePhoneNumber } from './normalize';
import { parseRevenueDate, formatDateDDMMYYYY, parseSheetDate } from './dates';

// Canonical analysis utilities
// PRESERVED EXACT COMPLIANCE with original src/utils.js

// Function to analyze multi-car contracts
// This function groups contracts by Contract No. and finds contracts with multiple different cars
export const analyzeMultiCarContracts = (data) => {
    // تجميع العقود حسب رقم العقد وتجميع السيارات داخل كل عقد
    const contractGroups = {};
    const debugCounts = {};
    // دالة تطبيع رقم اللوحة
    const normalizePlate = (str) => (str || '').toString().replace(/\s+/g, '').toUpperCase();
    data.forEach(row => {
        const contractNo = row['Contract No.'];
        const plateNumberRaw = row['Plate Number'];
        const plateNumber = normalizePlate(plateNumberRaw);

        // Try multiple variations for Customer and Model
        const customerName = row['Customer Name'] || row['Customer'] || row['customer'] || row['Name'] || '';
        const carModel = row['Car Model'] || row['Model'] || row['model'] || row['Vehicle'] || '';

        const revenueDateValue = row['Revenue Date'];
        const revenueDate = parseSheetDate(revenueDateValue);

        if (!contractNo || !plateNumber || !revenueDate) {
            return;
        }
        if (!contractGroups[contractNo]) {
            contractGroups[contractNo] = {
                contractNo,
                customerName,
                cars: {},
                carsRaw: {},
            };
        }
        if (!contractGroups[contractNo].cars[plateNumber]) {
            contractGroups[contractNo].cars[plateNumber] = {
                plateNumber,
                carModel,
                dates: [],
            };
            contractGroups[contractNo].carsRaw[plateNumber] = plateNumberRaw;
        }
        contractGroups[contractNo].cars[plateNumber].dates.push(revenueDate);
    });

    // تجهيز النتائج النهائية
    const results = [];
    Object.values(contractGroups).forEach(contract => {
        debugCounts[contract.contractNo] = Object.keys(contract.cars).length + ' => [' + Object.values(contract.carsRaw).join(', ') + ']';
        const carEntries = Object.values(contract.cars);
        if (carEntries.length <= 1) return; // استبعاد العقود التي بها سيارة واحدة فقط
        const carDetails = carEntries.map(car => {
            // حساب أول وآخر تاريخ
            const sortedDates = car.dates.sort((a, b) => a - b);
            return {
                plateNumber: car.plateNumber,
                carModel: car.carModel,
                from: formatDateDDMMYYYY(sortedDates[0]),
                to: formatDateDDMMYYYY(sortedDates[sortedDates.length - 1])
            };
        });
        results.push({
            contractNo: contract.contractNo,
            customerName: contract.customerName,
            carsCount: carEntries.length,
            carDetails
        });
        // Debug: عرض العقود وعدد السيارات
        // alert('عقود وعدد السيارات:\n' + Object.entries(debugCounts).map(([c, n]) => c + ': ' + n).join('\n'));
    });
    return results;
};

export const getLatestDateIn = (row, maintenanceData) => {
    if (!row || !maintenanceData || !row.invygoPlate) return null;
    const vehicleRecords = maintenanceData.filter(m => normalize(m["Vehicle"]) === normalize(row.invygoPlate));
    if (vehicleRecords.length === 0) return null;
    const datesIn = vehicleRecords.map(r => parseSheetDate(r["Date IN"])).filter(Boolean);
    const datesOut = vehicleRecords.map(r => parseSheetDate(r["Date OUT"])).filter(Boolean);
    if (datesIn.length === 0) return null;
    const latestDateIn = new Date(Math.max(...datesIn.map(d => d.getTime())));
    const latestDateOut = datesOut.length > 0 ? new Date(Math.max(...datesOut.map(d => d.getTime()))) : null;
    if (latestDateOut && latestDateOut.getTime() > latestDateIn.getTime()) return null;
    return latestDateIn;
};

export const isMismatch = (row) => {
    const isNumeric = !isNaN(Number(row.bookingNumber));
    const ejar = normalize(row.ejarPlate);
    const invygo = normalize(row.invygoPlate);
    return isNumeric && ejar && invygo && ejar !== invygo;
};

export const getDaysSinceLatestIn = (row, maintenanceData) => {
    const latestDate = getLatestDateIn(row, maintenanceData);
    if (!latestDate) return '';
    const today = new Date();
    const diffTime = today.getTime() - latestDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : '';
};
