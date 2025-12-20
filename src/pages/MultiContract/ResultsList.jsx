import React from 'react';

const ResultsList = ({ results, bookingIdMap, onSelectContract }) => {
    const [copiedContract, setCopiedContract] = React.useState(null);

    const copyContractNumber = async (contractNo) => {
        try {
            await navigator.clipboard.writeText(contractNo);
            setCopiedContract(contractNo);
            setTimeout(() => setCopiedContract(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    if (results.length === 0) {
        return (
            <div className="results-table-container">
                <table className="results-table">
                    <thead>
                        <tr className="results-header">
                            <th className="header-cell">#</th>
                            <th className="header-cell">Contract No.</th>
                            <th className="header-cell">Booking ID</th>
                            <th className="header-cell">Customer</th>
                            <th className="header-cell">Cars (Plate & Dates)</th>
                            <th className="header-cell">Cars Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#888', fontSize: 18 }}>No data</td></tr>
                    </tbody>
                </table>
            </div>
        )
    }

    return (
        <div className="results-table-container">
            <table className="results-table">
                <thead>
                    <tr className="results-header">
                        <th className="header-cell">#</th>
                        <th className="header-cell">Contract No.</th>
                        <th className="header-cell">Booking ID</th>
                        <th className="header-cell" style={{ width: 250 }}>Customer</th>
                        <th className="header-cell">Cars (Plate & Dates)</th>
                        <th className="header-cell">Cars Count</th>
                    </tr>
                </thead>
                <tbody>
                    {results.map((row, idx) => (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? '#fffde7' : '#fff', transition: 'background 0.2s' }}>
                            <td className="data-cell">{idx + 1}</td>
                            <td className="data-cell" style={{ minWidth: 80, fontWeight: 'bold' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <button
                                        className="contract-btn"
                                        onClick={() => onSelectContract(row)}
                                        title="Show contract details"
                                        type="button"
                                    >
                                        {row.contractNo || row.contract}
                                    </button>
                                    <button
                                        className={`copy-btn ${copiedContract === (row.contractNo || row.contract) ? 'bg-green' : 'bg-yellow'}`}
                                        onClick={() => copyContractNumber(row.contractNo || row.contract)}
                                        title="Copy contract number"
                                        type="button"
                                    >
                                        {copiedContract === (row.contractNo || row.contract) ? '✓' : '📋'}
                                    </button>
                                </div>
                            </td>
                            <td className="data-cell">
                                {bookingIdMap.get(row.contractNo || row.contract) || 'Branch'}
                            </td>
                            <td className="data-cell" style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {row.customerName || row['Customer Name']}
                            </td>
                            <td className="data-cell" style={{ padding: 0, background: '#fff' }}>
                                <table className="cars-table">
                                    <colgroup>
                                        <col style={{ width: '25%' }} />
                                        <col style={{ width: '25%' }} />
                                        <col style={{ width: '25%' }} />
                                        <col style={{ width: '25%' }} />
                                    </colgroup>
                                    <thead>
                                        <tr style={{ background: 'linear-gradient(90deg,#e0f7fa 60%,#b2ebf2 100%)' }}>
                                            <th style={{ border: '1px solid #26c6da', padding: '10px 8px', fontSize: 15, color: '#006064', background: '#e0f7fa', fontWeight: 700 }}>Model</th>
                                            <th style={{ border: '1px solid #26c6da', padding: '10px 8px', fontSize: 15, color: '#006064', background: '#e0f7fa', fontWeight: 700 }}>Plate</th>
                                            <th style={{ border: '1px solid #26c6da', padding: '10px 8px', fontSize: 15, color: '#006064', background: '#e0f7fa', fontWeight: 700 }}>From</th>
                                            <th style={{ border: '1px solid #26c6da', padding: '10px 8px', fontSize: 15, color: '#006064', background: '#e0f7fa', fontWeight: 700 }}>To</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {row.carDetails && row.carDetails.map((car, i) => (
                                            <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#b2ebf2' }}>
                                                <td style={{ border: '1px solid #26c6da', padding: '6px', color: '#00838f', fontWeight: 600, fontSize: 14 }}>{car.carModel}</td>
                                                <td style={{ border: '1px solid #26c6da', padding: '6px', color: '#00838f', fontWeight: 700, fontSize: 14 }}>{car.plateNumber}</td>
                                                <td style={{ border: '1px solid #26c6da', padding: '6px', color: '#00838f', fontWeight: 600, fontSize: 14 }}>{car.from}</td>
                                                <td style={{ border: '1px solid #26c6da', padding: '6px', color: '#00838f', fontWeight: 600, fontSize: 14 }}>{car.to}</td>
                                            </tr>
                                        ))}
                                        {!row.carDetails && row.cars && row.cars.map((c, i) => (
                                            // Fallback for old data structure if needed, or remove if we guarantee new struct
                                            <tr key={i}><td>{c}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </td>
                            <td className="data-cell" style={{ fontWeight: 'bold', color: '#6a1b9a' }}>
                                {row.carsCount} Cars
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ResultsList;
