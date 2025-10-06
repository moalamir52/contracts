importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');

self.onmessage = function(e) {
  const { fileData } = e.data;
  
  try {
    console.log('Worker: Starting file processing...');
    
    const workbook = XLSX.read(fileData, { type: 'array', cellDates: true, codepage: 65001 });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { cellDates: true, raw: false });
    
    console.log('Worker: JSON data extracted, rows:', jsonData.length);
    
    const contractGroups = {};
    const contractInfo = {};
    const periodDetailsMap = {};
    const normalizePlate = (str) => (str || '').toString().replace(/\s+/g, '').toUpperCase();
    
    // معالجة النصوص العربية
    const processArabicText = (text) => {
      if (!text) return text;
      let processed = text.toString();
      // إزالة BOM
      processed = processed.replace(/\uFEFF/g, '');
      // إزالة المسافات الزائدة
      processed = processed.trim();
      // معالجة الترميز المكسور
      try {
        if (processed.includes('?')) {
          // محاولة فك الترميز
          const bytes = new TextEncoder().encode(processed);
          processed = new TextDecoder('utf-8').decode(bytes);
        }
      } catch (e) {}
      return processed;
    };

    // معالجة البيانات
    jsonData.forEach((row, index) => {
      if (index % 5000 === 0) {
        self.postMessage({ progress: `Processing row ${index} of ${jsonData.length}` });
      }
      
      const contractNo = processArabicText(row['Contract No.']);
      const plateNumberRaw = processArabicText(row['Plate Number']);
      const plateNumber = normalizePlate(plateNumberRaw);
      const revenueDate = row['Revenue Date'];
      const pickupOdometer = processArabicText(row['Pickup Odometer']) || '';
      
      if (!contractNo || !plateNumber || !revenueDate) return;
      
      if (!contractGroups[contractNo]) contractGroups[contractNo] = {};
      if (!contractGroups[contractNo][plateNumber]) contractGroups[contractNo][plateNumber] = [];
      contractGroups[contractNo][plateNumber].push(revenueDate);
      
      if (!contractInfo[contractNo]) {
        contractInfo[contractNo] = {
          'Pick-up Date': processArabicText(row['Pick-up Date']) || '',
          'Drop-off Date': processArabicText(row['Drop-off Date']) || '',
          'Plate Number': plateNumberRaw || '',
          'Car Model': processArabicText(row['Car Model']) || '',
          'Car Category': processArabicText(row['Car Category']) || '',
          'Manufacture Year': processArabicText(row['Manufacture Year']) || '',
          'Customer Name': processArabicText(row['Customer Name']) || '',
          'Customer Phone': processArabicText(row['Customer Phone']) || ''
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
        return d;
      };
      
      const dateKey = getDateStr(revenueDate);
      if (!periodDetailsMap[plateNumber]) periodDetailsMap[plateNumber] = {};
      periodDetailsMap[plateNumber][dateKey] = {
        model: processArabicText(row['Car Model']) || '',
        category: processArabicText(row['Car Category']) || '',
        year: processArabicText(row['Manufacture Year']) || '',
        pickupOdometer
      };
    });

    console.log('Worker: Processing contracts...');
    const resultRows = [];
    let singleCarContractsCount = 0;

    Object.entries(contractGroups).forEach(([contractNo, carsObj]) => {
      const uniquePlatesInContract = Object.keys(carsObj);
      if (uniquePlatesInContract.length <= 1) {
        singleCarContractsCount++;
        return;
      }

      let allDates = [];
      const formatDate = d => {
        if (d instanceof Date && !isNaN(d)) {
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          return `${day}/${month}/${year}`;
        }
        return d;
      };

      Object.entries(carsObj).forEach(([plate, arr]) => {
        arr.forEach(d => {
          let dateObj = d;
          if (typeof d === 'string') {
            const parsed = new Date(d);
            if (!isNaN(parsed)) dateObj = parsed;
          }
          allDates.push({ plate, date: dateObj });
        });
      });
      
      allDates.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      let periods = [];
      let prevPlate = null, periodStart = null, periodEnd = null;
      allDates.forEach((entry, idx) => {
        const { plate, date } = entry;
        if (plate !== prevPlate) {
          if (prevPlate !== null) {
            periods.push({ plate: prevPlate, from: formatDate(periodStart), to: formatDate(periodEnd) });
          }
          periodStart = date;
        }
        periodEnd = date;
        prevPlate = plate;
        if (idx === allDates.length - 1) {
          periods.push({ plate, from: formatDate(periodStart), to: formatDate(periodEnd) });
        }
      });

      if (periods.length <= 1) return;

      const carsArr = periods.map(p => {
        let details = (periodDetailsMap[p.plate] && periodDetailsMap[p.plate][p.from]) || {};
        return `${p.plate} | ${details.model || '-'} | ${details.category || '-'} | ${details.year || '-'} | Pickup Odometer: ${details.pickupOdometer || '-'} (${p.from} - ${p.to})`;
      });
      
      const uniquePlates = Array.from(new Set(periods.map(p => p.plate)));
      resultRows.push({
        contract: contractNo,
        cars: carsArr,
        carsCount: uniquePlates.length,
        ...contractInfo[contractNo]
      });
    });

    const summary = {
      totalRows: jsonData.length,
      totalContracts: Object.keys(contractGroups).length,
      singleCarContracts: singleCarContractsCount,
      multiCarContracts: resultRows.length,
    };

    console.log('Worker: Processing complete');
    self.postMessage({ 
      success: true, 
      results: resultRows, 
      summary: summary 
    });

  } catch (error) {
    console.error('Worker error:', error);
    self.postMessage({ 
      success: false, 
      error: error.message 
    });
  }
};