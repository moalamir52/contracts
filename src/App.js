import { useState, useEffect, useMemo } from "react";

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

// Main component for the contracts table
export default function ContractsTable() {
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

  const columnMappings = {
    open: {
      'Contract No.': 'contractNo', 'Booking Number': 'bookingNumber', 'Customer': 'customer',
      'Model ( Ejar )': 'ejarModel', 'EJAR': 'ejarPlate', 'Model': 'invygoModel',
      'INVYGO': 'invygoPlate', 'Phone Number': 'phoneNumber', 'Pick-up Date': 'pickupDate',
      'Replacement Date': 'replacementDate', 'Drop-off Date': 'dropoffDate'
    },
    closed_invygo: {
      'Contract No.': 'contractNo', 'Booking Number': 'bookingNumber', 'Customer': 'customer',
      'Pick-up Branch': 'pickupBranch', 'Plate No.': 'plateNo1', 'Model': 'model1',
      'Plate No. ': 'plateNo2', 'Model ': 'model2', 'Pick-up Date': 'pickupDate',
      'Contact': 'contact', 'Drop-off Date': 'dropoffDate'
    },
    closed_other: {
        'Contract No.': 'contractNo', 'Booking Number': 'bookingNumber', 'Customer': 'customer',
        'Pick-up Branch': 'pickupBranch', 'Plate No.': 'invygoPlate', 'Model': 'invygoModel',
        'Pick-up Date': 'pickupDate',
        'Drop-off Date': 'dropoffDate'
    }
  };

  const normalize = (str) => {
    if (!str) return "";
    const cleanStr = str.toLowerCase().replace(/[^a-z0-9]/g, '');
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
      const rows = text.split("\n").map((r) => r.split(",").map(c => c.trim().replace(/^"|"$/g, '')));
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
    if (latestDateOut && latestDateOut > latestDateIn) return null;
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

* Any photos or details of the issue (if available)

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
      closed_invygo: ['contractNo', 'bookingNumber', 'customer', 'pickupBranch', 'invygoPlate', 'model1', 'ejarPlate', 'invygoModel', 'pickupDate', 'contact', 'dropoffDate'],
      closed_other: ['contractNo', 'bookingNumber', 'customer', 'pickupBranch', 'invygoPlate', 'invygoModel', 'pickupDate', 'dropoffDate'],
      master: ['contractNo', 'contractType', 'bookingNumber', 'customer', 'invygoModel', 'invygoPlate', 'ejarModel', 'ejarPlate', 'model1', 'phoneNumber', 'pickupBranch', 'pickupDate', 'replacementDate', 'dropoffDate', 'contact'],
      switchback: ['contractNo', 'bookingNumber', 'customer', 'invygoModel', 'invygoPlate', 'ejarModel', 'ejarPlate', 'phoneNumber', 'pickupDate', 'dropoffDate']
  };

  const headerDisplayNames = {
    contractNo: 'Contract No.', bookingNumber: 'Booking Number', customer: 'Customer',
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
                  const isDateColumn = ['pickupDate', 'dropoffDate', 'replacementDate'].includes(headerKey);
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
