/* eslint-env worker */
/* globals XLSX */

importScripts('https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js');

let allContractsData = []; // Store processed data
let multiCarData = []; // Store processed multi-car data

const excelDateToJS = (serial) => {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  const ms = Math.round((serial - Math.floor(serial)) * 86400 * 1000);
  date_info.setTime(date_info.getTime() + ms);
  return date_info;
};

const formatDate = d => {
  if (d instanceof Date && !isNaN(d)) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) {
    const [y, m, rest] = d.split('-');
    const [dd] = rest.split('T')[0].split(' ');
    return `${dd}/${m}/${y}`;
  }
  return d;
};

const normalize = str => (str || '').toString().replace(/\s+/g, '').toLowerCase();

onmessage = function(e) {
    console.log('Worker: Message received from main script');
    const { type, payload } = e.data;

    if (type === 'PROCESS_FILE') {
        const fileData = payload;
        try {
            console.log('Worker: Starting XLSX.read');
            const dataArr = new Uint8Array(fileData);
            const workbook = XLSX.read(dataArr, { type: 'array' });
            console.log('Worker: Finished XLSX.read, starting sheet_to_json');
            const sheetName = workbook.SheetNames[0];
            const worksheet = XLSX.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { cellDates: true });
            console.log('Worker: Finished sheet_to_json, starting jsonData.forEach');

            const totalRows = jsonData.length;
            const contractNumbers = new Set(jsonData.map(row => row['Contract No.']).filter(Boolean));
            const uniqueContractsCount = contractNumbers.size;

            const contractGroups = {};
            const contractInfo = {};
            const periodDetailsMap = {};
            const normalizePlate = (str) => (str || '').toString().replace(/\s+/g, '').toUpperCase();
            
            jsonData.forEach(row => {
              const contractNo = row['Contract No.'];
              const plateNumberRaw = row['Plate Number'];
              const plateNumber = normalizePlate(plateNumberRaw);
              const revenueDate = row['Revenue Date'];
              const pickupOdometer = row['Pickup Odometer'] || '';
              if (!contractNo || !plateNumber || !revenueDate) return;
              if (!contractGroups[contractNo]) contractGroups[contractNo] = {};
              if (!contractGroups[contractNo][plateNumber]) contractGroups[contractNo][plateNumber] = [];
              contractGroups[contractNo][plateNumber].push(revenueDate);
              if (!contractInfo[contractNo]) {
                contractInfo[contractNo] = {
                  'Pick-up Date': row['Pick-up Date'] || '',
                  'Drop-off Date': row['Drop-off Date'] || '',
                  'Plate Number': plateNumberRaw || '',
                  'Car Model': row['Car Model'] || '',
                  'Car Category': row['Car Category'] || '',
                  'Manufacture Year': row['Manufacture Year'] || '',
                  'Customer Name': row['Customer Name'] || '',
                  'Customer Phone': row['Customer Phone'] || ''
                };
              }
              const getDateStr = (d) => {
                let dateObj = d;
                if (typeof d === 'number') {
                  // Assuming Excel serial date
                  const utc_days = Math.floor(d - 25569);
                  const utc_value = utc_days * 86400;
                  dateObj = new Date(utc_value * 1000);
                  const ms = Math.round((d - Math.floor(d)) * 86400 * 1000);
                  dateObj.setTime(dateObj.getTime() + ms);
                } else if (typeof d === 'string') {
                  // Try to parse string dates
                  const parsed = new Date(d);
                  if (!isNaN(parsed)) {
                    dateObj = parsed;
                  } else {
                    return d; // Return original string if not a valid date string
                  }
                }

                if (dateObj instanceof Date && !isNaN(dateObj)) {
                  const day = String(dateObj.getDate()).padStart(2, '0');
                  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                  const year = String(dateObj.getFullYear());
                  return `${day}/${month}/${year}`;
                }
                return d; // Fallback if not a recognized date type
              };
              const dateKey = getDateStr(revenueDate);
              if (!periodDetailsMap[plateNumber]) periodDetailsMap[plateNumber] = {};
              periodDetailsMap[plateNumber][dateKey] = {
                model: row['Car Model'] || '',
                category: row['Car Category'] || '',
                year: row['Manufacture Year'] || '',
                pickupOdometer
              };
            });
            console.log('Worker: Finished jsonData.forEach, starting contractGroups processing');

            const allContractsResultRows = [];
            const multiCarResultRows = [];

            

            Object.entries(contractGroups).forEach(([contractNo, carsObj]) => {
              let allDates = [];
              Object.entries(carsObj).forEach(([plate, arr]) => {
                arr.forEach(d => {
                  let dateObj = d;
                  if (typeof d === 'number') dateObj = excelDateToJS(d);
                  else if (typeof d === 'string') {
                    const parsed = new Date(d);
                    if (!isNaN(parsed)) dateObj = parsed;
                  }
                  allDates.push({ plate, date: dateObj });
                });
              });
              allDates.sort((a, b) => a.date - b.date);
              let periods = [];
              let prevPlate = null, periodStart = null, periodEnd = null, periodStartRevenueDate = null;
              allDates.forEach((entry, idx) => {
                const { plate, date } = entry;
                if (plate !== prevPlate) {
                  if (prevPlate !== null) {
                    periods.push({ plate: prevPlate, from: formatDate(periodStart), to: formatDate(periodEnd), revenueDate: periodStartRevenueDate });
                  }
                  periodStart = date;
                  periodStartRevenueDate = entry.date instanceof Date ? entry.date.toISOString() : entry.date;
                }
                periodEnd = date;
                prevPlate = plate;
                if (idx === allDates.length - 1) {
                  periods.push({ plate, from: formatDate(periodStart), to: formatDate(periodEnd), revenueDate: periodStartRevenueDate });
                }
              });

              const carsArr = periods.map(p => {
                let details = (periodDetailsMap[p.plate] && periodDetailsMap[p.plate][p.from]) || {};
                if (!details.pickupOdometer) {
                  const allDetails = periodDetailsMap[p.plate];
                  if (allDetails) {
                    const firstKey = Object.keys(allDetails)[0];
                    details = allDetails[firstKey];
                  }
                }
                return `${p.plate} | ${details.model || '-'} | ${details.category || '-'} | ${details.year || '-'} | Pickup Odometer: ${details.pickupOdometer || '-'} (${p.from} - ${p.to})`;
              });
              const uniquePlates = Array.from(new Set(periods.map(p => p.plate)));
              
              const contractData = {
                contract: contractNo,
                cars: carsArr,
                carsCount: uniquePlates.length,
                ...contractInfo[contractNo]
              };

              allContractsResultRows.push(contractData);
              if (uniquePlates.length > 1) {
                multiCarResultRows.push(contractData);
              }
            });
            console.log('Worker: Finished contractGroups processing, sending results');

            const stats = {
                totalRows,
                uniqueContracts: uniqueContractsCount,
                multiCarContracts: multiCarResultRows.length
            };

            allContractsData = allContractsResultRows; // Store for future searches
            multiCarData = multiCarResultRows; // Store for future searches

            console.log('Worker: Sending FILE_PROCESSED message');
            postMessage({ type: 'FILE_PROCESSED', payload: { allContractsResultRows, multiCarResultRows, stats } });

        } catch (error) {
            console.error('Worker error:', error);
            postMessage({ type: 'ERROR', payload: error.message });
        }
    } else if (type === 'INITIALIZE_DATA') {
        // This message type is to initialize the worker's internal data from the main thread
        // This is useful if the data is processed elsewhere and then passed to the worker for search.
        allContractsData = payload.allUniqueContracts;
        multiCarData = payload.results; // Assuming 'results' corresponds to multiCarData
        // Optionally, send back a confirmation or initial search results
        postMessage({ type: 'SEARCH_RESULTS', payload: multiCarData }); // Send initial display data
    } else if (type === 'SEARCH_DATA') {
        const { searchTerm } = payload;
        // Decide which data to search based on the current context.
        // If the search term is empty, we display `multiCarData` (which corresponds to `results` prop).
        // If there's a search term, we search `allContractsData` (which corresponds to `allUniqueContracts` prop).
        const sourceData = searchTerm.trim() ? allContractsData : multiCarData;
        
        if (!searchTerm.trim()) {
            postMessage({ type: 'SEARCH_RESULTS', payload: sourceData });
            return;
        }

        const s = searchTerm.trim().toLowerCase();
        const sNorm = normalize(s);

        const filteredResults = sourceData.filter(row => {
            if (row.contract && (row.contract.toLowerCase().includes(s) || normalize(row.contract).includes(sNorm))) return true;
            if (row.cars && row.cars.some(c => c.toLowerCase().includes(s) || normalize(c).includes(sNorm))) return true;
            if (row.carsCount && row.carsCount.toString() === s) return true;
            if (row['Customer Name'] && (row['Customer Name'].toLowerCase().includes(s) || normalize(row['Customer Name']).includes(sNorm))) return true;
            return false;
        });
        postMessage({ type: 'SEARCH_RESULTS', payload: filteredResults });
    }
};