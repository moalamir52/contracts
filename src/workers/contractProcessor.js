/* eslint-env worker */
/* globals XLSX */

importScripts('https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js');

onmessage = function(e) {
    console.log('Worker: Message received from main script');
    const fileData = e.data;

    try {
        const dataArr = new Uint8Array(fileData);
        const workbook = XLSX.read(dataArr, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { cellDates: true });

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
            model: row['Car Model'] || '',
            category: row['Car Category'] || '',
            year: row['Manufacture Year'] || '',
            pickupOdometer
          };
        });

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
          if (uniquePlates.length > 1) {
            multiCarResultRows.push(contractData);
          }
        });

        const stats = {
            totalRows,
            uniqueContracts: uniqueContractsCount,
            multiCarContracts: multiCarResultRows.length
        };

        postMessage({ allContractsResultRows, multiCarResultRows, stats });

    } catch (error) {
        console.error('Worker error:', error);
        postMessage({ error: error.message });
    }
}