import { useState, useEffect, useMemo, useCallback, memo } from "react";
import MultiContractPage from "./components/MultiContractPage";
import Toast from "./components/Toast";
import ColumnResizer from "./components/ColumnResizer";
import ContractModal from "./components/ContractModal";
import DropdownMenu from "./components/DropdownMenu";
import {
    analyzeMultiCarContracts,
    normalize,
    formatDateForDisplay,
    getLatestDateIn,
    isMismatch,
    getDaysSinceLatestIn,
    normalizePhoneNumber
} from './utils';
import {
    GOOGLE_SHEETS_URLS,
    COLUMN_MAPPINGS,
    PROXY_URL
} from './config';
import './App.css';

// Constants
const FILTER_MODES = {
  ALL: 'all',
  MISMATCH: 'mismatch',
  SWITCHBACK: 'switchback'
};

const DATE_COLUMNS = ['pickupDate', 'dropoffDate', 'replacementDate', 'revenueDate'];

// Main component for the contracts table
export default function ContractsTable() {
  const [showMultiContract, setShowMultiContract] = useState(false);
  const [allContracts, setAllContracts] = useState([]);
  const [maintenanceData, setMaintenanceData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  const [filterMode, setFilterMode] = useState("all");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
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
  
  const fetchSheet = async (url, viewMode) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch sheet: ${response.statusText}`);
      }
      const text = await response.text();
      // Regex to split by comma only if not inside quotes
      const csvRegex = /,(?=(?:(?:[^"\"]*\"){2})*[^"\"]*$)/;
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
      const mapping = COLUMN_MAPPINGS[viewMode];
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
            const encode = (url) => PROXY_URL + encodeURIComponent(url);

            const openContractsUrl = encode(GOOGLE_SHEETS_URLS.openContracts);
            const closedInvygoUrl = encode(GOOGLE_SHEETS_URLS.closedInvygo);
            const closedOtherUrl = encode(GOOGLE_SHEETS_URLS.closedOther);
            const maintenanceUrl = encode(GOOGLE_SHEETS_URLS.maintenance);

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
  

  const { filteredData, mismatchCount, switchbackCount, invygoCounts, openContractsCount, openContractsFromSearch, closedContractsFromSearch } = useMemo(() => {
    const openContracts = allContracts.filter(c => c.type === 'open');
    const invygoCounts = openContracts.reduce((acc, row) => {
      const plate = normalize(row.invygoPlate);
      if (plate) acc[plate] = (acc[plate] || 0) + 1;
      return acc;
    }, {});

    const mismatchRows = openContracts.filter(isMismatch);
    const switchbackRows = mismatchRows.filter(row => isMismatch(row) && getLatestDateIn(row, maintenanceData));

    let dataToDisplay;
    let openContractsFromSearch = [];
    let closedContractsFromSearch = [];

    if (debouncedSearchTerm.trim() === '') {
        if (filterMode === FILTER_MODES.MISMATCH) dataToDisplay = mismatchRows;
        else if (filterMode === FILTER_MODES.SWITCHBACK) dataToDisplay = switchbackRows;
        else dataToDisplay = openContracts;
    } else {
        const s = debouncedSearchTerm.trim().toLowerCase();
        dataToDisplay = allContracts.filter(row =>
            Object.values(row).some(
                val => val && val.toString().toLowerCase().includes(s)
            )
        );
        openContractsFromSearch = dataToDisplay.filter(c => c.type === 'open');
        closedContractsFromSearch = dataToDisplay.filter(c => c.type !== 'open');
    }

    return {
      filteredData: dataToDisplay,
      mismatchCount: mismatchRows.length,
      switchbackCount: switchbackRows.length,
      invygoCounts,
      openContractsCount: openContracts.length,
      openContractsFromSearch,
      closedContractsFromSearch
    };
  }, [allContracts, maintenanceData, debouncedSearchTerm, filterMode]);

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

    const handlePhoneClick = useCallback((e, row) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        setDropdown({
            visible: true,
            row: row,
            position: { top: rect.bottom + 5, left: rect.left }
        });
    }, []);

    const closeDropdown = useCallback(() => {
        setDropdown({ visible: false, row: null, position: null });
    }, []);

    const handleCustomerClick = useCallback((contract) => {
        setSelectedContract(contract);
        setShowModal(true);
    }, []);

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

  const exportToExcel = useCallback(async () => {
    if (!xlsxReady || !window.XLSX) {
      showToastNotification("Excel library not ready yet");
      return;
    }
    setExporting(true);
    try {
      const XLSX = window.XLSX;
      const ws = XLSX.utils.json_to_sheet(filteredData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Contracts");
      XLSX.writeFile(wb, `Contracts_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
      showToastNotification("Excel file exported successfully!");
    } catch (error) {
      showToastNotification("Export failed!");
    } finally {
      setExporting(false);
    }
  }, [xlsxReady, filteredData]);
  
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

  const getHeadersForData = useMemo(() => (data) => {
    if (filterMode === FILTER_MODES.SWITCHBACK && debouncedSearchTerm.trim() === '') return headersConfig.switchback;
    if (debouncedSearchTerm.trim() === '' && (filterMode === FILTER_MODES.ALL || filterMode === FILTER_MODES.MISMATCH)) return headersConfig.open;

    if (data.length === 0) return headersConfig.open;

    const populatedKeys = new Set(['contractNo']);
    data.forEach(row => {
        for (const key in row) {
            if (row[key] && key !== 'type') {
                populatedKeys.add(key);
            }
        }
    });

    if (debouncedSearchTerm.trim() !== '') {
        populatedKeys.add('contractType');
    }

    return headersConfig.master.filter(key => populatedKeys.has(key));
  }, [filterMode, debouncedSearchTerm]);
  
  const DataTable = memo(({ data, headers, onPhoneClick, onCustomerClick }) => (
    <div className="data-table-container">
      <table className="data-table">
        <thead className="table-header">
          <tr>
            <th className="table-cell" style={{width: 50}}>#<ColumnResizer onResize={(newWidth) => handleColumnResize('#', newWidth)} /></th>
            {headers.map((headerKey) => (
              <th key={headerKey} className="table-cell" style={{width: columnWidths[headerKey] || 150}}>
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
            const isCarRepaired = mismatch && getLatestDateIn(row, maintenanceData);
            
            const rowClassName = isDuplicated ? "duplicated-row"
              : isCarRepaired ? "repaired-row"
              : mismatch ? "mismatch-row"
              : idx % 2 === 0 ? "even-row"
              : "odd-row";

            const copyIndexText = () => {
                if (row.type !== 'open') return;
                const firstName = (row.customer || "").split(" ")[0];
                const phone = row.phoneNumber || "";
                let text = `${row.bookingNumber} - Switch\n\n${firstName} - ${phone}\n\nOld car / ${row.ejarModel} - ${row.ejarPlate}\n\nNew car /`;
                if (filterMode === FILTER_MODES.SWITCHBACK) {
                    text = `${row.bookingNumber} - Switch Back\n\n${firstName} - ${phone}\n\nOld car / ${row.ejarModel} - ${row.ejarPlate}\n\nNew car / ${row.invygoModel} - ${row.invygoPlate}`;
                }
                copyToClipboard(text, "WhatsApp message copied!");
            };

            return (
              <tr key={`${row.contractNo || 'row'}-${idx}`} className={rowClassName}>
                <td className="table-cell" style={{width: 50}}>
                  <span onClick={copyIndexText} className="clickable" title="Click to copy WhatsApp message">
                      {idx + 1}
                  </span>
                </td>
                {headers.map((headerKey) => {
                  const isDateColumn = DATE_COLUMNS.includes(headerKey);
                  let value = row[headerKey] || '';
                  if (isDateColumn) {
                      value = formatDateForDisplay(value);
                  }

                  let content = value;
                  const contractTypeDisplay = { open: 'Open', closed_invygo: 'Closed (Invygo)', closed_other: 'Closed (Other)' };
                  
                  if ((filterMode === FILTER_MODES.MISMATCH || filterMode === FILTER_MODES.SWITCHBACK) && headerKey === 'invygoModel') {
                      const days = getDaysSinceLatestIn(row, maintenanceData);
                      if (days !== '') {
                          content = (<span>{value}<span className="repaired-info">(Repaired: {days} days ago)</span></span>);
                      }
                  } else if (headerKey === 'customer') {
                      content = (
                          <span onClick={() => onCustomerClick(row)} className="customer-link">
                              {value}
                          </span>
                      );
                  } else if (headerKey === 'contractType') {
                    content = <span style={{fontWeight: 'bold'}}>{contractTypeDisplay[row.type]}</span>
                  } else if (row.type === 'open' && headerKey === 'phoneNumber') {
                      content = (
                          <span onClick={(e) => onPhoneClick(e, row)} className="phone-link">
                              {value}
                          </span>
                      );
                  } else if (row.type === 'open' && headerKey === 'contractNo') {
                    content = <a href="https://ejar.iyelo.com:6300/app/rental/contracts" onClick={(e) => { e.preventDefault(); copyToClipboard(value, `Contract ${value} copied!`); window.open(e.currentTarget.href, "_blank"); }} className="contract-link">{value}</a>;
                  } else if (row.type === 'open' && headerKey === 'bookingNumber') {
                    content = <a href="https://dashboard.invygo.com/bookings" onClick={(e) => { e.preventDefault(); copyToClipboard(value, `Booking ${value} copied!`); window.open(e.currentTarget.href, "_blank"); }} className="booking-link">{value}</a>;
                  }

                  return (
                    <td key={headerKey} className="table-cell" style={{width: columnWidths[headerKey] || 150 }} title={value}>
                        {content}
                        {isDuplicated && headerKey === 'invygoPlate' && (
                          <div className="duplicated-info">
                            ⚠️ Rented to: { 
                              (() => {
                                const other = allContracts.find(r => r.type === 'open' && normalize(r.invygoPlate) === normalize(row.invygoPlate) && r !== row);
                                if (!other) return 'N/A';
                                return (<button onClick={() => { setSelectedContract(other); setShowModal(true); }} title="Show contract details">{`${other.customer} (${other.contractNo})`}</button>);
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
  ));
  
  // ...existing code...
  if (showMultiContract) {
    return <MultiContractPage allContracts={allContracts} onBack={() => setShowMultiContract(false)} />;
  }

  return (
    <div className="contracts-dashboard">
      <a
        href="https://moalamir52.github.io/Yelo/#dashboard"
        className="back-link"
      >
        ← Back to YELO
      </a>

      <div style={{ margin: '0 auto' }}>
        <header className="dashboard-header">
          <h1>Contracts Dashboard</h1>
          <p>Search open and closed contracts in one place</p>
        </header>
        

        <div className="controls-container">
            <input
              type="text"
              placeholder="🔍 Search all contracts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <button className="control-button" onClick={() => setSearchTerm("")}>❌ Reset</button>
            <button className="control-button" onClick={exportToExcel} disabled={!xlsxReady}>📤 Export</button>
        </div>

    {debouncedSearchTerm.trim() === '' && (
      <div className="controls-container">
        <button className="control-button" onClick={() => setFilterMode(FILTER_MODES.ALL)}>📋 All ({openContractsCount})</button>
        <button className="control-button" onClick={() => setFilterMode(FILTER_MODES.MISMATCH)}>♻️ Replacements ({mismatchCount})</button>
        <button className="control-button" onClick={() => setFilterMode(FILTER_MODES.SWITCHBACK)}>🔁 Switch Back ({switchbackCount})</button>
        <button className="control-button" onClick={() => setShowMultiContract(true)}>🚗 Multi-Car Contracts</button>
      </div>
    )}

        {loading ? (
          <p className="loading-message">Loading all contracts...</p>
        ) : error ? (
          <p className="error-message">{error}</p>
        ) : debouncedSearchTerm.trim() !== '' ? (
          // عرض نتائج البحث في جدولين منفصلين
          <div>
            {openContractsFromSearch.length > 0 && (
              <div className="table-section">
                <h2 className="section-title">📋 Open Contracts ({openContractsFromSearch.length})</h2>
                <DataTable 
                  data={openContractsFromSearch} 
                  headers={getHeadersForData(openContractsFromSearch)} 
                  onPhoneClick={handlePhoneClick}
                  onCustomerClick={handleCustomerClick}
                />
              </div>
            )}
            {closedContractsFromSearch.length > 0 && (
              <div className="table-section">
                <h2 className="section-title">🔒 Closed Contracts ({closedContractsFromSearch.length})</h2>
                <DataTable 
                  data={closedContractsFromSearch} 
                  headers={getHeadersForData(closedContractsFromSearch)} 
                  onPhoneClick={handlePhoneClick}
                  onCustomerClick={handleCustomerClick}
                />
              </div>
            )}
            {openContractsFromSearch.length === 0 && closedContractsFromSearch.length === 0 && (
              <p className="no-contracts-message">No contracts found for your search.</p>
            )}
          </div>
        ) : (
          // عرض العقود المفتوحة فقط عند عدم وجود بحث
          <div id="contracts-table-container">
              <DataTable 
                data={filteredData} 
                headers={getHeadersForData(filteredData)} 
                onPhoneClick={handlePhoneClick}
                onCustomerClick={handleCustomerClick}
              />
              {filteredData.length === 0 && !loading && (
                <p className="no-contracts-message">No contracts found for your criteria.</p>
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
