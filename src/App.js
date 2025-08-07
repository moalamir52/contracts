import { useState, useEffect, useMemo } from "react";

// The XLSX library is now loaded dynamically via a script tag, so the import is removed.

// نافذة مبسطة لعرض بيانات العقد
function ContractModal({ contract, onClose }) {
  if (!contract) return null;

  // We convert the internal keys back to display-friendly names for the modal
  const displayContract = {};
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

  // Create a display-friendly version of the contract object
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
        background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex',
        alignItems: 'center', justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 12, padding: 32, minWidth: 320,
          maxWidth: 500, boxShadow: '0 4px 24px #0002', position: 'relative'
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 16, background: '#ff0800',
            color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px',
            fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          X
        </button>
        <h2 style={{ color: '#6a1b9a', marginBottom: 16 }}>Contract Details</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {Object.entries(finalDisplayContract).map(([key, val]) => (
              <tr key={key}>
                <td style={{ fontWeight: 'bold', padding: 8, borderBottom: '1px solid #eee', color: '#6a1b9a' }}>{key}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Main component for the contracts table
export default function ContractsTable() {
  // State management
  const [allContracts, setAllContracts] = useState([]);
  const [maintenanceData, setMaintenanceData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [xlsxReady, setXlsxReady] = useState(false);
  
  const columnMappings = {
    open: {
      'Contract No.': 'contractNo', 'Booking Number': 'bookingNumber', 'Customer': 'customer',
      'Model ( Ejar )': 'ejarModel', 'EJAR': 'ejarPlate', 'Model': 'invygoModel',
      'INVYGO': 'invygoPlate', 'Phone Number': 'phoneNumber', 'Pick-up Date': 'pickupDate',
      'Replacement Date': 'replacementDate'
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

  const normalize = (str) => (str || "").toLowerCase().replace(/\s+/g, "").trim();
  
  const fetchSheet = async (url, viewMode) => {
      const response = await fetch(url);
      const text = await response.text();
      const rows = text.split("\n").map((r) => r.split(",").map(c => c.trim().replace(/^"|"$/g, '')));
      const headerIndex = rows.findIndex(row => row.some(cell => cell));
      if (headerIndex === -1) return [];
      const headers = rows[headerIndex].map(h => h.trim()); // FIX: Trim whitespace from headers
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
      } else { // Handles 'open'
          return dataRows
              .filter(r => r.length === headers.length && r.some(c => c))
              .map(r => Object.fromEntries(r.map((c, i) => [headers[i], c])));
      }
  };

  const normalizeData = (rawData, viewMode) => {
      const mapping = columnMappings[viewMode];
      return rawData.map(rawRow => {
          const normalizedRow = { type: viewMode }; // Keep the specific viewMode as type
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
    // Dynamically load the SheetJS/XLSX library
    const script = document.createElement('script');
    script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
    script.async = true;
    script.onload = () => {
      setXlsxReady(true);
    };
    document.body.appendChild(script);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const openContractsUrl = "https://docs.google.com/spreadsheets/d/1XwBko5v8zOdTdv-By8HK_DvZnYT2T12mBw_SIbCfMkE/export?format=csv&gid=769459790";
            const closedInvygoUrl = "https://docs.google.com/spreadsheets/d/1XwBko5v8zOdTdv-By8HK_DvZnYT2T12mBw_SIbCfMkE/export?format=csv&gid=1830448171";
            const closedOtherUrl = "https://docs.google.com/spreadsheets/d/1XwBko5v8zOdTdv-By8HK_DvZnYT2T12mBw_SIbCfMkE/export?format=csv&gid=375289726";
            const maintenanceUrl = "https://docs.google.com/spreadsheets/d/1v4rQWn6dYPVQPd-PkhvrDNgKVnexilrR2XIUVa5RKEM/export?format=csv&gid=0";

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
            setError("Failed to load data.");
        } finally {
            setLoading(false);
        }
    };

    loadAllData();

    // Cleanup the script when the component unmounts
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const isMismatch = (row) => {
    const isNumeric = !isNaN(Number(row.bookingNumber));
    const ejar = normalize(row.ejarPlate);
    const invygo = normalize(row.invygoPlate);
    return isNumeric && ejar && invygo && ejar !== invygo;
  };

  const isCompleted = (row) => {
    const invygo = normalize(row.invygoPlate);
    const record = maintenanceData.find(m => normalize(m["Vehicle"]) === invygo);
    return record && !!record["Date IN"];
  };

  const { filteredData, mismatchCount, switchbackCount, invygoCounts, openContractsCount } = useMemo(() => {
    const openContracts = allContracts.filter(c => c.type === 'open');
    const invygoCounts = openContracts.reduce((acc, row) => {
      const plate = normalize(row.invygoPlate);
      if (plate) acc[plate] = (acc[plate] || 0) + 1;
      return acc;
    }, {});

    const mismatchRows = openContracts.filter(isMismatch);
    const switchbackRows = mismatchRows.filter(row => isMismatch(row) && isCompleted(row));

    let dataToDisplay;
    if (searchTerm.trim() === '') {
        if (filterMode === "mismatch") dataToDisplay = mismatchRows;
        else if (filterMode === "switchback") dataToDisplay = switchbackRows;
        else dataToDisplay = openContracts;
    } else {
        const normalizedSearch = normalize(searchTerm);
        const idFields = ['contractNo', 'bookingNumber', 'invygoPlate', 'ejarPlate', 'phoneNumber'];
        
        dataToDisplay = allContracts.filter(row => {
            const hasIdMatch = idFields.some(key => normalize(row[key] || '').startsWith(normalizedSearch));
            const hasCustomerMatch = normalize(row['customer'] || '').includes(normalizedSearch);
            return hasIdMatch || hasCustomerMatch;
        });
    }

    return {
      filteredData: dataToDisplay,
      mismatchCount: mismatchRows.length,
      switchbackCount: switchbackRows.length,
      invygoCounts,
      openContractsCount: openContracts.length
    };
  }, [allContracts, maintenanceData, searchTerm, filterMode]);

  // Use legacy copy command for better compatibility in sandboxed environments
  const copyToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; // Make it invisible
    textArea.style.top = "-9999px";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
    }
    document.body.removeChild(textArea);
  };

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
      open: ['contractNo', 'bookingNumber', 'customer', 'invygoModel', 'invygoPlate', 'ejarModel', 'ejarPlate', 'phoneNumber', 'pickupDate',],
      closed_invygo: ['contractNo', 'bookingNumber', 'customer', 'pickupBranch', 'invygoPlate', 'model1', 'ejarPlate', 'invygoModel', 'pickupDate', 'contact', 'dropoffDate'],
      closed_other: ['contractNo', 'bookingNumber', 'customer', 'pickupBranch', 'invygoPlate', 'invygoModel', 'pickupDate', 'dropoffDate'],
      master: ['contractNo', 'contractType', 'bookingNumber', 'customer', 'invygoModel', 'invygoPlate', 'ejarModel', 'ejarPlate', 'model1', 'phoneNumber', 'pickupBranch', 'pickupDate', 'replacementDate', 'dropoffDate', 'contact']
  };

  const headerDisplayNames = {
    contractNo: 'Contract No.', bookingNumber: 'Booking Number', customer: 'Customer',
    invygoModel: 'Model', invygoPlate: 'Plate No.', ejarModel: 'Replace Model',
    ejarPlate: 'Rep Plate no.', phoneNumber: 'Phone Number', pickupBranch: 'Pick-up Branch',
    pickupDate: 'Pick-up Date', replacementDate: 'Replacement Date', dropoffDate: 'Drop-off Date',
    model1: 'Model (Repeated)', contact: 'Contact', contractType: 'Contract Type'
  };

  const getHeadersForData = (data) => {
    if (searchTerm.trim() === '') return headersConfig.open;

    if (data.length === 0) return headersConfig.open;

    const populatedKeys = new Set(['contractNo']); // Always show contract number
    data.forEach(row => {
        for (const key in row) {
            if (row[key] && key !== 'type') {
                populatedKeys.add(key);
            }
        }
    });

    // If search is active, always include the contractType column for clarity
    if (searchTerm.trim() !== '') {
        populatedKeys.add('contractType');
    }

    return headersConfig.master.filter(key => populatedKeys.has(key));
  };

  const headersToShow = getHeadersForData(filteredData);
  
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

  const cellStyle = {
    border: "1px solid #ccc", padding: "4px 6px", textAlign: "center",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  };
  
  const columnWidths = {
      customer: 180, contractNo: 160, invygoPlate: 150, 
      ejarPlate: 150, phoneNumber: 130, invygoModel: 180, 
      ejarModel: 180, bookingNumber: 130, contractType: 140, pickupBranch: 140
  };
  
  const contractTypeDisplay = {
      open: 'Open',
      closed_invygo: 'Closed (Invygo)',
      closed_other: 'Closed (Other)'
  };

  return (
    <div style={{ padding: 30, fontFamily: "Segoe UI", background: "#fff9e5", minHeight: "100vh" }}>
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

        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <button style={buttonStyle} onClick={() => setFilterMode("all")}>📋 All ({openContractsCount})</button>
            <button style={buttonStyle} onClick={() => setFilterMode("mismatch")}>♻️ Replacements ({mismatchCount})</button>
            <button style={buttonStyle} onClick={() => setFilterMode("switchback")}>🔁 Switch Back ({switchbackCount})</button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', fontWeight: 'bold', color: '#6a1b9a', fontSize: '1.2em' }}>Loading all contracts...</p>
        ) : error ? (
          <p style={{ color: "red", textAlign: 'center', fontWeight: 'bold' }}>{error}</p>
        ) : (
          <div id="contracts-table-container" style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: "collapse", width: "100%", margin: "0 auto" }}>
              <thead style={{ backgroundColor: "#ffd600" }}>
                <tr>
                  <th style={{...cellStyle, minWidth: 50}}>#</th>
                  {headersToShow.map((headerKey) => (
                    <th key={headerKey} style={{...cellStyle, minWidth: columnWidths[headerKey] || 120 }}>
                      {headerDisplayNames[headerKey] || headerKey}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, idx) => {
                  const isDuplicated = row.type === 'open' && invygoCounts[normalize(row.invygoPlate)] > 1;
                  const mismatch = row.type === 'open' && isMismatch(row);
                  const completed = mismatch && isCompleted(row);
                  
                  const backgroundColor = isDuplicated ? "#ff0800"
                    : completed ? "#ccffcc"
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
                      copyToClipboard(text);
                  };

                  return (
                    <tr key={`${row.contractNo || 'row'}-${idx}`} style={{ backgroundColor, color: textColor }}>
                      <td style={{...cellStyle, minWidth: 50}}>
                        <span onClick={copyIndexText} style={{ cursor: row.type === 'open' ? 'pointer' : 'default', color: '#6a1b9a', fontWeight: 'bold', textDecoration: row.type === 'open' ? 'underline' : 'none' }} title="Click to copy WhatsApp message">
                            {idx + 1}
                        </span>
                      </td>
                      {headersToShow.map((headerKey) => {
                        const value = row[headerKey] || '';
                        
                        let content = value;
                        if (headerKey === 'contractType') {
                            content = <span style={{fontWeight: 'bold'}}>{contractTypeDisplay[row.type]}</span>
                        } else if (row.type === 'open') {
                            if (headerKey === 'phoneNumber') {
                                content = <a href={`https://wa.me/${value.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ color: isDuplicated ? '#fff' : '#25D366', textDecoration: 'none', fontWeight: 'bold' }}>{value}</a>;
                            } else if (headerKey === 'contractNo') {
                                content = <a href="https://ejar.iyelo.com:6300/app/rental/contracts" onClick={(e) => { e.preventDefault(); copyToClipboard(value); window.open(e.currentTarget.href, "_blank"); }} style={{ color: isDuplicated ? '#fff' : '#1976d2', textDecoration: 'none', fontWeight: 'bold', cursor: 'pointer' }}>{value}</a>;
                            } else if (headerKey === 'bookingNumber') {
                                content = <a href="https://dashboard.invygo.com/bookings" onClick={(e) => { e.preventDefault(); copyToClipboard(value); window.open(e.currentTarget.href, "_blank"); }} style={{ color: isDuplicated ? '#fff' : '#0077b5', textDecoration: 'none', fontWeight: 'bold', cursor: 'pointer' }}>{value}</a>;
                            }
                        }

                        return (
                            <td key={headerKey} style={{...cellStyle, minWidth: columnWidths[headerKey] || 120 }} title={value}>
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
            {filteredData.length === 0 && !loading && (
                <p style={{ textAlign: 'center', color: '#555', padding: '20px' }}>No contracts found for your criteria.</p>
            )}
          </div>
        )}
      </div>
      {showModal && (
        <ContractModal contract={selectedContract} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
