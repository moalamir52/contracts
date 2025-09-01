import React, { useState } from 'react';
import { useContracts } from './hooks/useContracts';
import MultiContractPage from './components/MultiContractPage';
import ContractModal from './components/ContractModal';
import DropdownMenu from './components/DropdownMenu';
import Toast from './components/Toast';
import DataTable from './components/DataTable';

export default function ContractsTable() {
  // Main dashboard state and logic
  const {
    showMultiContract,
    setShowMultiContract,
    searchTerm,
    setSearchTerm,
    filterMode,
    setFilterMode,
    loading,
    error,
    selectedContract,
    showModal,
    setShowModal,
    xlsxReady,
    toastMessage,
    showToast,
    dropdown,
    columnWidths,
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
    allContracts,
    setSelectedContract
  } = useContracts();

  // State for Multi-Car Contracts Page
  const [multiCarResults, setMultiCarResults] = useState([]);
  const [allUniqueContracts, setAllUniqueContracts] = useState([]);
  const [multiCarFileStats, setMultiCarFileStats] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleMultiCarFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);

    // Create a new worker
    const worker = new Worker(new URL('./workers/contractProcessor.js', import.meta.url));

    // Listen for messages from the worker
    worker.onmessage = (e) => {
        if (e.data.error) {
            console.error("Worker error:", e.data.error);
            alert('An error occurred while processing the file.');
        } else {
            const { allContractsResultRows, multiCarResultRows, stats } = e.data;
            setMultiCarResults(multiCarResultRows);
            setAllUniqueContracts(allContractsResultRows);
            setMultiCarFileStats(stats);
        }
        setIsUploading(false);
        worker.terminate();
    };

    // Handle errors from the worker
    worker.onerror = (error) => {
        console.error("Worker error:", error);
        alert('An error occurred while processing the file.');
        setIsUploading(false);
        worker.terminate();
    };

    // Read the file and send its data to the worker
    const reader = new FileReader();
    reader.onload = (e) => {
        const arrayBuffer = e.target.result;
        worker.postMessage(arrayBuffer, [arrayBuffer]);
    };
    reader.readAsArrayBuffer(file);
  };

  const resetMultiCarData = () => {
    setMultiCarResults([]);
    setAllUniqueContracts([]);
    setMultiCarFileStats(null);
    // Reset the file input
    const fileInput = document.querySelector('input[type="file"][accept=".xlsx,.xls"]');
    if(fileInput) fileInput.value = "";
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

  if (showMultiContract) {
    return <MultiContractPage 
        onBack={() => setShowMultiContract(false)} 
        results={multiCarResults}
        allUniqueContracts={allUniqueContracts}
        fileStats={multiCarFileStats}
        handleFileUpload={handleMultiCarFileUpload}
        isUploading={isUploading}
        resetData={resetMultiCarData}
    />;
  }

  const renderTable = (data, title) => {
    if (!data || data.length === 0) return null;
    return (
        <div style={{ marginTop: '20px' }}>
            <h2 style={{ color: '#6a1b9a' }}>{title} ({data.length})</h2>
            <DataTable 
                data={data} 
                headers={getHeadersForData(data)} 
                onPhoneClick={handlePhoneClick}
                onCustomerClick={handleCustomerClick}
                columnWidths={columnWidths}
                handleColumnResize={handleColumnResize}
                invygoCounts={invygoCounts}
                isMismatch={isMismatch}
                getLatestDateIn={getLatestDateIn}
                getDaysSinceLatestIn={getDaysSinceLatestIn}
                allContracts={allContracts}
                setSelectedContract={setSelectedContract}
                setShowModal={setShowModal}
                copyToClipboard={copyToClipboard}
                filterMode={filterMode}
            />
        </div>
    );
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
            {searchTerm.trim() !== '' ? (
                <>
                    {renderTable(openContractsData, "Open Contracts")}
                    {renderTable(closedContractsData, "Closed Contracts")}
                </>
            ) : (
                renderTable(openContractsData, "Open Contracts")
            )}

            {(openContractsData.length === 0 && closedContractsData.length === 0) && !loading && (
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
