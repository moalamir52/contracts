import { useState, useEffect, useMemo, useCallback, memo } from "react";
import MultiContractPage from "./components/MultiContractPage";
import ColumnMenu from './components/ColumnMenu';
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
  SWITCHBACK: 'switchback',
  EXPIRED: 'expired'
};

const DATE_COLUMNS = ['pickupDate', 'dropoffDate', 'replacementDate', 'revenueDate'];

// دالة استخراج بيانات issue بناءً على invygoPlate فقط وعمود Vehicle في maintenanceData
const getIssueForRow = (row, maintenanceData) => {
  if (!row.invygoPlate || !maintenanceData) {
    return '';
  }
  const normalizedPlate = normalize(row.invygoPlate);
  const matchingVehicles = maintenanceData.filter(
    (m) => normalize(m.Vehicle) === normalizedPlate
  );
  // Debug: طباعة معلومات المطابقة
  if (matchingVehicles.length > 0) {
    const vehicleWithoutDateIn = matchingVehicles.find(
      (m) => !m['Date IN'] || m['Date IN'].trim() === ''
    );
    if (vehicleWithoutDateIn) {
  // ...
      return vehicleWithoutDateIn['Damage Details'] || '';
    }
    // إذا لم يوجد أي صف بدون Date IN، لا تعرض أي نتيجة
  // ...
    return '';
  } else {
  // ...
  }
  return '';
};

