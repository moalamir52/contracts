import { useState, useEffect, useMemo } from 'react';
import { normalize, parseSheetDate, normalizePhoneNumber } from '../utils';

export const useContracts = () => {
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

    const fetchSheet = async (url, viewMode) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch sheet: ${response.statusText}`);
        }
        const text = await response.text();
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

    const { openContractsData, closedContractsData, mismatchCount, switchbackCount, invygoCounts, openContractsCount } = useMemo(() => {
        const openContracts = allContracts.filter(c => c.type === 'open');
        const closedContracts = allContracts.filter(c => c.type !== 'open');
        const invygoCounts = openContracts.reduce((acc, row) => {
          const plate = normalize(row.invygoPlate);
          if (plate) acc[plate] = (acc[plate] || 0) + 1;
          return acc;
        }, {});
    
        const mismatchRows = openContracts.filter(isMismatch);
        const switchbackRows = mismatchRows.filter(row => isMismatch(row) && getLatestDateIn(row));

        let finalOpenData, finalClosedData;

        if (searchTerm.trim() === '') {
            if (filterMode === "mismatch") {
                finalOpenData = mismatchRows;
            } else if (filterMode === "switchback") {
                finalOpenData = switchbackRows;
            } else {
                finalOpenData = openContracts;
            }
            finalClosedData = []; // No closed contracts in default view
        } else {
            const s = searchTerm.trim().toLowerCase();
            const searchFilter = row => Object.values(row).some(
                val => val && val.toString().toLowerCase().includes(s)
            );
    
            finalOpenData = openContracts.filter(searchFilter);
            finalClosedData = closedContracts.filter(searchFilter);
        }
    
        return {
          openContractsData: finalOpenData,
          closedContractsData: finalClosedData,
          mismatchCount: mismatchRows.length,
          switchbackCount: switchbackRows.length,
          invygoCounts,
          openContractsCount: openContracts.length
        };
      }, [allContracts, maintenanceData, searchTerm, filterMode]);

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
        const dataToExport = searchTerm.trim() ? [...openContractsData, ...closedContractsData] : openContractsData;
        const ws = XLSX.utils.json_to_sheet(dataToExport);
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

    return {
        showMultiContract,
        setShowMultiContract,
        searchTerm,
        setSearchTerm,
        filterMode,
        setFilterMode,
        loading,
        error,
        selectedContract,
        setSelectedContract,
        showModal,
        setShowModal,
        xlsxReady,
        toastMessage,
        showToast,
        dropdown,
        setDropdown,
        columnWidths,
        setColumnWidths,
        handleColumnResize,
        openContractsData,
        closedContractsData,
        mismatchCount,
        switchbackCount,
        invygoCounts,
        openContractsCount,
        handlePhoneClick,
        closeDropdown,
        handleCustomerClick,
        getDropdownOptions,
        exportToExcel,
        getHeadersForData,
        copyToClipboard,
        isMismatch,
        getLatestDateIn,
        getDaysSinceLatestIn,
        allContracts
    };
};