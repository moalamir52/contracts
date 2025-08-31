/* eslint-env worker */
/* globals XLSX, FlexSearch */

importScripts('https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js');
importScripts('https://unpkg.com/flexsearch@0.7.31/dist/flexsearch.compact.js');

let allContractsData = []; // Store processed data
let multiCarData = []; // Store processed multi-car data
let searchIndex = new FlexSearch.Document({
    tokenize: "forward",
    document: {
        id: "contract",
        index: ["contract", "Customer Name", "cars"]
    }
});


const normalize = str => (str || '').toString().replace(/\s+/g, '').toLowerCase();

onmessage = function(e) {
    console.log('Worker: Message received from main script');
    const { type, payload } = e.data;

    if (type === 'PROCESS_FILE') {
        const fileData = payload;
        try {
            const dataArr = new Uint8Array(fileData);
            const workbook = XLSX.read(dataArr, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Clear previous index data
            searchIndex = new FlexSearch.Document({
                tokenize: "forward",
                document: {
                    id: "contract",
                    index: ["contract", "Customer Name", "cars"]
                }
            });

            const contractGroups = {};
            const contractInfo = {};
            const periodDetailsMap = {};
            const normalizePlate = (str) => (str || '').toString().replace(/\s+/g, '').toUpperCase();

            const range = XLSX.utils.decode_range(worksheet['!ref']);
            let totalRows = 0;
            const contractNumbers = new Set();

            // Iterate row by row
            for (let R = range.s.r + 1; R <= range.e.r; ++R) { // +1 to skip header row
                totalRows++;
                const row = {};
                // Extract cell values by column header (assuming header is in row 1)
                const getCellValue = (colChar) => {
                    const cellAddress = colChar + R;
                    const cell = worksheet[cellAddress];
                    return cell ? (cell.t === 'n' ? cell.v : XLSX.utils.format_cell(cell)) : undefined;
                };

                const contractNo = getCellValue('A'); // Assuming Contract No. is in column A
                const plateNumberRaw = getCellValue('B'); // Assuming Plate Number is in column B
                const revenueDate = getCellValue('C'); // Assuming Revenue Date is in column C
                const pickupOdometer = getCellValue('D'); // Assuming Pickup Odometer is in column D
                const carModel = getCellValue('E'); // Assuming Car Model is in column E
                const carCategory = getCellValue('F'); // Assuming Car Category is in column F
                const manufactureYear = getCellValue('G'); // Assuming Manufacture Year is in column G
                const customerName = getCellValue('H'); // Assuming Customer Name is in column H
                const customerPhone = getCellValue('I'); // Assuming Customer Phone is in column I
                const pickupDate = getCellValue('J'); // Assuming Pick-up Date is in column J
                const dropoffDate = getCellValue('K'); // Assuming Drop-off Date is in column K

                if (!contractNo || !plateNumberRaw || !revenueDate) continue;

                contractNumbers.add(contractNo);
                const plateNumber = normalizePlate(plateNumberRaw);

                if (!contractGroups[contractNo]) contractGroups[contractNo] = {};
                if (!contractGroups[contractNo][plateNumber]) contractGroups[contractNo][plateNumber] = [];
                contractGroups[contractNo][plateNumber].push(revenueDate);

                if (!contractInfo[contractNo]) {
                    contractInfo[contractNo] = {
                        'Pick-up Date': pickupDate || '',
                        'Drop-off Date': dropoffDate || '',
                        'Plate Number': plateNumberRaw || '',
                        'Car Model': carModel || '',
                        'Car Category': carCategory || '',
                        'Manufacture Year': manufactureYear || '',
                        'Customer Name': customerName || '',
                        'Customer Phone': customerPhone || ''
                    };
                }

                const getDateStr = (d) => {
                    if (d instanceof Date && !isNaN(d)) {
                        const day = String(d.getDate()).padStart(2, '0');
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const year = d.getFullYear();
                        return `${day}/${month}/${year}`;
                    }
                    if (typeof d === 'number') {
                        const utc_days = Math.floor(d - 25569);
                        const utc_value = utc_days * 86400;
                        const date_info = new Date(utc_value * 1000);
                        const ms = Math.round((d - Math.floor(d)) * 86400 * 1000);
                        date_info.setTime(date_info.getTime() + ms);
                        const day = String(date_info.getDate()).padStart(2, '0');
                        const month = String(date_info.getMonth() + 1).padStart(2, '0');
                        const year = date_info.getFullYear();
                        return `${day}/${month}/${year}`;
                    }
                    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) {
                        const parsed = new Date(d);
                        if (!isNaN(parsed)) {
                            const day = String(parsed.getDate()).padStart(2, '0');
                            const month = String(parsed.getMonth() + 1).padStart(2, '0');
                            const year = parsed.getFullYear();
                            return `${day}/${month}/${year}`;
                        }
                    }
                    return d;
                };
                const dateKey = getDateStr(revenueDate);
                if (!periodDetailsMap[plateNumber]) periodDetailsMap[plateNumber] = {};
                periodDetailsMap[plateNumber][dateKey] = {
                    model: carModel || '',
                    category: carCategory || '',
                    year: manufactureYear || '',
                    pickupOdometer
                };
            }

            const allContractsResultRows = [];
            const multiCarResultRows = [];

            Object.entries(contractGroups).forEach(([contractNo, carsObj]) => {
                let allDates = [];
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
                allDates.sort((a, b) => new Date(a.date) - new Date(b.date));
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
                searchIndex.add(contractData); // Add to FlexSearch index

                if (uniquePlates.length > 1) {
                    multiCarResultRows.push(contractData);
                }
            });

            const stats = {
                totalRows,
                uniqueContracts: contractNumbers.size,
                multiCarContracts: multiCarResultRows.length
            };

            allContractsData = allContractsResultRows; // Store for future searches (if needed, consider removing if FlexSearch is primary)
            multiCarData = multiCarResultRows; // Store for future searches (if needed, consider removing if FlexSearch is primary)

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

        if (!searchTerm.trim()) {
            // If search term is empty, display multiCarData (which corresponds to results prop)
            postMessage({ type: 'SEARCH_RESULTS', payload: multiCarData });
            return;
        }

        const s = searchTerm.trim();

        // Perform search using FlexSearch index
        const searchResults = searchIndex.search(s, {
            enrich: true // Return the full document, not just the ID
        });

        // FlexSearch returns results grouped by index field. Flatten and get unique documents.
        const uniqueResultsMap = new Map();
        searchResults.forEach(fieldResult => {
            fieldResult.result.forEach(item => {
                uniqueResultsMap.set(item.doc.contract, item.doc); // Use contract as unique key
            });
        });

        const filteredResults = Array.from(uniqueResultsMap.values());

        postMessage({ type: 'SEARCH_RESULTS', payload: filteredResults });
    }
};