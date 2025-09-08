import { useState, useEffect, useMemo } from "react";

// New MultiContract Page
export default function MultiContractPage({ onBack }) {
  const [results, setResults] = useState([]);
  const [singleCarContracts, setSingleCarContracts] = useState([]);
  const [uploadSummary, setUploadSummary] = useState(null); // State for upload summary
  const [bookingIdMap, setBookingIdMap] = useState(new Map());

  // Retrieve results from localStorage when the page opens
  useEffect(() => {
    const saved = localStorage.getItem('multiCarResults');
    const savedSummary = localStorage.getItem('multiCarSummary');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setResults(parsed);
      } catch {}
    }
    if (savedSummary) {
      try {
        const parsedSummary = JSON.parse(savedSummary);
        if (parsedSummary) setUploadSummary(parsedSummary);
      } catch {}
    }
  }, []);

  const [search, setSearch] = useState("");
  const [currentSearchInput, setCurrentSearchInput] = useState("");
  const [selectedContract, setSelectedContract] = useState(null);
  // Filter results by smart search
  // Normalize input and data to remove spaces between letters and numbers
  const normalize = str => (str || '').toString().replace(/\s+/g, '').toLowerCase();
  const filteredResults = useMemo(() => {
    const allContracts = [...results, ...singleCarContracts];
    if (!search.trim()) {
      return results; // Only show multi-car contracts if search is empty
    }

    const s = search.trim().toLowerCase();
    const sNorm = normalize(s);

    return allContracts.filter(row => {
      // Search in contract number
      if (row.contract && (row.contract.toLowerCase().includes(s) || normalize(row.contract).includes(sNorm))) return true;
      // Search in cars and periods
      if (row.cars && row.cars.some(c => c.toLowerCase().includes(s) || normalize(c).includes(sNorm))) return true;
      // Search in number of cars
      if (row.carsCount && row.carsCount.toString() === s) return true;
      // Search in customer name
      if (row['Customer Name'] && (row['Customer Name'].toLowerCase().includes(s) || normalize(row['Customer Name']).includes(sNorm))) return true;
      return false;
    });
  }, [search, results, singleCarContracts]);

  // Loading state when uploading file
  const [uploading, setUploading] = useState(false);
  
  const handleBookingIdFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = window.XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = window.XLSX.utils.sheet_to_json(worksheet);

            const newBookingIdMap = new Map();
            jsonData.forEach(row => {
                const agreement = row['Agreement'];
                const bookingId = row['Booking ID'];
                if (agreement && bookingId) {
                    newBookingIdMap.set(String(agreement), String(bookingId));
                }
            });
            setBookingIdMap(newBookingIdMap);
        } catch (error) {
            console.error("Error processing booking ID file:", error);
            alert('Error processing booking ID file.');
        }
    };
    reader.readAsArrayBuffer(file);
  };
  
  // Upload file and analyze multi-car contracts
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setUploading(true);
    setResults([]); // Clear previous results
    setUploadSummary(null); // Clear previous summary
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const dataArr = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(dataArr, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { cellDates: true });
        
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

        const resultRows = [];
        const tempSingleCarContracts = [];
        let singleCarContractsCount = 0;

        Object.entries(contractGroups).forEach(([contractNo, carsObj]) => {
          const uniquePlatesInContract = Object.keys(carsObj);
          if (uniquePlatesInContract.length <= 1) {
            singleCarContractsCount++;
            // Process single-car contracts to store them
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
            tempSingleCarContracts.push({
              contract: contractNo,
              cars: carsArr,
              carsCount: uniquePlates.length,
              ...contractInfo[contractNo]
            });
            return; // Skip adding to resultRows for multi-car contracts
          }

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

          if (periods.length <= 1) return;

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

        setResults(resultRows);
        setSingleCarContracts(tempSingleCarContracts); // Set the single car contracts
        setUploadSummary(summary);
        localStorage.setItem('multiCarResults', JSON.stringify(resultRows));
        localStorage.setItem('multiCarSummary', JSON.stringify(summary));

      } catch (error) {
        console.error("File processing error:", error);
        alert('Error processing file');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div style={{ padding: 30, fontFamily: "Segoe UI", background: "#fff9e5", minHeight: "100vh" }}>
      {uploading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(255,255,255,0.6)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff',
            padding: 32,
            borderRadius: 16,
            boxShadow: '0 2px 16px rgba(106,27,154,0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16
          }}>
            <div style={{
              border: '6px solid #ffd600',
              borderTop: '6px solid #6a1b9a',
              borderRadius: '50%',
              width: 48,
              height: 48,
              animation: 'spin 1s linear infinite',
              marginBottom: 12
            }} />
            <span style={{ color: '#6a1b9a', fontWeight: 'bold', fontSize: 18 }}>Uploading file...</span>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }`}</style>
          </div>
        </div>
      )}
      <button onClick={onBack} style={{ marginBottom: 20, background: '#6a1b9a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 'bold', cursor: 'pointer' }}>← Back</button>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
        <div style={{
          display: 'inline-block',
          padding: '18px 38px',
          border: '3px solid #6a1b9a',
          borderRadius: 18,
          background: '#ffd600',
          boxShadow: '0 2px 12px rgba(106,27,154,0.08)',
        }}>
          <h2 style={{
            color: '#6a1b9a',
            fontWeight: 'bold',
            fontSize: 32,
            margin: 0,
            letterSpacing: 1,
            textAlign: 'center',
          }}>
            Multi-Car Contracts
          </h2>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0', gap: 16, flexWrap: 'wrap' }}>
        <a
          href={process.env.PUBLIC_URL + "/multi_car_template.csv"}
          download="multi_car_template.csv"
          style={{
            background: '#6a1b9a', color: '#ffd600', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'none', fontSize: 16, display: 'inline-block', minWidth: 180, textAlign: 'center'
          }}
        >
          ⬇️ Download Multi-Car Template
        </a>
        <label style={{
            background: '#ffd600', color: '#6a1b9a', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'none', fontSize: 16, display: 'inline-block', minWidth: 180, textAlign: 'center', marginBottom: 0
        }}>
          ⬆️ Upload Multi-Car File
          <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>
        <label style={{
            background: '#6a1b9a', color: '#ffd600', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'none', fontSize: 16, display: 'inline-block', minWidth: 180, textAlign: 'center', marginBottom: 0
        }}>
          📎 Upload Invygo ID File
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleBookingIdFileUpload} style={{ display: 'none' }} />
        </label>
      </div>

      {uploadSummary && (
        <div style={{ maxWidth: '800px', margin: '25px auto', padding: '20px', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '2px solid #6a1b9a' }}>
          <h3 style={{ color: '#6a1b9a', marginTop: 0, marginBottom: '15px', textAlign: 'center', fontSize: '22px', fontWeight: 'bold' }}>File Upload Summary</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ background: '#fffde7' }}>
                <td style={{ padding: '12px', border: '1px solid #ffd600', fontWeight: 'bold', color: '#6a1b9a' }}>Total Rows in File</td>
                <td style={{ padding: '12px', border: '1px solid #ffd600', textAlign: 'center', fontWeight: 'bold' }}>{uploadSummary.totalRows}</td>
              </tr>
              <tr style={{ background: '#fff' }}>
                <td style={{ padding: '12px', border: '1px solid #ffd600', fontWeight: 'bold', color: '#6a1b9a' }}>Total Contracts</td>
                <td style={{ padding: '12px', border: '1px solid #ffd600', textAlign: 'center', fontWeight: 'bold' }}>{uploadSummary.totalContracts}</td>
              </tr>
              <tr style={{ background: '#fffde7' }}>
                <td style={{ padding: '12px', border: '1px solid #ffd600', fontWeight: 'bold', color: '#6a1b9a' }}>Single Car Contracts</td>
                <td style={{ padding: '12px', border: '1px solid #ffd600', textAlign: 'center', fontWeight: 'bold' }}>{uploadSummary.singleCarContracts}</td>
              </tr>
              <tr style={{ background: '#fff' }}>
                <td style={{ padding: '12px', border: '1px solid #ffd600', fontWeight: 'bold', color: '#6a1b9a' }}>Multi-Car Contracts</td>
                <td style={{ padding: '12px', border: '1px solid #ffd600', textAlign: 'center', fontWeight: 'bold' }}>{uploadSummary.multiCarContracts}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 10px 0', justifyContent: 'center' }}>
        <input
          type="text"
          value={currentSearchInput}
          onChange={e => setCurrentSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && setSearch(currentSearchInput)}
          placeholder="Search contract, plate, or date..."
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            border: '1.5px solid #bdbdbd',
            fontSize: 16,
            minWidth: 220,
            outline: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        />
        {currentSearchInput && ( // Conditionally render the clear button
          <button
            onClick={() => {
              setSearch("");
              setCurrentSearchInput("");
            }}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: 'none',
              background: '#ff4d4d', // Red color for clear
              color: '#fff',
              fontWeight: 'bold',
              fontSize: 16,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.07)'
            }}
          >
            ×
          </button>
        )}
        <button
          onClick={() => setSearch(currentSearchInput)}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            background: '#6a1b9a',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 16,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.07)'
          }}
        >
          Search
        </button>
        <button
          onClick={() => {
            setSearch("");
            setCurrentSearchInput(""); // Clear current search input
            setResults([]);
            setUploadSummary(null);
            localStorage.removeItem('multiCarResults');
            localStorage.removeItem('multiCarSummary');
            if (typeof onBack === 'function') onBack();
            setTimeout(() => window.location.reload(), 100);
          }}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            background: '#6a1b9a',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 16,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.07)'
          }}
        >
          Reset
        </button>
      </div>
      <div style={{ overflowX: 'auto', marginTop: 10 }}>
  <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', margin: '0 auto', background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', borderRadius: 16, overflow: 'hidden', tableLayout: 'auto' }}>
          <thead>
            <tr style={{ background: 'linear-gradient(90deg,#ffd600 60%,#fffde7 100%)', color: '#6a1b9a', fontSize: 18 }}>
              <th style={{ minWidth: 20, padding: 12, border: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontSize: 17 }}>#</th>
              <th style={{ minWidth: 50, padding: 12, border: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontSize: 17 }}>Contract No.</th>
              <th style={{ minWidth: 50, padding: 12, border: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontSize: 17 }}>Booking ID</th>
              <th style={{ minWidth: 250, maxWidth: 180, width: 140, padding: 12, border: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontSize: 17 }}>Customer</th>
              <th style={{ minWidth: 120, padding: 12, border: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontSize: 17 }}>Cars (Plate & Dates)</th>
              <th style={{ minWidth: 80, padding: 12, border: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontSize: 17 }}>Cars Count</th>
            </tr>
          </thead>
          <tbody>
            {filteredResults.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#888', fontSize: 18 }}>No data</td></tr>
            ) : filteredResults.map((row, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? '#fffde7' : '#fff', transition: 'background 0.2s' }}>
                <td style={{ padding: 12, border: '1px solid #e0e0e0', verticalAlign: 'middle', textAlign: 'center', fontSize: 15 }}>{idx + 1}</td>
                <td style={{ minWidth: 80, padding: 12, border: '1px solid #e0e0e0', verticalAlign: 'middle', fontWeight: 'bold', textAlign: 'center', fontSize: 15 }}>
                  <button
                    style={{ background: 'none', border: 'none', color: '#6a1b9a', fontWeight: 'bold', fontSize: 15, cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => setSelectedContract(row)}
                    title="Show contract details"
                  >
                    {row.contract}
                  </button>
                </td>
                <td style={{ minWidth: 80, padding: 12, border: '1px solid #e0e0e0', verticalAlign: 'middle', textAlign: 'center', fontSize: 15 }}>
                  {bookingIdMap.get(row.contract) || 'Branch'}
                </td>
                <td style={{ minWidth: 140, maxWidth: 180, width: 140, padding: 12, border: '1px solid #e0e0e0', verticalAlign: 'middle', textAlign: 'center', fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row['Customer Name']}</td>
                <td style={{ minWidth: 120, padding: 0, border: '1px solid #e0e0e0', verticalAlign: 'middle', textAlign: 'center', fontSize: 15, background: '#fff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: 'none', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,150,136,0.10)' }}>
                    <colgroup>
                      <col style={{ width: '25%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '30%' }} />
                      <col style={{ width: '30%' }} />
                    </colgroup>
                    <thead>
                      <tr style={{ background: 'linear-gradient(90deg,#e0f7fa 60%,#b2ebf2 100%)' }}>
                        <th style={{ border: '1px solid #26c6da', padding: '10px 8px', fontSize: 15, color: '#006064', background: '#e0f7fa', fontWeight: 700 }}>Model</th>
                        <th style={{ border: '1px solid #26c6da', padding: '10px 8px', fontSize: 15, color: '#006064', background: '#e0f7fa', fontWeight: 700 }}>Year</th>
                        <th style={{ border: '1px solid #26c6da', padding: '10px 8px', fontSize: 15, color: '#006064', background: '#e0f7fa', fontWeight: 700 }}>Plate</th>
                        <th style={{ border: '1px solid #26c6da', padding: '10px 8px', fontSize: 15, color: '#006064', background: '#e0f7fa', fontWeight: 700 }}>Period</th>
                                                <th style={{ border: '1px solid #26c6da', padding: '10px 8px', fontSize: 15, color: '#006064', background: '#e0f7fa', fontWeight: 700 }}>Pickup Odometer</th>

                      </tr>
                    </thead>
                    <tbody>
                      {row.cars.map((c, i) => {
                        // new format: plate | model | category | year | Pickup Odometer: odometer (period)
                        const match = c.match(/^(.*?) \| (.*?) \| (.*?) \| (.*?) \| Pickup Odometer: (.*?) \((.*)\)$/);
                        let plate = '', model = '', category = '', year = '', pickupOdometer = '', period = '';
                        if (match) {
                          plate = match[1].trim();
                          model = match[2].trim();
                          category = match[3].trim();
                          year = match[4].trim();
                          pickupOdometer = match[5].trim();
                          period = match[6].trim();
                        }
                        return (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#b2ebf2' }}>
                            <td style={{ border: '1px solid #26c6da', padding: '10px 8px', color: '#00838f', fontWeight: 600, fontSize: 15 }}>{model}</td>
                            <td style={{ border: '1px solid #26c6da', padding: '10px 8px', color: '#00838f', fontWeight: 600, fontSize: 15 }}>{year}</td>
                            <td style={{ border: '1px solid #26c6da', padding: '10px 8px', color: '#00838f', fontWeight: 700, fontSize: 15 }}>{plate.replace(/([A-Z])([0-9])/g, '$1 $2').replace(/([0-9])([A-Z])/g, '$1 $2')}</td>
                            <td style={{ border: '1px solid #26c6da', padding: '10px 8px', color: '#00838f', fontWeight: 600, fontSize: 15 }}>{period}</td>
                                                        <td style={{ border: '1px solid #26c6da', padding: '10px 8px', color: '#00838f', fontWeight: 600, fontSize: 15 }}>{pickupOdometer}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </td>
                <td style={{ minWidth: 80, padding: 12, border: '1px solid #e0e0e0', verticalAlign: 'middle', fontWeight: 'bold', color: '#6a1b9a', textAlign: 'center', fontSize: 15 }}>{row.carsCount} Cars</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Modal for contract details */}
      {selectedContract && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex',
            alignItems: 'center', justifyContent: 'center'
          }}
          onClick={() => setSelectedContract(null)}
        >
          <div
            style={{
              background: '#fff9e5', borderRadius: 18, minWidth: 480, maxWidth: 820, boxShadow: '0 6px 32px rgba(0,0,0,0.25)',
              border: '2.5px solid #6a1b9a', padding: 32, position: 'relative', width: '90%'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedContract(null)}
              style={{
                position: 'absolute', top: 12, right: 12, background: '#6a1b9a', color: '#ffd600', border: 'none',
                borderRadius: '50%', width: 32, height: 32, fontWeight: 'bold', cursor: 'pointer', fontSize: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(106,27,154,0.10)'
              }}
              title="Close"
            >
              ×
            </button>
            <h3 style={{ color: '#6a1b9a', margin: '0 0 18px 0', fontWeight: 'bold', fontSize: 24, letterSpacing: 1 }}>Contract Details</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fffde7', border: '2px solid #ffd600', borderRadius: 12, marginTop: 8, boxShadow: '0 2px 8px rgba(106,27,154,0.08)' }}>
              <tbody>
                <tr style={{ background: '#fff' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600', width: '38%' }}>Contract No.</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{selectedContract.contract}</td>
                </tr>
                <tr style={{ background: '#fffde7' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Booking ID</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{bookingIdMap.get(selectedContract.contract) || 'Branch'}</td>
                </tr>
                <tr style={{ background: '#fff' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Cars Count</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{selectedContract.carsCount}</td>
                </tr>
                <tr style={{ background: '#fffde7' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Pick-up Date</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{(selectedContract['Pick-up Date'] || '').replace(/ ?\+0?4:?0{0,2}/gi, '').trim()}</td>
                </tr>
                <tr style={{ background: '#fff' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Drop-off Date</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{(selectedContract['Drop-off Date'] || '').replace(/ ?\+0?4:?0{0,2}/gi, '').trim()}</td>
                </tr>
                <tr style={{ background: '#fffde7' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Customer Name</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{selectedContract['Customer Name']}</td>
                </tr>
                <tr style={{ background: '#fff' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Customer Phone</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{selectedContract['Customer Phone']}</td>
                </tr>
              </tbody>
            </table>
            {/* Cars and Periods Table */}
            <div style={{ marginTop: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(106,27,154,0.07)', padding: 12, border: '1.5px solid #ffd600', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                <thead>
                  <tr style={{ background: '#ffd600', color: '#6a1b9a', fontWeight: 700, fontSize: 16, textAlign: 'center' }}>
                    <th style={{ padding: '10px 8px', border: '1px solid #ffd600', textAlign: 'center' }}>Plate</th>
                                        <th style={{ padding: '10px 8px', border: '1px solid #ffd600', textAlign: 'center' }}>Category</th>
                    <th style={{ padding: '10px 8px', border: '1px solid #ffd600', textAlign: 'center' }}>Model</th>
                    <th style={{ padding: '10px 8px', border: '1px solid #ffd600', textAlign: 'center' }}>Year</th>
                                        <th style={{ padding: '10px 8px', border: '1px solid #ffd600', textAlign: 'center' }}>Period</th>
                    <th style={{ padding: '10px 8px', border: '1px solid #ffd600', textAlign: 'center' }}>Pickup Odometer</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedContract.cars && selectedContract.cars.map((c, i) => {
                    // new format: plate | model | category | year | Pickup Odometer: odometer (period)
                    const match = c.match(/^(.*?) \| (.*?) \| (.*?) \| (.*?) \| Pickup Odometer: (.*?) \((.*)\)$/);
                    let plate = '', model = '', category = '', year = '', pickupOdometer = '', period = '';
                    if (match) {
                      plate = match[1].trim();
                      model = match[2].trim();
                      category = match[3].trim();
                      year = match[4].trim();
                      pickupOdometer = match[5].trim();
                      period = match[6].trim();
                    }
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fffde7' : '#fff', textAlign: 'center' }}>
                        <td style={{ border: '1px solid #ffd600', padding: '8px 6px', fontWeight: 600, color: '#6a1b9a', fontSize: 15, textAlign: 'center' }}>{plate.replace(/([A-Z])([0-9])/g, '$1 $2').replace(/([0-9])([A-Z])/g, '$1 $2')}</td>
                                                <td style={{ border: '1px solid #ffd600', padding: '8px 6px', fontWeight: 600, color: '#6a1b9a', fontSize: 15, textAlign: 'center' }}>{category}</td>
                        <td style={{ border: '1px solid #ffd600', padding: '8px 6px', fontWeight: 600, color: '#6a1b9a', fontSize: 15, textAlign: 'center' }}>{model}</td>
                        <td style={{ border: '1px solid #ffd600', padding: '8px 6px', fontWeight: 600, color: '#6a1b9a', fontSize: 15, textAlign: 'center' }}>{year}</td>
                                                <td style={{ border: '1px solid #ffd600', padding: '8px 6px', fontWeight: 600, color: '#6a1b9a', fontSize: 15, textAlign: 'center' }}>{period}</td>
                        <td style={{ border: '1px solid #ffd600', padding: '8px 6px', fontWeight: 600, color: '#6a1b9a', fontSize: 15, textAlign: 'center' }}>{pickupOdometer}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
