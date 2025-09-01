const normalize = (str) => {
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

const parseRevenueDate = (dateStr) => {
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
}

const formatDateDDMMYYYY = (date) => {
  if (!(date instanceof Date) || isNaN(date)) {
    return 'Invalid Date';
  }
  // Use UTC dates to avoid timezone issues from the UTC date object
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Month is 0-indexed
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

// Function to analyze multi-car contracts
// This function groups contracts by Contract No. and finds contracts with multiple different cars
const analyzeMultiCarContracts = (data) => {
    // تجميع العقود حسب رقم العقد وتجميع السيارات داخل كل عقد
    const contractGroups = {};
    const debugCounts = {};
    // دالة تطبيع رقم اللوحة
    const normalizePlate = (str) => (str || '').toString().replace(/\s+/g, '').toUpperCase();
    data.forEach(row => {
        const contractNo = row['Contract No.'];
        const plateNumberRaw = row['Plate Number'];
        const plateNumber = normalizePlate(plateNumberRaw);
        const customerName = row['Customer Name'];
        const revenueDateValue = row['Revenue Date'];
        const carModel = row['Car Model'];
        const revenueDate = parseRevenueDate(revenueDateValue);
        if (!contractNo || !plateNumber || !revenueDate) return;
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
        alert('عقود وعدد السيارات:\n' + Object.entries(debugCounts).map(([c, n]) => c + ': ' + n).join('\n'));
    });
    return results;
};


const formatDateForDisplay = (dateStr) => {
    if (!dateStr || dateStr.trim() === '') return '';
    // Takes the part before the first space, to remove the time part
    return dateStr.split(' ')[0];
};

const parseSheetDate = (dateStr) => {
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

const getLatestDateIn = (row, maintenanceData) => {
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

const isMismatch = (row) => {
    const isNumeric = !isNaN(Number(row.bookingNumber));
    const ejar = normalize(row.ejarPlate);
    const invygo = normalize(row.invygoPlate);
    return isNumeric && ejar && invygo && ejar !== invygo;
};

const getDaysSinceLatestIn = (row, maintenanceData) => {
    const latestDate = getLatestDateIn(row, maintenanceData);
    if (!latestDate) return '';
    const today = new Date();
    const diffTime = today.getTime() - latestDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : '';
};

const normalizePhoneNumber = (phone) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('05') && cleaned.length === 10) return `971${cleaned.substring(1)}`;
    if (cleaned.startsWith('971') && cleaned.length === 12) return cleaned;
    return cleaned;
};

export {
    parseRevenueDate,
    formatDateDDMMYYYY,
    analyzeMultiCarContracts,
    normalize,
    formatDateForDisplay,
    parseSheetDate,
    getLatestDateIn,
    isMismatch,
    getDaysSinceLatestIn,
    normalizePhoneNumber
};
