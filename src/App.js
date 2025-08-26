import { useState, useEffect, useMemo } from "react";
// صفحة MultiContract الجديدة
function MultiContractPage({ onBack }) {
  const [results, setResults] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedContract, setSelectedContract] = useState(null);
  // فلترة النتائج حسب البحث الذكي
  // تطبيع الإدخال والبيانات لإزالة المسافات بين الحروف والأرقام
  const normalize = str => (str || '').toString().replace(/\s+/g, '').toLowerCase();
  const filteredResults = results.filter(row => {
    if (!search.trim()) return true;
    const s = search.trim().toLowerCase();
    const sNorm = normalize(s);
    // ابحث في رقم العقد
    if (row.contract && (row.contract.toLowerCase().includes(s) || normalize(row.contract).includes(sNorm))) return true;
    // ابحث في السيارات والفترات
    if (row.cars && row.cars.some(c => c.toLowerCase().includes(s) || normalize(c).includes(sNorm))) return true;
    if (row.carsCount && row.carsCount.toString() === s) return true;
    return false;
  });

  // رفع الملف وتحليل العقود متعددة السيارات
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const dataArr = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(dataArr, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { cellDates: true });
        // Group contracts by contract number and plate, and keep extra info for each contract
        const contractGroups = {};
        const contractInfo = {};
        const carDetailsMap = {};
        const normalizePlate = (str) => (str || '').toString().replace(/\s+/g, '').toUpperCase();
        jsonData.forEach(row => {
          const contractNo = row['Contract No.'];
          const plateNumberRaw = row['Plate Number'];
          const plateNumber = normalizePlate(plateNumberRaw);
          const revenueDate = row['Revenue Date'];
          if (!contractNo || !plateNumber || !revenueDate) return;
          if (!contractGroups[contractNo]) contractGroups[contractNo] = {};
          if (!contractGroups[contractNo][plateNumber]) contractGroups[contractNo][plateNumber] = [];
          contractGroups[contractNo][plateNumber].push(revenueDate);
          // Save extra info for the contract (first row only)
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
          // Save car details for each plate in this contract
          if (!carDetailsMap[contractNo]) carDetailsMap[contractNo] = {};
          if (!carDetailsMap[contractNo][plateNumber]) {
            carDetailsMap[contractNo][plateNumber] = {
              model: row['Car Model'] || '',
              category: row['Car Category'] || '',
              year: row['Manufacture Year'] || ''
            };
          }
        });
        // Prepare results: only contracts with more than one car
        const resultRows = [];
        Object.entries(contractGroups).forEach(([contractNo, carsObj]) => {
          // Build a flat array of {plate, date} sorted by date
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
            // DD/MM/YYYY
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
          // Sort by date
          allDates.sort((a, b) => new Date(a.date) - new Date(b.date));
          // Detect periods for each plate
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
            // If last entry, close period
            if (idx === allDates.length - 1) {
              periods.push({ plate, from: formatDate(periodStart), to: formatDate(periodEnd) });
            }
          });
          if (periods.length <= 1) return;
          const carsArr = periods.map(p => {
            const details = (carDetailsMap[contractNo] && carDetailsMap[contractNo][p.plate]) || {};
            // Example: ABC123 | Toyota | Sedan | 2022 (01/01/2024 - 01/02/2024)
            return `${p.plate} | ${details.model || '-'} | ${details.category || '-'} | ${details.year || '-'} (${p.from} - ${p.to})`;
          });
          // Unique plates count
          const uniquePlates = Array.from(new Set(periods.map(p => p.plate)));
          resultRows.push({
            contract: contractNo,
            cars: carsArr,
            carsCount: uniquePlates.length,
            ...contractInfo[contractNo]
          });
        });
        setResults(resultRows);
      } catch (error) {
        alert('Error processing file');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div style={{ padding: 30, fontFamily: "Segoe UI", background: "#fff9e5", minHeight: "100vh" }}>
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
      <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
        <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ marginBottom: 10 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 10px 0', justifyContent: 'center' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
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
        <button
          onClick={() => setSearch("")}
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
              <th style={{ minWidth: 80, padding: 12, border: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontSize: 17 }}>Contract No.</th>
              <th style={{ minWidth: 100, padding: 12, border: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontSize: 17 }}>Customer</th>
              <th style={{ minWidth: 120, padding: 12, border: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontSize: 17 }}>Cars (Plate & Dates)</th>
              <th style={{ minWidth: 60, padding: 12, border: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontSize: 17 }}>Plate No.</th>
              <th style={{ minWidth: 80, padding: 12, border: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontSize: 17 }}>Cars Count</th>
            </tr>
          </thead>
          <tbody>
            {filteredResults.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#888', fontSize: 18 }}>No data</td></tr>
            ) : filteredResults.map((row, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? '#fffde7' : '#fff', transition: 'background 0.2s' }}>
                <td style={{ minWidth: 80, padding: 12, border: '1px solid #e0e0e0', verticalAlign: 'middle', fontWeight: 'bold', textAlign: 'center', fontSize: 15 }}>
                  <button
                    style={{ background: 'none', border: 'none', color: '#6a1b9a', fontWeight: 'bold', fontSize: 15, cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => setSelectedContract(row)}
                    title="Show contract details"
                  >
                    {row.contract}
                  </button>
                </td>
                <td style={{ minWidth: 100, padding: 12, border: '1px solid #e0e0e0', verticalAlign: 'middle', textAlign: 'center', fontSize: 15 }}>{row.customer}</td>
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
                      </tr>
                    </thead>
                    <tbody>
                      {row.cars.map((c, i) => {
                        const match = c.match(/^(.*?) \| (.*?) \| (.*?) \| (.*?) \((.*)\)$/);
                        let plate = c, model = '', category = '', year = '', period = '';
                        if (match) {
                          plate = match[1].trim();
                          model = match[2].trim();
                          category = match[3].trim();
                          year = match[4].trim();
                          period = match[5].trim();
                        }
                        return (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#b2ebf2' }}>
                            <td style={{ border: '1px solid #26c6da', padding: '10px 8px', color: '#00838f', fontWeight: 600, fontSize: 15 }}>{model}</td>
                            <td style={{ border: '1px solid #26c6da', padding: '10px 8px', color: '#00838f', fontWeight: 600, fontSize: 15 }}>{year}</td>
                            <td style={{ border: '1px solid #26c6da', padding: '10px 8px', color: '#00838f', fontWeight: 700, fontSize: 15 }}>{plate.replace(/([A-Z])([0-9])/g, '$1 $2').replace(/([0-9])([A-Z])/g, '$1 $2')}</td>
                            <td style={{ border: '1px solid #26c6da', padding: '10px 8px', color: '#00838f', fontWeight: 600, fontSize: 15 }}>{period}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </td>
                <td style={{ minWidth: 60, padding: 12, border: '1px solid #e0e0e0', verticalAlign: 'middle', textAlign: 'center', fontSize: 15 }}>{row.plateNo}</td>
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
              background: '#fff9e5', borderRadius: 16, minWidth: 320, maxWidth: 420, boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
              border: '2px solid #6a1b9a', padding: 24, position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedContract(null)}
              style={{
                position: 'absolute', top: 10, right: 10, background: '#6a1b9a', color: '#ffd600', border: 'none',
                borderRadius: '50%', width: 28, height: 28, fontWeight: 'bold', cursor: 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              title="Close"
            >
              ×
            </button>
            <h3 style={{ color: '#6a1b9a', margin: '0 0 16px 0', fontWeight: 'bold', fontSize: 20 }}>Contract Details</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fffde7', border: '2px solid #ffd600', borderRadius: 12, marginTop: 8, boxShadow: '0 2px 8px rgba(106,27,154,0.08)' }}>
              <tbody>
                <tr style={{ background: '#fff' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600', width: '40%' }}>Contract No.</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{selectedContract.contract}</td>
                </tr>
                <tr style={{ background: '#fffde7' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Cars Count</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{selectedContract.carsCount}</td>
                </tr>
                <tr style={{ background: '#fff' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Pick-up Date</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{selectedContract['Pick-up Date']}</td>
                </tr>
                <tr style={{ background: '#fffde7' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Drop-off Date</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{selectedContract['Drop-off Date']}</td>
                </tr>
                <tr style={{ background: '#fff' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Plate Number</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{selectedContract['Plate Number']}</td>
                </tr>
                <tr style={{ background: '#fffde7' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Car Model</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{selectedContract['Car Model']}</td>
                </tr>
                <tr style={{ background: '#fff' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Car Category</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{selectedContract['Car Category']}</td>
                </tr>
                <tr style={{ background: '#fffde7' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Manufacture Year</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{selectedContract['Manufacture Year']}</td>
                </tr>
                <tr style={{ background: '#fff' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Customer Name</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{selectedContract['Customer Name']}</td>
                </tr>
                <tr style={{ background: '#fffde7' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Customer Phone</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{selectedContract['Customer Phone']}</td>
                </tr>
                <tr style={{ background: '#fff' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Cars & Periods</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {selectedContract.cars && selectedContract.cars.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// The XLSX library is now loaded dynamically via a script tag, so the import is removed.

// Toast component for copy notifications
function Toast({ message, show }) {
  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#28a745',
      color: 'white',
      padding: '12px 24px',
      borderRadius: '8px',
      zIndex: 10000,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      transition: 'opacity 0.5s',
    }}>
      {message}
    </div>
  );
}


// Resizer component for table columns
function ColumnResizer({ onResize }) {
  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.pageX;
    const thElement = e.target.parentElement;
    const startWidth = thElement.offsetWidth;

    const handleMouseMove = (moveEvent) => {
      const newWidth = startWidth + (moveEvent.pageX - startX);
      if (newWidth > 60) {
        onResize(newWidth);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        height: '100%',
        width: '8px',
        cursor: 'col-resize',
        zIndex: 10,
      }}
    />
  );
}


// Simple modal to display contract data
function ContractModal({ contract, onClose }) {
  if (!contract) return null;

  const displayNames = {
    contractNo: 'Contract No.',
    revenueDate: 'Revenue Date',
    bookingNumber: 'Booking Number',
    customer: 'Customer',
    invygoModel: 'Model',
    invygoPlate: 'Plate No.',
    ejarModel: 'Replace Model',
    ejarPlate: 'Rep Plate no.',
    phoneNumber: 'Phone Number',
    pickupBranch: 'Pick-up Branch',
    pickupDate: 'Pick-up Date',
    replacementDate: 'Replacement Date',
    dropoffDate: 'Drop-off Date',
    model1: 'Model (Repeated)',
    contact: 'Contact',
    contractType: 'Contract Type'
  };

  const finalDisplayContract = {};
  for(const key in contract) {
    if(displayNames[key] && contract[key]) {
      finalDisplayContract[displayNames[key]] = contract[key];
    }
  }

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex',
        alignItems: 'center', justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff9e5', borderRadius: 20, width: '90%',
          maxWidth: 550, boxShadow: '0 6px 24px rgba(0,0,0,0.25)', 
          border: '2px solid #6a1b9a',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            backgroundColor: '#ffd600', padding: '12px 20px',
            borderBottom: '2px solid #6a1b9a'
        }}>
            <h2 style={{ color: '#6a1b9a', margin: 0, fontSize: '22px' }}>Contract Details</h2>
            <button
              onClick={onClose}
              style={{
                background: '#6a1b9a', color: '#ffd600', border: 'none', 
                borderRadius: '50%', width: 30, height: 30,
                fontWeight: 'bold', cursor: 'pointer', fontSize: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              X
            </button>
        </div>
        <div style={{padding: '20px', maxHeight: '70vh', overflowY: 'auto'}}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {Object.entries(finalDisplayContract).map(([key, val], index) => (
                  <tr key={key} style={{ backgroundColor: index % 2 === 0 ? '#fffde7' : '#fff' }}>
                    <td style={{ fontWeight: 'bold', padding: '10px', borderBottom: '1px solid #eee', color: '#6a1b9a', width: '40%' }}>{key}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}

// Dropdown menu for phone number actions
function DropdownMenu({ options, position, onClose }) {
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.phone-dropdown-menu')) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onClose]);

    if (!position) return null;

    return (
        <div
            className="phone-dropdown-menu"
            style={{
                position: 'fixed',
                top: `${position.top}px`,
                left: `${position.left}px`,
                backgroundColor: 'white',
                border: '1px solid #ddd',
                borderRadius: '8px',
                boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
                zIndex: 10001,
                padding: '5px 0',
                minWidth: '200px',
            }}
        >
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {options.map((option, index) => (
                    <li
                        key={index}
                        onClick={() => { option.action(); onClose(); }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                        style={{
                            padding: '10px 15px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            color: '#333',
                            fontSize: '14px',
                            transition: 'background-color 0.2s'
                        }}
                    >
                        {option.label}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function parseRevenueDate(dateStr) {
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

function formatDateDDMMYYYY(date) {
  if (!(date instanceof Date) || isNaN(date)) {
    return 'Invalid Date';
  }
  // Use UTC dates to avoid timezone issues from the UTC date object
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Month is 0-indexed
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}


// ...existing code...

// Main component for the contracts table
export default function ContractsTable() {
  const [showMultiContract, setShowMultiContract] = useState(false);
  const [allContracts, setAllContracts] = useState([]);
  const [maintenanceData, setMaintenanceData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [xlsxReady, setXlsxReady] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [dropdown, setDropdown] = useState({ visible: false, row: null, position: null });
  
  // New states for multi-car contracts analysis
  const [currentPage, setCurrentPage] = useState('main'); // 'main' or 'multicar'
  const [multiCarData, setMultiCarData] = useState([]);
  const [multiCarResults, setMultiCarResults] = useState([]);
  
  const [columnWidths, setColumnWidths] = useState({
      customer: 220, contractNo: 160, invygoPlate: 150, 
      ejarPlate: 150, phoneNumber: 150, invygoModel: 200, 
      ejarModel: 200, bookingNumber: 150, contractType: 140, 
      pickupBranch: 160, contact: 150, model1: 180, dropoffDate: 150,
  });

  const handleColumnResize = (headerKey, newWidth) => {
    setColumnWidths(prevWidths => ({
        ...prevWidths,
        [headerKey]: newWidth
    }));
  };

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

  // Function to show toast messages
  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Function to handle file upload for multi-car analysis
  const handleMultiCarFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { cellDates: true });

        // طباعة أسماء الأعمدة في أول صف
        if (jsonData.length > 0) {
          console.log('Columns in uploaded file:', Object.keys(jsonData[0]));
          alert('Columns: ' + Object.keys(jsonData[0]).join(', '));
        } else {
          alert('No data found in file!');
        }

        setMultiCarData(jsonData);
        const results = analyzeMultiCarContracts(jsonData);
        setMultiCarResults(results);

        showToastMessage(`Found ${results.length} contracts with multiple cars`);
      } catch (error) {
        console.error('Error processing file:', error);
        showToastMessage('Error processing file');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const columnMappings = {
    open: {
      'Contract No.': 'contractNo', 'Revenue Date': 'revenueDate', 'Booking Number': 'bookingNumber', 'Customer': 'customer',
      'Model ( Ejar )': 'ejarModel', 'EJAR': 'ejarPlate', 'Model': 'invygoModel',
      'INVYGO': 'invygoPlate', 'Phone Number': 'phoneNumber', 'Pick-up Date': 'pickupDate',
      'Replacement Date': 'replacementDate', 'Drop-off Date': 'dropoffDate'
    },
    closed_invygo: {
      'Contract No.': 'contractNo', 'Revenue Date': 'revenueDate', 'Booking Number': 'bookingNumber', 'Customer': 'customer',
      'Pick-up Branch': 'pickupBranch', 'Plate No.': 'plateNo1', 'Model': 'model1',
      'Plate No. ': 'plateNo2', 'Model ': 'model2', 'Pick-up Date': 'pickupDate',
      'Contact': 'contact', 'Drop-off Date': 'dropoffDate'
    },
    closed_other: {
        'Contract No.': 'contractNo', 'Revenue Date': 'revenueDate', 'Booking Number': 'bookingNumber', 'Customer': 'customer',
        'Pick-up Branch': 'pickupBranch', 'Plate No.': 'invygoPlate', 'Model': 'invygoModel',
        'Pick-up Date': 'pickupDate',
        'Drop-off Date': 'dropoffDate'
    }
  };

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

  const formatDateForDisplay = (dateStr) => {
    if (!dateStr || dateStr.trim() === '') return '';
    // Takes the part before the first space, to remove the time part
    return dateStr.split(' ')[0];
  };
  
  const fetchSheet = async (url, viewMode) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch sheet: ${response.statusText}`);
      }
      const text = await response.text();
      // Regex to split by comma only if not inside quotes
      const csvRegex = /,(?=(?:(?:[^""]*\"){2})*[^""]*$)/;
      const rows = text.split("\n").map((r) => r.split(csvRegex).map(c => c.trim().replace(/^"|"$/g, '')));
      const headerIndex = rows.findIndex(row => row.some(cell => cell));
      if (headerIndex === -1) return [];
      const headers = rows[headerIndex].map(h => h.trim());
      const dataRows = rows.slice(headerIndex + 1);
      
      if (viewMode === 'closed_invygo' || viewMode === 'closed_other') {
          let currentDropoffDate = null;
          const processedData = [];
          for (const row of dataRows) {
              const firstCell = row[0] || "";
              const isDateRow = /^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$/.test(firstCell) && row.slice(1).every(cell => !cell || cell.trim() === '');
              if (isDateRow) {
                  currentDropoffDate = firstCell;
              } else if (row.some(cell => cell && cell.trim() !== '') && currentDropoffDate) {
                  const rowData = {};
                  const headerCount = {};
                  headers.forEach((header, i) => {
                      headerCount[header] = (headerCount[header] || 0) + 1;
                      const key = headerCount[header] > 1 ? `${header} ` : header;
                      rowData[key] = row[i];
                  });
                  rowData['Drop-off Date'] = currentDropoffDate;
                  processedData.push(rowData);
              }
          }
          return processedData;
      } else {
          return dataRows
              .filter(r => r.length === headers.length && r.some(c => c))
              .map(r => Object.fromEntries(r.map((c, i) => [headers[i], c])));
      }
  };

  const normalizeData = (rawData, viewMode) => {
      const mapping = columnMappings[viewMode];
      return rawData.map(rawRow => {
          const normalizedRow = { type: viewMode };
          for (const header in mapping) {
              const internalKey = mapping[header];
              normalizedRow[internalKey] = rawRow[header];
          }
          if (viewMode === 'closed_invygo') {
              normalizedRow.invygoPlate = normalizedRow.plateNo1;
              normalizedRow.invygoModel = normalizedRow.model2;
              normalizedRow.ejarPlate = normalizedRow.plateNo2;
          }
          return normalizedRow;
      });
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
    script.async = true;
    script.onload = () => setXlsxReady(true);
    document.body.appendChild(script);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const PROXY_URL = 'https://corsproxy.io/?';
            const encode = (url) => PROXY_URL + encodeURIComponent(url);

            const openContractsUrl = encode("https://docs.google.com/spreadsheets/d/1XwBko5v8zOdTdv-By8HK_DvZnYT2T12mBw_SIbCfMkE/export?format=csv&gid=769459790");
            const closedInvygoUrl = encode("https://docs.google.com/spreadsheets/d/1XwBko5v8zOdTdv-By8HK_DvZnYT2T12mBw_SIbCfMkE/export?format=csv&gid=1830448171");
            const closedOtherUrl = encode("https://docs.google.com/spreadsheets/d/1XwBko5v8zOdTdv-By8HK_DvZnYT2T12mBw_SIbCfMkE/export?format=csv&gid=375289726");
            const maintenanceUrl = encode("https://docs.google.com/spreadsheets/d/1v4rQWn6dYPVQPd-PkhvrDNgKVnexilrR2XIUVa5RKEM/export?format=csv&gid=0");

            const [openRaw, closedInvygoRaw, closedOtherRaw, maintenanceRaw] = await Promise.all([
                fetchSheet(openContractsUrl, 'open'),
                fetchSheet(closedInvygoUrl, 'closed_invygo'),
                fetchSheet(closedOtherUrl, 'closed_other'),
                fetchSheet(maintenanceUrl, 'open')
            ]);

            const normalizedOpen = normalizeData(openRaw, 'open');
            const normalizedClosedInvygo = normalizeData(closedInvygoRaw, 'closed_invygo');
            const normalizedClosedOther = normalizeData(closedOtherRaw, 'closed_other');
            
            setAllContracts([...normalizedOpen, ...normalizedClosedInvygo, ...normalizedClosedOther]);
            setMaintenanceData(maintenanceRaw);
        } catch (err) {
            console.error("Failed to load data from Google Sheets:", err);
            setError(`Failed to load data. Please check your internet connection. Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    loadAllData();
    return () => document.body.removeChild(script);
  }, []);
  
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

  const getLatestDateIn = (row) => {
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
  
  const getDaysSinceLatestIn = (row) => {
    const latestDate = getLatestDateIn(row);
    if (!latestDate) return '';
    const today = new Date();
    const diffTime = today.getTime() - latestDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : '';
  };

  const { filteredData, mismatchCount, switchbackCount, invygoCounts, openContractsCount } = useMemo(() => {
    const openContracts = allContracts.filter(c => c.type === 'open');
    const invygoCounts = openContracts.reduce((acc, row) => {
      const plate = normalize(row.invygoPlate);
      if (plate) acc[plate] = (acc[plate] || 0) + 1;
      return acc;
    }, {});

    const mismatchRows = openContracts.filter(isMismatch);
    const switchbackRows = mismatchRows.filter(row => isMismatch(row) && getLatestDateIn(row));

    let dataToDisplay;
    if (searchTerm.trim() === '') {
        if (filterMode === "mismatch") dataToDisplay = mismatchRows;
        else if (filterMode === "switchback") dataToDisplay = switchbackRows;
        else dataToDisplay = openContracts;
    } else {
        const s = searchTerm.trim().toLowerCase();
        dataToDisplay = allContracts.filter(row =>
            Object.values(row).some(
                val => val && val.toString().toLowerCase().includes(s)
            )
        );
    }

    return {
      filteredData: dataToDisplay,
      mismatchCount: mismatchRows.length,
      switchbackCount: switchbackRows.length,
      invygoCounts,
      openContractsCount: openContracts.length
    };
  }, [allContracts, maintenanceData, searchTerm, filterMode]);

  const showToastNotification = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const copyToClipboard = (text, message = "Copied to clipboard!") => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "-9999px";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToastNotification(message);
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
      showToastNotification("Failed to copy!");
    }
    document.body.removeChild(textArea);
  };

    const handlePhoneClick = (e, row) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        setDropdown({
            visible: true,
            row: row,
            position: { top: rect.bottom + 5, left: rect.left }
        });
    };

    const closeDropdown = () => {
        setDropdown({ visible: false, row: null, position: null });
    };

    const handleCustomerClick = (contract) => {
        setSelectedContract(contract);
        setShowModal(true);
    };

    const normalizePhoneNumber = (phone) => {
        if (!phone) return '';
        let cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('05') && cleaned.length === 10) return `971${cleaned.substring(1)}`;
        if (cleaned.startsWith('971') && cleaned.length === 12) return cleaned;
        return cleaned;
    };

    const copyAndOpenWhatsApp = (row, messageTemplate, toastMessage) => {
        const normalizedPhone = normalizePhoneNumber(row.phoneNumber);
        const message = messageTemplate.replace('#XXXXXX', `#${row.bookingNumber}`);
        copyToClipboard(message, toastMessage);
        window.open(`https://wa.me/${normalizedPhone}`, "_blank");
    };

    const getDropdownOptions = (row) => [
        { label: '1 - Open WhatsApp', action: () => window.open(`https://wa.me/${normalizePhoneNumber(row.phoneNumber)}`, "_blank") },
        { label: '2 - Welcome Message', action: () => {
            const template = `Good day,\n\nThis is Mohamed from Invygo – Yelo Rent A Car. Regarding your booking (#XXXXXX), we have received a service request for the car.\n\nTo assist you as quickly as possible, please provide:

* A photo of the car’s current mileage (KM)

* A photo of the maintenance sticker

* or details of the issue (if available)

We are here to serve you, Thank you.`;
            copyAndOpenWhatsApp(row, template, 'Welcome message copied!');
        }},
        { label: '3 - Switch Back Request', action: () => {
            const template = `Good day, this is Mohamed from Invygo – Yelo Rent A Car. Your original car is ready, and we need to switch it back as per your booking (#XXXXXX). Please let me know a suitable time today and share your location. Thank you!`;
            copyAndOpenWhatsApp(row, template, 'Switch back request copied!');
        }},
        { label: '4 - Close Complaint', action: () => {
            const template = `now i will close the request maybe you will receive schedule email please ignore it, as we need to schedule a service in order to close it in the system.`;
            copyAndOpenWhatsApp(row, template, 'Complaint closing message copied!');
        }}
    ];

  const exportToExcel = () => {
    if (!xlsxReady || !window.XLSX) {
      console.error("XLSX library not loaded yet.");
      return;
    }
    const XLSX = window.XLSX;
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contracts");
    XLSX.writeFile(wb, `Contracts_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };
  
  const headersConfig = {
  open: ['contractNo', 'bookingNumber', 'customer', 'invygoModel', 'invygoPlate', 'ejarModel', 'ejarPlate', 'phoneNumber', 'pickupDate', 'dropoffDate'],
      closed_invygo: ['contractNo', 'revenueDate', 'bookingNumber', 'customer', 'pickupBranch', 'invygoPlate', 'model1', 'ejarPlate', 'invygoModel', 'pickupDate', 'contact', 'dropoffDate'],
      closed_other: ['contractNo', 'revenueDate', 'bookingNumber', 'customer', 'pickupBranch', 'invygoPlate', 'invygoModel', 'pickupDate', 'dropoffDate'],
  master: ['contractNo', 'contractType', 'bookingNumber', 'customer', 'invygoModel', 'invygoPlate', 'ejarModel', 'ejarPlate', 'model1', 'phoneNumber', 'pickupBranch', 'pickupDate', 'replacementDate', 'dropoffDate', 'contact'],
  switchback: ['contractNo', 'bookingNumber', 'customer', 'invygoModel', 'invygoPlate', 'ejarModel', 'ejarPlate', 'phoneNumber', 'pickupDate', 'dropoffDate']
  };

  const headerDisplayNames = {
    contractNo: 'Contract No.', revenueDate: 'Revenue Date', bookingNumber: 'Booking Number', customer: 'Customer',
    invygoModel: 'Model', invygoPlate: 'Plate No.', ejarModel: 'Replace Model',
    ejarPlate: 'Rep Plate no.', phoneNumber: 'Phone Number', pickupBranch: 'Pick-up Branch',
    pickupDate: 'Pick-up Date', replacementDate: 'Replacement Date', dropoffDate: 'Drop-off Date',
    model1: 'Model (Repeated)', contact: 'Contact', contractType: 'Contract Type',
  };

  const getHeadersForData = (data) => {
    if (filterMode === "switchback" && searchTerm.trim() === '') return headersConfig.switchback;
    if (searchTerm.trim() === '' && (filterMode === "all" || filterMode === "mismatch")) return headersConfig.open;

    if (data.length === 0) return headersConfig.open;

    const populatedKeys = new Set(['contractNo']);
    data.forEach(row => {
        for (const key in row) {
            if (row[key] && key !== 'type') {
                populatedKeys.add(key);
            }
        }
    });

    if (searchTerm.trim() !== '') {
        populatedKeys.add('contractType');
    }

    return headersConfig.master.filter(key => populatedKeys.has(key));
  };
  
  const buttonStyle = {
    padding: "10px 16px", backgroundColor: "#fff", color: "#6a1b9a",
    border: "2px solid #6a1b9a", borderRadius: 12, fontWeight: "bold",
    cursor: "pointer", boxShadow: "0px 2px 6px rgba(0,0,0,0.1)", transition: "0.3s",
  };
  
  const disabledButtonStyle = {
      ...buttonStyle,
      opacity: 0.5,
      cursor: 'not-allowed'
  };

  const DataTable = ({ data, headers, onPhoneClick, onCustomerClick }) => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: "collapse", tableLayout: 'fixed', margin: "0 auto" }}>
        <thead style={{ backgroundColor: "#ffd600" }}>
          <tr>
            <th style={{...cellStyle, width: 50, position: 'relative'}}>#<ColumnResizer onResize={(newWidth) => handleColumnResize('#', newWidth)} /></th>
            {headers.map((headerKey) => (
              <th key={headerKey} style={{...cellStyle, width: columnWidths[headerKey] || 150, position: 'relative' }}>
                {headerDisplayNames[headerKey] || headerKey}
                <ColumnResizer onResize={(newWidth) => handleColumnResize(headerKey, newWidth)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => {
            const isDuplicated = row.type === 'open' && invygoCounts[normalize(row.invygoPlate)] > 1;
            const mismatch = row.type === 'open' && isMismatch(row);
            const isCarRepaired = mismatch && getLatestDateIn(row);
            
            const backgroundColor = isDuplicated ? "#ff0800"
              : isCarRepaired ? "#ccffcc"
              : mismatch ? "#ffcccc"
              : idx % 2 === 0 ? "#fffde7"
              : "#ffffff";
            
            const textColor = isDuplicated ? "#fff" : undefined;

            const copyIndexText = () => {
                if (row.type !== 'open') return;
                const firstName = (row.customer || "").split(" ")[0];
                const phone = row.phoneNumber || "";
                let text = `${row.bookingNumber} - Switch\n\n${firstName} - ${phone}\n\nOld car / ${row.ejarModel} - ${row.ejarPlate}\n\nNew car /`;
                if (filterMode === "switchback") {
                    text = `${row.bookingNumber} - Switch Back\n\n${firstName} - ${phone}\n\nOld car / ${row.ejarModel} - ${row.ejarPlate}\n\nNew car / ${row.invygoModel} - ${row.invygoPlate}`;
                }
                copyToClipboard(text, "WhatsApp message copied!");
            };

            return (
              <tr key={`${row.contractNo || 'row'}-${idx}`} style={{ backgroundColor, color: textColor }}>
                <td style={{...cellStyle, width: 50}}>
                  <span onClick={copyIndexText} style={{ cursor: row.type === 'open' ? 'pointer' : 'default', color: '#6a1b9a', fontWeight: 'bold', textDecoration: row.type === 'open' ? 'underline' : 'none' }} title="Click to copy WhatsApp message">
                      {idx + 1}
                  </span>
                </td>
                {headers.map((headerKey) => {
                  const isDateColumn = ['pickupDate', 'dropoffDate', 'replacementDate', 'revenueDate'].includes(headerKey);
                  let value = row[headerKey] || '';
                  if (isDateColumn) {
                      value = formatDateForDisplay(value);
                  }

                  let content = value;
                  const contractTypeDisplay = { open: 'Open', closed_invygo: 'Closed (Invygo)', closed_other: 'Closed (Other)' };
                  
                  if ((filterMode === 'mismatch' || filterMode === 'switchback') && headerKey === 'invygoModel') {
                      const days = getDaysSinceLatestIn(row);
                      if (days !== '') {
                          content = (<span>{value}<span style={{display: 'block', color: '#008000', fontWeight: 'bold', fontSize: '0.9em'}}>(Repaired: {days} days ago)</span></span>);
                      }
                  } else if (headerKey === 'customer') {
                      content = (
                          <span 
                              onClick={() => onCustomerClick(row)} 
                              style={{ 
                                  color: isDuplicated ? '#fff' : '#6a1b9a',
                                  textDecoration: 'underline', 
                                  fontWeight: 'bold', 
                                  cursor: 'pointer' 
                              }}
                          >
                              {value}
                          </span>
                      );
                  } else if (headerKey === 'contractType') {
                    content = <span style={{fontWeight: 'bold'}}>{contractTypeDisplay[row.type]}</span>
                  } else if (row.type === 'open' && headerKey === 'phoneNumber') {
                      content = (
                          <span onClick={(e) => onPhoneClick(e, row)} style={{ color: isDuplicated ? '#fff' : '#25D366', textDecoration: 'underline', fontWeight: 'bold', cursor: 'pointer' }}>
                              {value}
                          </span>
                      );
                  } else if (row.type === 'open' && headerKey === 'contractNo') {
                    content = <a href="https://ejar.iyelo.com:6300/app/rental/contracts" onClick={(e) => { e.preventDefault(); copyToClipboard(value, `Contract ${value} copied!`); window.open(e.currentTarget.href, "_blank"); }} style={{ color: isDuplicated ? '#fff' : '#1976d2', textDecoration: 'none', fontWeight: 'bold', cursor: 'pointer' }}>{value}</a>;
                  } else if (row.type === 'open' && headerKey === 'bookingNumber') {
                    content = <a href="https://dashboard.invygo.com/bookings" onClick={(e) => { e.preventDefault(); copyToClipboard(value, `Booking ${value} copied!`); window.open(e.currentTarget.href, "_blank"); }} style={{ color: isDuplicated ? '#fff' : '#0077b5', textDecoration: 'none', fontWeight: 'bold', cursor: 'pointer' }}>{value}</a>;
                  }

                  return (
                    <td key={headerKey} style={{...cellStyle, width: columnWidths[headerKey] || 150 }} title={value}>
                        {content}
                        {isDuplicated && headerKey === 'invygoPlate' && (
                          <div style={{ fontSize: 12, fontWeight: 'bold', marginTop: 2 }}>
                            ⚠️ Rented to: {
                              (() => {
                                const other = allContracts.find(r => r.type === 'open' && normalize(r.invygoPlate) === normalize(row.invygoPlate) && r !== row);
                                if (!other) return 'N/A';
                                return (<button onClick={() => { setSelectedContract(other); setShowModal(true); }} style={{ color: '#ffd600', background: 'none', border: 'none', textDecoration: 'underline', fontWeight: 'bold', cursor: 'pointer', padding: 0, fontSize: 'inherit' }} title="Show contract details">{`${other.customer} (${other.contractNo})`}</button>);
                              })()
                            }
                          </div>
                        )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const cellStyle = {
    border: "1px solid #ccc", padding: "4px 6px", textAlign: "center",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  };
  
  // ...existing code...
  if (showMultiContract) {
    return <MultiContractPage onBack={() => setShowMultiContract(false)} />;
  }

  return (
    <div style={{ padding: 30, fontFamily: "Segoe UI", background: "#fff9e5", minHeight: "100vh" }}>
      <a
        href="https://moalamir52.github.io/Yelo/#dashboard"
        style={{
          display: "inline-block",
          marginBottom: "20px",
          backgroundColor: "#ffd600",
          color: "#6a1b9a",
          padding: "10px 20px",
          textDecoration: "none",
          fontWeight: "bold",
          borderRadius: "8px",
          border: "2px solid #6a1b9a"
        }}
      >
        ← Back to YELO
      </a>

      <div style={{ margin: '0 auto' }}>
        <header style={{
            backgroundColor: "#ffd600", padding: "25px 35px", borderRadius: "20px",
            boxShadow: "0 6px 24px rgba(0, 0, 0, 0.15)", maxWidth: "720px",
            margin: "0 auto 30px auto", textAlign: "center", border: "2px solid #6a1b9a"
        }}>
          <h1 style={{ color: "#6a1b9a", fontSize: "36px", marginBottom: 10, fontWeight: "bold" }}>Contracts Dashboard</h1>
          <p style={{ color: "#6a1b9a", fontSize: "16px", fontWeight: "bold" }}>Search open and closed contracts in one place</p>
        </header>
        
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="🔍 Search all contracts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: 10, minWidth: 280, borderRadius: 10, border: "1px solid #6a1b9a" }}
            />
            <button style={buttonStyle} onClick={() => setSearchTerm("")}>❌ Reset</button>
            <button style={!xlsxReady ? disabledButtonStyle : buttonStyle} onClick={exportToExcel} disabled={!xlsxReady}>📤 Export</button>
        </div>

    {searchTerm.trim() === '' && (
      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <button style={buttonStyle} onClick={() => setFilterMode("all")}>📋 All ({openContractsCount})</button>
        <button style={buttonStyle} onClick={() => setFilterMode("mismatch")}>♻️ Replacements ({mismatchCount})</button>
        <button style={buttonStyle} onClick={() => setFilterMode("switchback")}>🔁 Switch Back ({switchbackCount})</button>
  <button style={buttonStyle} onClick={() => setShowMultiContract(true)}>🚗 Multi-Car Contracts</button>
      </div>
    )}

        {loading ? (
          <p style={{ textAlign: 'center', fontWeight: 'bold', color: '#6a1b9a', fontSize: '1.2em' }}>Loading all contracts...</p>
        ) : error ? (
          <p style={{ color: "red", textAlign: 'center', fontWeight: 'bold' }}>{error}</p>
        ) : (
          <div id="contracts-table-container">
              <DataTable 
                data={filteredData} 
                headers={getHeadersForData(filteredData)} 
                onPhoneClick={handlePhoneClick}
                onCustomerClick={handleCustomerClick}
              />
              {filteredData.length === 0 && !loading && (
                <p style={{ textAlign: 'center', color: '#555', padding: '20px' }}>No contracts found for your criteria.</p>
              )}
          </div>
        )}
      </div>
      {showModal && (
        <ContractModal contract={selectedContract} onClose={() => setShowModal(false)} />
      )}
      {dropdown.visible && (
        <DropdownMenu
            options={getDropdownOptions(dropdown.row)}
            position={dropdown.position}
            onClose={closeDropdown}
        />
      )}
      <Toast message={toastMessage} show={showToast} />
    </div>
  );
}
