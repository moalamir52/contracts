import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom'; // Using hook for navigation in V6
import Papa from 'papaparse';
import UploadArea from './UploadArea';
import ResultsList from './ResultsList';
import './multiContract.styles.css';
import { normalize } from '../../utils/normalize';
import { dbService } from '../../services/db';

export default function MultiContractPage() {
    const navigate = useNavigate();
    const [results, setResults] = useState([]);
    const [uploadSummary, setUploadSummary] = useState(null);
    const [bookingIdMap, setBookingIdMap] = useState(new Map());
    const [search, setSearch] = useState("");
    const [currentSearchInput, setCurrentSearchInput] = useState("");
    const [selectedContract, setSelectedContract] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [processingStatus, setProcessingStatus] = useState('');

    // Worker setup
    const workerRef = React.useRef(null);

    useEffect(() => {
        // Instantiate worker on mount
        workerRef.current = new Worker(new URL("../../workers/multiCarWorker.js", import.meta.url));

        workerRef.current.onmessage = (event) => {
            const { success, results, summary, error, progress } = event.data;

            if (progress) {
                setProcessingStatus(progress);
                return;
            }

            if (success) {
                setResults(results || []);
                setUploadSummary(summary);

                // Save to IndexedDB (Async)
                dbService.save('results', results).catch(e => console.error("DB Save Error", e));
                dbService.save('summary', summary).catch(e => console.error("DB Save Error", e));

                setUploading(false);
                setProcessingStatus('');
            } else if (error) {
                console.error('Worker error:', error);
                alert('Error processing file: ' + error);
                setUploading(false);
                setProcessingStatus('');
            }
        };

        // Load saved data from IndexedDB
        const loadSavedData = async () => {
            try {
                const savedResults = await dbService.get('results');
                if (savedResults) setResults(savedResults);

                const savedSummary = await dbService.get('summary');
                if (savedSummary) setUploadSummary(savedSummary);
            } catch (err) {
                console.error("Failed to load saved data", err);
            }
        };
        loadSavedData();

        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
            }
        };
    }, []);

    const handleFileUpload = (file) => {
        if (!file) return;
        setUploading(true);
        setResults([]);
        setUploadSummary(null);
        setProcessingStatus('Reading file...');

        // Reset worker state
        if (workerRef.current) workerRef.current.postMessage({ type: 'RESET' });


        Papa.parse(file, {
            header: true,
            worker: true, // Papa's worker
            skipEmptyLines: true,
            chunk: ({ data }) => {
                // Forward chunk to our worker

                if (workerRef.current) workerRef.current.postMessage({ type: "CHUNK", data });
            },
            complete: () => {
                if (workerRef.current) workerRef.current.postMessage({ type: "DONE" });
            },
            error: (err) => {
                console.error("Papa Parse Error", err);
                alert("Error parsing CSV");
                setUploading(false);
            }
        });
    };

    const handleBookingIdFileUpload = (file) => {
        if (!file) return;
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const map = new Map();
                results.data.forEach(row => {
                    const agreement = row['Agreement'];
                    const bookingId = row['Booking ID'];
                    if (agreement && bookingId) {
                        map.set(String(agreement), String(bookingId));
                    }
                });
                setBookingIdMap(map);
            }
        });
    };

    // Filter Logic
    const filteredResults = useMemo(() => {
        if (!search.trim()) return results;

        const s = search.trim().toLowerCase();
        const sNorm = normalize(s);

        return results.filter(row => {
            const cNo = row.contractNo || row.contract;
            if (cNo && (cNo.toLowerCase().includes(s) || normalize(cNo).includes(sNorm))) return true;

            const cName = row.customerName || row['Customer Name'];
            if (cName && (cName.toLowerCase().includes(s) || normalize(cName).includes(sNorm))) return true;

            if (row.carsCount && row.carsCount.toString() === s) return true;

            const bookingId = bookingIdMap.get(cNo) || '';
            if (bookingId && (bookingId.toLowerCase().includes(s) || normalize(bookingId).includes(sNorm))) return true;

            // Check cars
            if (row.carDetails) {
                return row.carDetails.some(c =>
                    c.plateNumber.toLowerCase().includes(s) || normalize(c.plateNumber).includes(sNorm)
                );
            }
            return false;
        });
    }, [search, results, bookingIdMap]);

    return (
        <div className="multi-contract-page">
            {uploading && (
                <div className="processing-overlay">
                    <div className="processing-box">
                        <div className="spinner" />
                        <span className="processing-text">{processingStatus || 'Processing...'}</span>
                    </div>
                </div>
            )}

            <button className="back-button" onClick={() => navigate('/')}>← Back</button>

            <div className="page-header">
                <div className="title-box">
                    <h2 className="page-title">Multi-Car Contracts</h2>
                </div>
            </div>

            <UploadArea
                onFileUpload={handleFileUpload}
                onBookingIdUpload={handleBookingIdFileUpload}
                uploading={uploading}
            />

            {uploadSummary && (
                <div className="summary-box">
                    <h3 className="summary-title">File Upload Summary</h3>
                    <table className="summary-table">
                        <tbody>
                            <tr style={{ background: '#fffde7' }}>
                                <td className="summary-label">Total Rows</td>
                                <td className="summary-value">{uploadSummary.totalRows}</td>
                            </tr>
                            <tr style={{ background: '#fff' }}>
                                <td className="summary-label">Total Contracts</td>
                                <td className="summary-value">{uploadSummary.totalContracts}</td>
                            </tr>
                            <tr style={{ background: '#fffde7' }}>
                                <td className="summary-label">Single Car Contracts</td>
                                <td className="summary-value">{uploadSummary.singleCarContracts}</td>
                            </tr>
                            <tr style={{ background: '#fff' }}>
                                <td className="summary-label">Multi-Car Contracts</td>
                                <td className="summary-value">{uploadSummary.multiCarContracts}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            <div className="search-container">
                <input
                    className="search-input"
                    type="text"
                    value={currentSearchInput}
                    onChange={e => setCurrentSearchInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && setSearch(currentSearchInput)}
                    placeholder="Search contract, booking ID, plate, customer..."
                />
                <button className="action-button" onClick={() => setSearch(currentSearchInput)}>Search</button>
                <button className="action-button" onClick={() => {
                    setSearch("");
                    setCurrentSearchInput("");
                    setResults([]);
                    setUploadSummary(null);
                    dbService.clear().catch(console.error);
                }}>Reset</button>
            </div>

            <ResultsList
                results={filteredResults}
                bookingIdMap={bookingIdMap}
                onSelectContract={setSelectedContract}
            />

            {/* Contract Modal - Reusing/Porting later, or using inline simple modal if needed? */}
            {/* For now, ignoring selectedContract modal as it wasn't Critical Path, or reusing the one from components */}
            {/* I should probably port ContractModal to src/components/ContractModal first? */}
            {/* I will add a placeholder or conditional render if I haven't moved it yet. Plan says Step 7 for Modal. */}
            {/* I'll leave it hooked up in logic but UI absent until Step 7? No, I should import the OLD one if needed or just wait. */}
            {/* I will allow it to be null for now, or just render nothing. */}

        </div>
    );
}
