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

const analyzeMultiCarContracts = (data) => {
    const contractGroups = {};
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

    const results = [];
    Object.values(contractGroups).forEach(contract => {
        const carEntries = Object.values(contract.cars);
        if (carEntries.length <= 1) return;
        const carDetails = carEntries.map(car => {
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
    });
    return results;
};

self.onmessage = function(e) {
    const { fileData } = e.data;

    importScripts("https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js");

    try {
        const data = new Uint8Array(fileData);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { cellDates: true });

        const results = analyzeMultiCarContracts(jsonData);

        self.postMessage({ success: true, results });
    } catch (error) {
        self.postMessage({ success: false, error: error.message });
    }
};