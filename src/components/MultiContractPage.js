import { useState, useEffect, useRef } from "react";
import { List } from 'react-window';

function MultiContractPage({ 
    onBack, 
    results, 
    allUniqueContracts, 
    fileStats, 
    handleFileUpload, 
    isUploading, 
    resetData 
}) {
  const [search, setSearch] = useState("");
  const [selectedContract, setSelectedContract] = useState(null);

  const [filteredResults, setFilteredResults] = useState([]); // New state for filtered results
    const workerRef = useRef(null); // Ref to store the worker instance
    const tableContainerRef = useRef(null); // Ref for the table container to get its height

    // Initialize worker and handle messages
    useEffect(() => {
        workerRef.current = new Worker(new URL('../../src/workers/contractProcessor.js', import.meta.url));

        workerRef.current.onmessage = (event) => {
            const { type, payload } = event.data;
            if (type === 'SEARCH_RESULTS') {
                setFilteredResults(payload);
            } else if (type === 'FILE_PROCESSED') {
                // This case might not be strictly necessary here if App.js handles initial data,
                // but it's good to have for completeness or if data flow changes.
                // For now, we'll assume App.js passes the initial processed data.
            }
        };

        // Clean up worker on component unmount
        return () => {
            workerRef.current.terminate();
        };
    }, []);

    // Effect to send initial data to worker and handle search term changes
    useEffect(() => {
        if (workerRef.current && (results.length > 0 || allUniqueContracts.length > 0)) {
            workerRef.current.postMessage({
                type: 'INITIALIZE_DATA',
                payload: { allUniqueContracts: allUniqueContracts, results: results }
            });

            // Trigger initial search or display all data
            workerRef.current.postMessage({
                type: 'SEARCH_DATA',
                payload: { searchTerm: search }
            });
        }
    }, [results, allUniqueContracts, search]); // Depend on results, allUniqueContracts, and search

    const handleSearchChange = (e) => {
        const newSearchTerm = e.target.value;
        setSearch(newSearchTerm);
        // Send search term to worker
        if (workerRef.current) {
            workerRef.current.postMessage({
                type: 'SEARCH_DATA',
                payload: { searchTerm: newSearchTerm }
            });
        }
    };

    const handleReset = () => {
        setSearch("");
        resetData();
        // Also tell the worker to reset its search and send back all data
        if (workerRef.current) {
            workerRef.current.postMessage({
                type: 'SEARCH_DATA',
                payload: { searchTerm: "" }
            });
        }
    };

    // Row component for react-window
    const Row = ({ index, style }) => {
        const row = filteredResults[index];
        if (!row) return null; // Should not happen with correct itemCount

        return (
            <tr key={index} style={{ ...style, background: index % 2 === 0 ? '#fffde7' : '#fff', transition: 'background 0.2s' }}>
                <td style={{ minWidth: 80, padding: 12, border: '1px solid #e0e0e0', verticalAlign: 'middle', fontWeight: 'bold', textAlign: 'center', fontSize: 15 }}>
                  <button
                    style={{ background: 'none', border: 'none', color: '#6a1b9a', fontWeight: 'bold', fontSize: 15, cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => setSelectedContract(row)}
                    title="Show contract details"
                  >
                    {row.contract}
                  </button>
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
        );
    };

  return (
    <div style={{ padding: 30, fontFamily: "Segoe UI", background: "#fff9e5", minHeight: "100vh" }}>
      {isUploading && (
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

      {fileStats && (
        <div style={{ 
            textAlign: 'center', 
            margin: '20px auto', 
            padding: '15px', 
            background: '#fffde7', 
            borderRadius: '12px', 
            border: '2px solid #ffd600', 
            maxWidth: '600px', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
        }}>
            <h3 style={{ color: '#6a1b9a', marginTop: 0, marginBottom: '15px' }}>File Statistics</h3>
            <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
                <div style={{ margin: '5px 10px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#6a1b9a' }}>{fileStats.totalRows}</span>
                    <p style={{ margin: '5px 0 0 0', color: '#888' }}>Total Rows</p>
                </div>
                <div style={{ margin: '5px 10px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#6a1b9a' }}>{fileStats.uniqueContracts}</span>
                    <p style={{ margin: '5px 0 0 0', color: '#888' }}>Unique Contracts</p>
                </div>
                <div style={{ margin: '5px 10px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#6a1b9a' }}>{fileStats.multiCarContracts}</span>
                    <p style={{ margin: '5px 0 0 0', color: '#888' }}>Multi-Car Contracts</p>
                </div>
            </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0', gap: 16, flexWrap: 'wrap' }}>
        <a
          href="/multi_car_template.csv"
          download
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
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 10px 0', justifyContent: 'center' }}>
        <input
          type="text"
          value={search}
          onChange={handleSearchChange}
          placeholder="Search all unique contracts..."
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
          onClick={handleReset}
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
      <div style={{ overflowX: 'auto', marginTop: 10 }} ref={tableContainerRef}>
  <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', margin: '0 auto', background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', borderRadius: 16, overflow: 'hidden', tableLayout: 'auto' }}>
          <thead>
            <tr style={{ background: 'linear-gradient(90deg,#ffd600 60%,#fffde7 100%)', color: '#6a1b9a', fontSize: 18 }}>
              <th style={{ minWidth: 80, padding: 12, border: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontSize: 17 }}>Contract No.</th>
              <th style={{ minWidth: 140, maxWidth: 180, width: 140, padding: 12, border: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontSize: 17 }}>Customer</th>
              <th style={{ minWidth: 120, padding: 12, border: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontSize: 17 }}>Cars (Plate & Dates)</th>
              <th style={{ minWidth: 80, padding: 12, border: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontSize: 17 }}>Cars Count</th>
            </tr>
          </thead>
          <tbody>
            {filteredResults.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#888', fontSize: 18 }}>No data</td></tr>
            ) : (
                <List
                    height={400} // Fixed height for the scrollable area
                    itemCount={filteredResults.length}
                    itemSize={150} // Estimated average row height (adjust as needed)
                    width="100%"
                >
                    {Row}
                </List>
            )}
          </tbody>
        </table>
      </div>
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
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Cars Count</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{selectedContract.carsCount}</td>
                </tr>
                <tr style={{ background: '#fff' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Pick-up Date</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{(selectedContract['Pick-up Date'] || '').replace(/ ?\+0?4:?0{0,2}/gi, '').trim()}</td>
                </tr>
                <tr style={{ background: '#fffde7' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Drop-off Date</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{(selectedContract['Drop-off Date'] || '').replace(/ ?\+0?4:?0{0,2}/gi, '').trim()}</td>
                </tr>
                <tr style={{ background: '#fff' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Customer Name</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{selectedContract['Customer Name']}</td>
                </tr>
                <tr style={{ background: '#fffde7' }}>
                  <td style={{ fontWeight: 'bold', color: '#6a1b9a', padding: '8px 12px', border: '1px solid #ffd600' }}>Customer Phone</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #ffd600' }}>{selectedContract['Customer Phone']}</td>
                </tr>
              </tbody>
            </table>
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

export default MultiContractPage;