// Main component for the contracts table
export default function ContractsTable() {
  // جلب البيانات عبر عامل ويب
  useEffect(() => {
    setLoading(true);
    setError(null);
    // استخدم عامل الويب من مجلد public
    const worker = new window.Worker(process.env.PUBLIC_URL + '/contractsDataWorker.js');
    worker.postMessage({
      googleSheetsUrls: GOOGLE_SHEETS_URLS,
      columnMappings: COLUMN_MAPPINGS
    });
    worker.onmessage = (event) => {
      const { allContracts, maintenanceData, carsData, partialData, progress, error } = event.data;
      
      if (error) {
        setError(error);
        setLoading(false);
      } else if (partialData) {
        // تحديث البيانات الجزئية (العقود المفتوحة أولاً)
        setAllContracts(partialData.allContracts || []);
        setMaintenanceData(partialData.maintenanceData || []);
        setCarsData(partialData.carsData || []);
        // لا نوقف التحميل هنا لأن باقي البيانات لسه جاية
      } else if (allContracts) {
        // البيانات النهائية الكاملة
        setAllContracts(allContracts || []);
        setMaintenanceData(maintenanceData || []);
        setCarsData(carsData || []);
        setLoading(false);
      }
    };
    return () => worker.terminate();
  }, []);
  // خاصية الأعمدة المختارة للعرض مع الحفظ في localStorage
  const VISIBLE_COLUMNS_KEY = 'contracts_visible_columns';
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem(VISIBLE_COLUMNS_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (visibleColumns) {
      localStorage.setItem(VISIBLE_COLUMNS_KEY, JSON.stringify(visibleColumns));
    }
  }, [visibleColumns]);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showMultiContract, setShowMultiContract] = useState(false);
  const [allContracts, setAllContracts] = useState([]);
  const [maintenanceData, setMaintenanceData] = useState([]);
  const [carsData, setCarsData] = useState([]);
  const [showExpiredCars, setShowExpiredCars] = useState(false);
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
  const [isFilterChanging, setIsFilterChanging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [xlsxReady, setXlsxReady] = useState(false);
  
  // تحميل مكتبة XLSX
  useEffect(() => {
    if (window.XLSX) {
      setXlsxReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = () => setXlsxReady(true);
    document.head.appendChild(script);
  }, []);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [dropdown, setDropdown] = useState({ visible: false, row: null, position: null });
  
  // New states for multi-car contracts analysis
  const [currentPage, setCurrentPage] = useState('main'); // 'main' or 'multicar'
  const [multiCarData, setMultiCarData] = useState([]);
  const [multiCarResults, setMultiCarResults] = useState([]);
  
  const [columnWidths, setColumnWidths] = useState({
      customer: 140, contractNo: 160, invygoPlate: 150, 
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
    // ...
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

  
  

  // Parse date in DD/MM/YYYY format
  const parseDate = (dateStr) => {
      if (!dateStr) return null;
      
      // Handle DD/MM/YYYY format
      const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (match) {
          const day = parseInt(match[1]);
          const month = parseInt(match[2]) - 1; // JS months are 0-based
          const year = parseInt(match[3]);
          return new Date(year, month, day);
      }
      
      // Fallback to native Date parsing
      return new Date(dateStr);
  };

  // Check if car registration is expired
  const isCarExpired = (plateNo) => {
      if (!plateNo || !carsData.length) return false;
      const normalizedPlate = normalize(plateNo);
      const car = carsData.find(car => normalize(car['Plate No']) === normalizedPlate);
      if (!car || !car['Reg Exp']) return false;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day
      
      const expDate = parseDate(car['Reg Exp']);
      if (!expDate || isNaN(expDate.getTime())) return false;
      
      expDate.setHours(23, 59, 59, 999); // Set to end of expiry day
      return expDate < today;
  };

  // Get expiry date for a plate
  const getExpiryDate = (plateNo) => {
      if (!plateNo || !carsData.length) return null;
      const normalizedPlate = normalize(plateNo);
      const car = carsData.find(car => normalize(car['Plate No']) === normalizedPlate);
      return car ? car['Reg Exp'] : null;
  };

  // Debug function - add console logging
  useEffect(() => {
      if (carsData.length > 0) {
          // ...
          
          // Test specific plates
          const testPlates = ['S 61759', 'S 68485'];
          testPlates.forEach(plate => {
              const car = carsData.find(c => normalize(c['Plate No']) === normalize(plate));
              if (car) {
                  const expDate = parseDate(car['Reg Exp']);
                  const today = new Date();
          // ...
              } else {
                  // ...
              }
          });
      }
  }, [carsData]);

  // Get expired cars list
  const getExpiredCars = () => {
      if (!carsData.length) return [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      return carsData.filter(car => {
          if (!car['Reg Exp']) return false;
          const expDate = parseDate(car['Reg Exp']);
          if (!expDate || isNaN(expDate.getTime())) return false;
          
          expDate.setHours(23, 59, 59, 999);
          return expDate < today;
      });
  };

  const openContracts = useMemo(() => allContracts.filter(c => c.type === 'open'), [allContracts]);


  // invygoCounts: يعتمد فقط على openContracts
  const invygoCounts = useMemo(() => {
    return openContracts.reduce((acc, row) => {
      const plate = normalize(row.invygoPlate);
      if (plate) acc[plate] = (acc[plate] || 0) + 1;
      return acc;
    }, {});
  }, [openContracts]);

  // mismatchRows: يعتمد على openContracts و isMismatch
  const mismatchRows = useMemo(() => openContracts.filter(isMismatch), [openContracts]);

  // switchbackRows: يعتمد على mismatchRows و maintenanceData
  const switchbackRows = useMemo(() => {
    return mismatchRows.filter(row => isMismatch(row) && getLatestDateIn(row, maintenanceData));
  }, [mismatchRows, maintenanceData]);

  // expiredRows: يعتمد على openContracts و carsData
  const expiredRows = useMemo(() => {
    return openContracts.filter(contract => {
        const plates = [contract.ejarPlate, contract.invygoPlate, contract.plateNo1, contract.plateNo2].filter(Boolean);
        return plates.some(plate => isCarExpired(plate));
    });
  }, [openContracts, carsData]);

  // dataToDisplay: يعتمد على filterMode و debouncedSearchTerm فقط
  const { filteredData, openContractsFromSearch, closedContractsFromSearch } = useMemo(() => {
    if (debouncedSearchTerm.trim() === '') {
        if (filterMode === FILTER_MODES.MISMATCH) return { filteredData: mismatchRows, openContractsFromSearch: [], closedContractsFromSearch: [] };
        if (filterMode === FILTER_MODES.SWITCHBACK) return { filteredData: switchbackRows, openContractsFromSearch: [], closedContractsFromSearch: [] };
        if (filterMode === FILTER_MODES.EXPIRED) return { filteredData: expiredRows, openContractsFromSearch: [], closedContractsFromSearch: [] };
        return { filteredData: openContracts, openContractsFromSearch: [], closedContractsFromSearch: [] };
    }
    
    const s = debouncedSearchTerm.trim().toLowerCase();
    const searchResults = allContracts.filter(row =>
        Object.values(row).some(val => val && val.toString().toLowerCase().includes(s))
    );
    
    return {
        filteredData: searchResults,
        openContractsFromSearch: searchResults.filter(c => c.type === 'open'),
        closedContractsFromSearch: searchResults.filter(c => c.type !== 'open')
    };
  }, [filterMode, debouncedSearchTerm]);

  const mismatchCount = useMemo(() => mismatchRows.length, [mismatchRows]);
  const switchbackCount = useMemo(() => switchbackRows.length, [switchbackRows]);
  const expiredCount = useMemo(() => expiredRows.length, [expiredRows]);
  const openContractsCount = useMemo(() => openContracts.length, [openContracts]);

  const handleFilterChange = useCallback((newFilter) => {
    setFilterMode(newFilter);
  }, []);

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

* A photo of the maintenance sticker once open driver door

* or details of the issue (if available)

We are here to serve you, Thank you.`;
            copyAndOpenWhatsApp(row, template, 'Welcome message copied!');
        }},
        ...(isMismatch(row) && getLatestDateIn(row, maintenanceData) ? [{ label: '3 - Switch Back Request', action: () => {
            const template = `Good day, this is Mohamed from Invygo – Yelo Rent A Car. Your original car is ready, and we need to switch it back as per your booking (#XXXXXX). Please let me know a suitable time today and share your location. Thank you!`;
            copyAndOpenWhatsApp(row, template, 'Switch back request copied!');
        }}] : []),
        { label: `${isMismatch(row) && getLatestDateIn(row, maintenanceData) ? '4' : '3'} - Close Complaint`, action: () => {
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
      
      // Prepare data with expiry information
      const exportData = filteredData.map(row => {
        const exportRow = { ...row };
        
        // Add expiry information for plates
        const plates = [row.ejarPlate, row.invygoPlate, row.plateNo1, row.plateNo2].filter(Boolean);
        const expiredPlates = plates.filter(plate => isCarExpired(plate));
        
        if (expiredPlates.length > 0) {
          exportRow['Expired_Cars'] = 'YES';
          exportRow['Expired_Plates'] = expiredPlates.join(', ');
          exportRow['Expiry_Dates'] = expiredPlates.map(plate => getExpiryDate(plate)).join(', ');
        } else {
          exportRow['Expired_Cars'] = 'NO';
          exportRow['Expired_Plates'] = '';
          exportRow['Expiry_Dates'] = '';
        }
        
        return exportRow;
      });
      
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Contracts");
      
      // Generate appropriate filename based on filter mode
      const today = new Date().toISOString().slice(0,10);
      let filename;
      
      if (debouncedSearchTerm.trim() !== '') {
        filename = `Search_Results_${today}.xlsx`;
      } else {
        switch (filterMode) {
          case FILTER_MODES.ALL:
            filename = `All_Contracts_${today}.xlsx`;
            break;
          case FILTER_MODES.MISMATCH:
            filename = `Replacement_Contracts_${today}.xlsx`;
            break;
          case FILTER_MODES.SWITCHBACK:
            filename = `Switch_Back_Contracts_${today}.xlsx`;
            break;
          case FILTER_MODES.EXPIRED:
            filename = `Expired_Cars_Contracts_${today}.xlsx`;
            break;
          default:
            filename = `Contracts_Report_${today}.xlsx`;
        }
      }
      
      XLSX.writeFile(wb, filename);
      showToastNotification(`Excel file exported: ${filename}`);
    } catch (error) {
      showToastNotification("Export failed!");
    } finally {
      setExporting(false);
    }
  }, [xlsxReady, filteredData, filterMode, debouncedSearchTerm, isCarExpired, getExpiryDate]);
  
  const headersConfig = {
  open: ['contractNo', 'bookingNumber', 'customer', 'invygoModel', 'invygoPlate', 'ejarModel', 'ejarPlate', 'phoneNumber', 'pickupDate', 'dropoffDate', 'issue'],
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
    issue: 'Issue'
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
  
  const DataTable = memo(({ data, headers, onPhoneClick, onCustomerClick, maintenanceData }) => (
    <div className="data-table-container">
      <table className="data-table">
        <thead className="table-header">
          <tr>
            <th className="table-cell" style={{width: 50, position: 'relative'}}>
              #<ColumnResizer onResize={(newWidth) => handleColumnResize('#', newWidth)} />
              <button
                style={{ marginLeft: 6, cursor: 'pointer', background: 'none', border: 'none', fontSize: 18 }}
                title="تخصيص الأعمدة"
                onClick={e => { e.stopPropagation(); setShowColumnMenu(v => !v); }}
              >⚙️</button>
              {showColumnMenu && (
                <ColumnMenu
                  headers={headers}
                  visibleColumns={visibleColumns}
                  setVisibleColumns={setVisibleColumns}
                  setShowColumnMenu={setShowColumnMenu}
                  headerDisplayNames={headerDisplayNames}
                />
              )}
            </th>
            {(visibleColumns ? headers.filter(h => visibleColumns.includes(h)) : headers).map((headerKey) => (
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
            const hasExpiredCar = row.type === 'open' && [row.ejarPlate, row.invygoPlate, row.plateNo1, row.plateNo2].filter(Boolean).some(plate => isCarExpired(plate));
            
            const rowClassName = isDuplicated ? "duplicated-row"
              : hasExpiredCar ? "expired-row"
              : isCarRepaired ? "repaired-row"
              : mismatch ? "mismatch-row"
              : idx % 2 === 0 ? "even-row"
              : "odd-row";

            const copyIndexText = () => {
                if (row.type !== 'open') return;
                const firstName = (row.customer || "").split(" ")[0];
                const phone = row.phoneNumber || "";
                
                // التحقق من أن الصف فعلاً يحتاج switch back (mismatch + repaired)
                const needsSwitchBack = isMismatch(row) && getLatestDateIn(row, maintenanceData);
                
                let text;
                if (needsSwitchBack) {
                    text = `${row.bookingNumber} - Switch Back\n\n${firstName} - ${phone}\n\nOld car / ${row.ejarModel} - ${row.ejarPlate}\n\nNew car / ${row.invygoModel} - ${row.invygoPlate}`;
                } else {
                    text = `${row.bookingNumber} - Switch\n\n${firstName} - ${phone}\n\nOld car / ${row.ejarModel} - ${row.ejarPlate}\n\nNew car /`;
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
                {(visibleColumns ? headers.filter(h => visibleColumns.includes(h)) : headers).map((headerKey) => {
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
                  } else if (row.type === 'open' && (headerKey === 'invygoPlate' || headerKey === 'ejarPlate')) {
                      const isExpired = isCarExpired(value);
                      const expDate = getExpiryDate(value);
                      content = (
                          <span style={{ color: isExpired ? '#d32f2f' : 'inherit' }}>
                              {value} {isExpired && '⚠️'}
                              {expDate && <div style={{ fontSize: '0.8em', color: isExpired ? '#d32f2f' : '#666' }}>Exp: {expDate}</div>}
                          </span>
                      );
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
                  } else if (headerKey === 'issue') {
                    content = getIssueForRow(row, maintenanceData);
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
                        {hasExpiredCar && (headerKey === 'invygoPlate' || headerKey === 'ejarPlate') && isCarExpired(value) && (
                          <div className="duplicated-info" style={{ color: '#d32f2f' }}>
                            ⚠️ Registration Expired!
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
  
  // Show expired cars page
  if (showExpiredCars) {
      const expiredCars = getExpiredCars();
      return (
          <div className="contracts-dashboard">
              <div style={{ margin: '0 auto' }}>
                  <header className="dashboard-header">
                      <h1 style={{ color: '#d32f2f' }}>⚠️ Expired Cars ({expiredCars.length})</h1>
                      <button 
                          className="control-button" 
                          onClick={() => setShowExpiredCars(false)}
                          style={{ marginBottom: 20 }}
                      >
                          ← Back to Contracts
                      </button>
                  </header>
                  
                  <div className="data-table-container">
                      <table className="data-table">
                          <thead className="table-header">
                              <tr>
                                  <th className="table-cell">Plate No.</th>
                                  <th className="table-cell">Model</th>
                                  <th className="table-cell">Expiry Date</th>
                                  <th className="table-cell">Days Expired</th>
                              </tr>
                          </thead>
                          <tbody>
                              {expiredCars.map((car, index) => {
                                  const expDate = parseDate(car['Reg Exp']);
                                  const today = new Date();
                                  const daysDiff = Math.floor((today - expDate) / (1000 * 60 * 60 * 24));
                                  
                                  return (
                                      <tr key={index} className="mismatch-row">
                                          <td className="table-cell" style={{ fontWeight: 'bold', color: '#d32f2f' }}>
                                              {car['Plate No']} ⚠️
                                          </td>
                                          <td className="table-cell">
                                              {car['Model'] || car['Make'] || 'غير محدد'}
                                          </td>
                                          <td className="table-cell" style={{ color: '#d32f2f' }}>
                                              {car['Reg Exp']}
                                          </td>
                                          <td className="table-cell" style={{ color: '#d32f2f', fontWeight: 'bold' }}>
                                              {daysDiff} days
                                          </td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>
                  
                  {expiredCars.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 40, color: '#4caf50', fontSize: 18 }}>
                          ✓ No expired cars found
                      </div>
                  )}
              </div>
          </div>
      );
  }

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
            <button className="control-button" onClick={() => {
              // مسح الـ cache وإعادة تحميل البيانات
              localStorage.clear();
              if ('indexedDB' in window) {
                indexedDB.deleteDatabase('ContractsCache');
              }
              window.location.reload();
            }} title="مسح الذاكرة المؤقتة وإعادة تحميل البيانات">🔄 Refresh Cache</button>
        </div>

    {debouncedSearchTerm.trim() === '' && (
      <div className="controls-container">
        <button className="control-button" onClick={() => handleFilterChange(FILTER_MODES.ALL)}>📋 All ({openContractsCount})</button>
        <button className="control-button" onClick={() => handleFilterChange(FILTER_MODES.MISMATCH)}>♻️ Replacements ({mismatchCount})</button>
        <button className="control-button" onClick={() => handleFilterChange(FILTER_MODES.SWITCHBACK)}>🔁 Switch Back ({switchbackCount})</button>
        <button className="control-button" onClick={() => handleFilterChange(FILTER_MODES.EXPIRED)} style={{backgroundColor: expiredCount > 0 ? '#d32f2f' : undefined, color: expiredCount > 0 ? 'white' : undefined}}>⚠️ Expired Cars ({expiredCount})</button>
        <button className="control-button" onClick={() => setShowMultiContract(true)}>🚗 Multi-Car Contracts</button>
      </div>
    )}

        {loading && allContracts.length === 0 ? (
          <p className="loading-message">Loading...</p>
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
                  maintenanceData={maintenanceData}
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
                  maintenanceData={maintenanceData}
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
                data={filterMode === 'all' ? openContracts : (filteredData || [])} 
                headers={getHeadersForData(filterMode === 'all' ? openContracts : (filteredData || []))} 
                onPhoneClick={handlePhoneClick}
                onCustomerClick={handleCustomerClick}
                maintenanceData={maintenanceData}
              />

              {(!filteredData || filteredData.length === 0) && !loading && allContracts.length > 0 && openContracts.length === 0 && (
                <p className="no-contracts-message">No contracts found for your criteria.</p>
              )}
              {(!filteredData || filteredData.length === 0) && !loading && allContracts.length === 0 && (
                <p className="no-contracts-message">Loading data...</p>
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