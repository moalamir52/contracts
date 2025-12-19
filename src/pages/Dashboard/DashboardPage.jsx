import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardTable from './DashboardTable';
import Toast from '../../components/Toast';
import ContractModal from '../../components/ContractModal'; // We will check this path
import { useDashboardLogic, FILTER_MODES, getIssueForRow } from './dashboard.logic';
import './dashboard.styles.css';

export default function DashboardPage() {
    const navigate = useNavigate();
    const {
        loading, error,
        filterMode, setFilterMode,
        debouncedSearchTerm, setDebouncedSearchTerm,
        filteredData, duplicatedContractsInfo,
        maintenanceData, isCarExpired, getExpiryDate,
        stats, searchResults,
        refreshData, isSyncing, lastSync
    } = useDashboardLogic();

    // Local UI state
    const [searchTerm, setSearchTerm] = useState("");
    const [toastMessage, setToastMessage] = useState("");
    const [showToast, setShowToast] = useState(false);
    const [activeMenuTable, setActiveMenuTable] = useState(null); // 'main', 'open', 'closed'
    const [visibleColumns, setVisibleColumns] = useState(() => {
        try {
            const saved = localStorage.getItem('contracts_visible_columns');
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    });

    const [columnWidths, setColumnWidths] = useState({
        customer: 140, contractNo: 160, invygoPlate: 150,
        ejarPlate: 150, phoneNumber: 150, invygoModel: 200,
        ejarModel: 200, bookingNumber: 150, contractType: 140,
        pickupBranch: 160, contact: 150, model1: 180, dropoffDate: 150,
    });

    const [selectedContract, setSelectedContract] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        if (visibleColumns) {
            localStorage.setItem('contracts_visible_columns', JSON.stringify(visibleColumns));
        }
    }, [visibleColumns]);

    // Debounce search
    // Debounce search - DISABLED (User prefers Enter key)
    /*
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm, setDebouncedSearchTerm]);
    */

    const handleColumnResize = useCallback((headerKey, newWidth) => {
        setColumnWidths(prev => ({ ...prev, [headerKey]: newWidth }));
    }, []);

    const showToastNotification = useCallback((msg) => {
        setToastMessage(msg);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    }, []);

    const handleCopy = useCallback((text, msg) => {
        navigator.clipboard.writeText(text).then(() => {
            showToastNotification(msg || "Copied!");
        }).catch(err => {
            console.error('Copy failed', err);
            showToastNotification("Copy failed");
        });
    }, [showToastNotification]);

    // Header helpers
    const headersConfig = {
        open: ['contractNo', 'bookingNumber', 'customer', 'invygoModel', 'invygoPlate', 'ejarModel', 'ejarPlate', 'phoneNumber', 'pickupDate', 'dropoffDate', 'issue'],
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

    const currentHeaders = useMemo(() => {
        if (filterMode === FILTER_MODES.SWITCHBACK && debouncedSearchTerm.trim() === '') return headersConfig.switchback;
        if (debouncedSearchTerm.trim() === '' && (filterMode === FILTER_MODES.ALL || filterMode === FILTER_MODES.MISMATCH)) return headersConfig.open;

        // Determine headers based on data presence if searching
        if (filteredData.length === 0) return headersConfig.open;
        const populated = new Set(['contractNo']);
        filteredData.forEach(row => {
            Object.keys(row).forEach(k => {
                if (row[k]) populated.add(k);
            });
        });
        if (debouncedSearchTerm) populated.add('contractType');
        return headersConfig.master.filter(k => populated.has(k));
    }, [filterMode, debouncedSearchTerm, filteredData]);


    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 100;

    // Reset page when filter or search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [filterMode, debouncedSearchTerm]);

    // Stable Handlers to prevent re-renders during typing
    const handleToggleMenuOpen = useCallback(() => { setActiveMenuTable(prev => prev === 'open' ? null : 'open'); }, []);
    const handleToggleMenuClosed = useCallback(() => { setActiveMenuTable(prev => prev === 'closed' ? null : 'closed'); }, []);
    const handleToggleMenuMain = useCallback(() => { setActiveMenuTable(prev => prev === 'main' ? null : 'main'); }, []);

    const handleShowMenuNull = useCallback((val) => { if (!val) setActiveMenuTable(null); }, []);

    const handleCustomerClick = useCallback((c) => {
        setSelectedContract(c);
        setShowModal(true);
    }, []);

    // Pagination Helpers
    const paginateData = (data) => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return data.slice(startIndex, startIndex + rowsPerPage);
    };

    const PaginationControls = ({ totalRows }) => {
        const totalPages = Math.ceil(totalRows / rowsPerPage);
        if (totalPages <= 1) return null;

        return (
            <div className="pagination-controls" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 20, gap: 15 }}>
                <button
                    className="control-button"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                >
                    Previous
                </button>
                <span style={{ fontWeight: 'bold' }}>
                    Page {currentPage} of {totalPages}
                </span>
                <button
                    className="control-button"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                >
                    Next
                </button>
            </div>
        );
    };

    return (
        <div className="contracts-dashboard">
            {showToast && <Toast message={toastMessage} onClose={() => setShowToast(false)} />}
            {showModal && selectedContract && (
                <ContractModal
                    contract={selectedContract}
                    onClose={() => { setShowModal(false); setSelectedContract(null); }}
                />
            )}

            <button
                className="control-button"
                onClick={() => window.location.href = 'https://moalamir52.github.io/Yelo/'}
                style={{
                    position: 'absolute',
                    top: '20px',
                    left: '20px',
                    backgroundColor: '#ffd600',
                    color: '#6a1b9a',
                    fontWeight: 'bold',
                    zIndex: 1000
                }}
                title="Go back to Yelo Dashboard"
            >
                ⬅ Back to Yelo
            </button>

            <div className="dashboard-header">
                <h1>Car Rental Dashboard</h1>
                <p>Contracts & Analysis</p>
            </div>

            <div className="controls-container">
                <button className="control-button" onClick={() => navigate('/multi-car')}>
                    🚗 Multi-Car Analysis
                </button>
                <input
                    className="search-input"
                    placeholder="🔍 Search (Press Enter)..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            setDebouncedSearchTerm(searchTerm);
                        }
                    }}
                />
                <button
                    className="control-button"
                    onClick={refreshData}
                    disabled={isSyncing}
                    style={{ backgroundColor: '#1976d2', color: 'white', border: 'none', marginLeft: 10 }}
                    title={lastSync ? `Last updated: ${new Date(lastSync).toLocaleString()}` : 'Never updated'}
                >
                    {isSyncing ? '⌛ Syncing...' : '🔄 Refresh DB'}
                </button>
            </div>

            <div className="filter-buttons">
                <button
                    className={`control-button ${filterMode === FILTER_MODES.ALL ? 'active' : ''}`}
                    onClick={() => setFilterMode(FILTER_MODES.ALL)}
                >
                    All Contracts ({stats.open})
                </button>
                <button
                    className={`control-button ${filterMode === FILTER_MODES.MISMATCH ? 'active' : ''}`}
                    onClick={() => setFilterMode(FILTER_MODES.MISMATCH)}
                >
                    Mismatch Only ({stats.mismatch})
                </button>
                <button
                    className={`control-button ${filterMode === FILTER_MODES.SWITCHBACK ? 'active' : ''}`}
                    onClick={() => setFilterMode(FILTER_MODES.SWITCHBACK)}
                >
                    Start Switch Back ({stats.switchback})
                </button>
                <button
                    className={`control-button ${filterMode === FILTER_MODES.EXPIRED ? 'active' : ''}`}
                    onClick={() => setFilterMode(FILTER_MODES.EXPIRED)}
                >
                    Expired Cars ({stats.expired})
                </button>
            </div>

            {loading && <div className="loading-message">Loading data...</div>}
            {error && <div className="error-message">{error.message || String(error)}</div>}

            {!loading && !error && (
                <>
                    {debouncedSearchTerm ? (
                        <>
                            <div className="search-section-header" style={{
                                margin: '20px auto 10px',
                                color: '#1b5e20',
                                border: '2px solid #2e7d32',
                                borderRadius: '8px',
                                padding: '5px 20px',
                                width: 'fit-content',
                                backgroundColor: '#e8f5e9',
                                textAlign: 'center'
                            }}>
                                <h3 style={{ margin: 0 }}>📋 Open Contracts ({searchResults.openContractsFromSearch.length})</h3>
                            </div>
                            <DashboardTable
                                data={searchResults.openContractsFromSearch} // No pagination for split results? Maybe just limit them. 
                                // Actually, let's paginate the search results too if they are huge. 
                                // For now, passing full data for split search might be okay if < 500. 
                                // But safer to slice. Let's slice only the *Active* tab? 
                                // The new design splits them. Let's paginate them separately? 
                                // Complexity. Let's just output them directly for Search as they are usually small.
                                // Or better, apply pagination ONLY to the main view, and limiting search results to 100?
                                // User said "search takes time". 
                                // Let's paginate the *Main* detailed View. For split view, render all (usually few).
                                headers={headersConfig.open}
                                visibleColumns={visibleColumns}
                                columnWidths={columnWidths}
                                onColumnResize={handleColumnResize}
                                onToggleColumnMenu={handleToggleMenuOpen}
                                showColumnMenu={activeMenuTable === 'open'}
                                setShowColumnMenu={handleShowMenuNull}
                                setVisibleColumns={setVisibleColumns}
                                headerDisplayNames={headerDisplayNames}
                                duplicatedContractsInfo={duplicatedContractsInfo}
                                maintenanceData={maintenanceData}
                                isCarExpired={isCarExpired}
                                getExpiryDate={getExpiryDate}
                                getIssueForRow={getIssueForRow}
                                onCustomerClick={handleCustomerClick}
                                onCopy={handleCopy}
                            />

                            <div className="search-section-header" style={{
                                margin: '30px auto 10px',
                                color: '#b71c1c',
                                border: '2px solid #c62828',
                                borderRadius: '8px',
                                padding: '5px 20px',
                                width: 'fit-content',
                                backgroundColor: '#ffebee',
                                textAlign: 'center'
                            }}>
                                <h3 style={{ margin: 0 }}>🔒 Closed Contracts ({searchResults.closedContractsFromSearch.length})</h3>
                            </div>
                            <DashboardTable
                                key="table-closed"
                                data={searchResults.closedContractsFromSearch}
                                headers={headersConfig.master}
                                visibleColumns={visibleColumns}
                                columnWidths={columnWidths}
                                onColumnResize={handleColumnResize}
                                onToggleColumnMenu={handleToggleMenuClosed}
                                showColumnMenu={activeMenuTable === 'closed'}
                                setShowColumnMenu={handleShowMenuNull}
                                setVisibleColumns={setVisibleColumns}
                                headerDisplayNames={headerDisplayNames}
                                duplicatedContractsInfo={duplicatedContractsInfo}
                                maintenanceData={maintenanceData}
                                isCarExpired={isCarExpired}
                                getExpiryDate={getExpiryDate}
                                getIssueForRow={getIssueForRow}
                                onCustomerClick={handleCustomerClick}
                                onCopy={handleCopy}
                            />
                        </>
                    ) : (
                        <>
                            <div style={{ marginBottom: 10, fontWeight: 'bold', color: '#6a1b9a', textAlign: 'center' }}>
                                Showing {filteredData.length} records (Page {currentPage})
                            </div>
                            <DashboardTable
                                key="table-main"
                                data={paginateData(filteredData)}
                                headers={currentHeaders}
                                visibleColumns={visibleColumns}
                                columnWidths={columnWidths}
                                onColumnResize={handleColumnResize}
                                onToggleColumnMenu={handleToggleMenuMain}
                                showColumnMenu={activeMenuTable === 'main'}
                                setShowColumnMenu={handleShowMenuNull}
                                setVisibleColumns={setVisibleColumns}
                                headerDisplayNames={headerDisplayNames}
                                duplicatedContractsInfo={duplicatedContractsInfo}
                                maintenanceData={maintenanceData}
                                isCarExpired={isCarExpired}
                                getExpiryDate={getExpiryDate}
                                getIssueForRow={getIssueForRow}
                                onCustomerClick={handleCustomerClick}
                                onCopy={handleCopy}
                            />
                            <PaginationControls totalRows={filteredData.length} />
                        </>
                    )}
                </>
            )}
        </div>
    );
}
