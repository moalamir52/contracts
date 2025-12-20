import React, { memo } from 'react';
import clsx from 'clsx';
import '../../styles/dashboard-table.css';
import RowActions from './RowActions';
import ColumnMenu from '../../components/ColumnMenu.js';
import { formatDateForDisplay } from '../../utils/dates';
import { isMismatch, getLatestDateIn, isCarExpired, getDaysSinceLatestIn } from '../../utils/analysis';
import { normalize as normalizeStr } from '../../utils/normalize';

const DashboardTable = ({
    data, headers, visibleColumns, columnWidths,
    onColumnResize, onToggleColumnMenu, showColumnMenu,
    setShowColumnMenu, setVisibleColumns, headerDisplayNames,
    duplicatedContractsInfo, maintenanceData,
    isCarExpired, getExpiryDate, getIssueForRow,
    onCustomerClick, onCopy
}) => {
    // Dynamic table based on visibleColumns and headers
    const finalHeaders = (visibleColumns ? headers.filter(h => visibleColumns.includes(h)) : headers);

    const getColumnClass = (key) => {
        if (key === 'contractNo') return 'col-contract';
        if (key === 'bookingNumber') return 'col-booking';
        if (key === 'customer') return 'col-customer';
        if (key === 'invygoModel' || key === 'ejarModel' || key === 'model1') return 'col-model';
        if (key === 'invygoPlate' || key === 'ejarPlate' || key === 'plateNo1' || key === 'plateNo2') return 'col-plate';
        if (['pickupDate', 'dropoffDate', 'replacementDate', 'revenueDate'].includes(key)) return 'col-date';
        if (key === 'phoneNumber') return 'col-phone';
        if (key === 'pickupBranch') return 'col-branch';
        if (key === 'contact') return 'col-contact';
        if (key === 'contractType') return 'col-type';
        if (key === 'issue') return 'col-issue';
        return '';
    };

    return (
        <div className="dashboard-table-wrapper">
            <table className="dashboard-table">
                <thead>
                    <tr>
                        <th className="col-index">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                #
                                <button
                                    style={{ marginLeft: 6, cursor: 'pointer', background: 'none', border: 'none', fontSize: 16 }}
                                    title="Columns"
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onToggleColumnMenu(); }}
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
                            </div>
                        </th>
                        {finalHeaders.map(headerKey => (
                            <th key={headerKey} className={getColumnClass(headerKey)}>
                                {headerDisplayNames[headerKey] || headerKey}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, i) => {
                        const plate = normalizeStr(row.invygoPlate);
                        const isDuplicated = duplicatedContractsInfo[plate]?.length > 1;
                        const mismatch = row.type === 'open' && isMismatch(row);
                        const isCarRepaired = mismatch && getLatestDateIn(row, maintenanceData);

                        const plates = [row.ejarPlate, row.invygoPlate, row.plateNo1, row.plateNo2].filter(Boolean);
                        const hasExpiredCar = row.type === 'open' && plates.some(p => isCarExpired(p));
                        const expiryDate = hasExpiredCar ? getExpiryDate(plate) : null;

                        const rowClass = clsx({
                            "row-duplicated": isDuplicated,
                            "row-mismatch": mismatch && !hasExpiredCar,
                            "row-repaired": isCarRepaired,
                            "row-expired": hasExpiredCar,
                            "row-even": i % 2 === 0,
                            "row-odd": i % 2 !== 0
                        });

                        const copyIndexText = () => {
                            if (row.type !== 'open') return;
                            const firstName = (row.customer || "").split(" ")[0];
                            const phone = row.phoneNumber || "";
                            const needsSwitchBack = isMismatch(row) && getLatestDateIn(row, maintenanceData);

                            let text;
                            if (needsSwitchBack) {
                                text = `${row.bookingNumber} - Switch Back\n\n${firstName} - ${phone}\n\nOld car / ${row.ejarModel} - ${row.ejarPlate}\n\nNew car / ${row.invygoModel} - ${row.invygoPlate}`;
                            } else {
                                text = `${row.bookingNumber} - Switch\n\n${firstName} - ${phone}\n\nOld car / ${row.ejarModel} - ${row.ejarPlate}\n\nNew car /`;
                            }
                            onCopy(text, "WhatsApp message copied!");
                        };

                        return (
                            <tr key={i} className={rowClass}>
                                <td className="col-index">
                                    <button
                                        type="button"
                                        onClick={copyIndexText}
                                        className="table-action-btn"
                                        style={{ border: 'none', background: 'none', fontWeight: 'bold', fontSize: 'inherit', color: 'inherit' }}
                                    >
                                        {(row.originalIndex !== undefined ? row.originalIndex : i) + 1}
                                    </button>
                                </td>
                                {finalHeaders.map(headerKey => {
                                    let content = row[headerKey];
                                    const val = row[headerKey];
                                    const colClass = getColumnClass(headerKey);

                                    // Render content
                                    if (['pickupDate', 'dropoffDate', 'replacementDate', 'revenueDate'].includes(headerKey)) {
                                        content = formatDateForDisplay(val);
                                    } else if (headerKey === 'contractNo') {
                                        content = (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                                                <a href="https://ejar.iyelo.com:6300/app/rental/contracts" onClick={(e) => { e.preventDefault(); onCopy(val, `Contract ${val} copied!`); window.open(e.currentTarget.href, "_blank"); }} className="table-link" style={{ color: 'inherit' }}>
                                                    {val}
                                                </a>
                                                {isDuplicated && <span title="Duplicated Contract">⚠️</span>}
                                            </div>
                                        );
                                    } else if (headerKey === 'bookingNumber') {
                                        content = <a href="https://dashboard.invygo.com/bookings" onClick={(e) => { e.preventDefault(); onCopy(val, `Booking ${val} copied!`); window.open(e.currentTarget.href, "_blank"); }} className="table-link" style={{ color: 'inherit' }}>{val}</a>;
                                    } else if (headerKey === 'customer') {
                                        content = <button type="button" onClick={() => onCustomerClick(row)} className="table-link" style={{ background: 'none', border: 'none', fontSize: 'inherit', cursor: 'pointer', padding: 0, textDecoration: 'underline', color: 'inherit' }}>{val}</button>;
                                    } else if (headerKey === 'phoneNumber' && row.type === 'open') {
                                        content = <RowActions row={row} maintenanceData={maintenanceData} onCopy={onCopy} />;
                                    } else if (headerKey === 'ejarPlate' || headerKey === 'invygoPlate') {
                                        const actualVal = val || (headerKey === 'invygoPlate' ? row.ejarPlate : '');
                                        const isExp = isCarExpired(actualVal);
                                        const expD = getExpiryDate(actualVal);
                                        const normPlate = normalizeStr(actualVal);
                                        const duplicates = duplicatedContractsInfo[normPlate];
                                        const otherContract = duplicates?.find(c => c.contractNo !== row.contractNo);

                                        content = (
                                            <span>
                                                {actualVal} {isExp && '⚠️'}
                                                {isExp && <div style={{ fontSize: '0.8em' }}>Exp: {formatDateForDisplay(expD)}</div>}
                                                {otherContract && (
                                                    <div
                                                        style={{ fontSize: '0.8em', color: '#fff', backgroundColor: '#d32f2f', padding: '2px 4px', borderRadius: 4, marginTop: 4, fontWeight: 'bold', cursor: 'pointer' }}
                                                        onClick={(e) => { e.stopPropagation(); onCopy(otherContract.contractNo, `Contract ${otherContract.contractNo} copied!`); }}
                                                        title="Click to copy contract number"
                                                    >
                                                        ⚠️ Rented to: {otherContract.customer}
                                                    </div>
                                                )}
                                            </span>
                                        );
                                    } else if (headerKey === 'invygoModel') {
                                        const actualModel = val || row.ejarModel;
                                        const days = isCarRepaired ? getDaysSinceLatestIn(row, maintenanceData) : '';
                                        content = (
                                            <span>
                                                {actualModel}
                                                {isCarRepaired && <div className="repaired-info">Repaired: {days} days ago</div>}
                                            </span>
                                        );
                                    } else if (headerKey === 'issue') {
                                        content = getIssueForRow(row, maintenanceData);
                                    } else if (headerKey === 'contractType') {
                                        const contractTypeDisplay = { open: 'Open', closed_invygo: 'Closed (Invygo)', closed_other: 'Closed (Other)' };
                                        content = contractTypeDisplay[row.type] || row.type;
                                    }

                                    return (
                                        <td key={headerKey} className={colClass} title={typeof content === 'string' ? content : undefined}>
                                            {content}
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
};

export default memo(DashboardTable);
