import React from 'react';
import ColumnResizer from './ColumnResizer';
import { normalize } from '../utils';

const DataTable = ({
    data,
    headers,
    onPhoneClick,
    onCustomerClick,
    columnWidths,
    handleColumnResize,
    invygoCounts,
    isMismatch,
    getLatestDateIn,
    allContracts,
    setSelectedContract,
    setShowModal,
    copyToClipboard,
    filterMode,
    getDaysSinceLatestIn
}) => {

    const cellStyle = {
        border: "1px solid #ccc", padding: "4px 6px", textAlign: "center",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    };

    const headerDisplayNames = {
        contractNo: 'Contract No.', revenueDate: 'Revenue Date', bookingNumber: 'Booking Number', customer: 'Customer',
        invygoModel: 'Model', invygoPlate: 'Plate No.', ejarModel: 'Replace Model',
        ejarPlate: 'Rep Plate no.', phoneNumber: 'Phone Number', pickupBranch: 'Pick-up Branch',
        pickupDate: 'Pick-up Date', replacementDate: 'Replacement Date', dropoffDate: 'Drop-off Date',
        model1: 'Model (Repeated)', contact: 'Contact', contractType: 'Contract Type',
    };

    const formatDateForDisplay = (dateStr) => {
        if (!dateStr || dateStr.trim() === '') return '';
        // Takes the part before the first space, to remove the time part
        return dateStr.split(' ')[0];
    };

    return (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: "collapse", tableLayout: 'fixed', margin: "0 auto" }}>
            <thead style={{ backgroundColor: "#ffd600" }}>
              <tr>
                <th style={{...cellStyle, width: 50, position: 'relative'}}>#<ColumnResizer onResize={(newWidth) => handleColumnResize('#', newWidth)} /></th>
                {headers.map((headerKey) => (
                  <th key={headerKey} style={{...cellStyle, width: columnWidths[headerKey] || 150, position: 'relative' }}>
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
                const isCarRepaired = mismatch && getLatestDateIn(row);
                
                const backgroundColor = isDuplicated ? "#ff0800"
                  : isCarRepaired ? "#ccffcc"
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
                    copyToClipboard(text, "WhatsApp message copied!");
                };
    
                return (
                  <tr key={`${row.contractNo || 'row'}-${idx}`} style={{ backgroundColor, color: textColor }}>
                    <td style={{...cellStyle, width: 50}}>
                      <span onClick={copyIndexText} style={{ cursor: row.type === 'open' ? 'pointer' : 'default', color: '#6a1b9a', fontWeight: 'bold', textDecoration: row.type === 'open' ? 'underline' : 'none' }} title="Click to copy WhatsApp message">
                          {idx + 1}
                      </span>
                    </td>
                    {headers.map((headerKey) => {
                      const isDateColumn = ['pickupDate', 'dropoffDate', 'replacementDate', 'revenueDate'].includes(headerKey);
                      let value = row[headerKey] || '';
                      if (isDateColumn) {
                          value = formatDateForDisplay(value);
                      }
    
                      let content = value;
                      const contractTypeDisplay = { open: 'Open', closed_invygo: 'Closed (Invygo)', closed_other: 'Closed (Other)' };
                      
                      if ((filterMode === 'mismatch' || filterMode === 'switchback') && headerKey === 'invygoModel') {
                          const days = getDaysSinceLatestIn(row);
                          if (days !== '') {
                              content = (<span>{value}<span style={{display: 'block', color: '#008000', fontWeight: 'bold', fontSize: '0.9em'}}>(Repaired: {days} days ago)</span></span>);
                          }
                      } else if (headerKey === 'customer') {
                          content = (
                              <span 
                                  onClick={() => onCustomerClick(row)} 
                                  style={{ 
                                      color: isDuplicated ? '#fff' : '#6a1b9a',
                                      textDecoration: 'underline', 
                                      fontWeight: 'bold', 
                                      cursor: 'pointer' 
                                  }}
                              >
                                  {value}
                              </span>
                          );
                      } else if (headerKey === 'contractType') {
                        content = <span style={{fontWeight: 'bold'}}>{contractTypeDisplay[row.type]}</span>
                      } else if (row.type === 'open' && headerKey === 'phoneNumber') {
                          content = (
                              <span onClick={(e) => onPhoneClick(e, row)} style={{ color: isDuplicated ? '#fff' : '#25D366', textDecoration: 'underline', fontWeight: 'bold', cursor: 'pointer' }}>
                                  {value}
                              </span>
                          );
                      } else if (row.type === 'open' && headerKey === 'contractNo') {
                        content = <a href="https://ejar.iyelo.com:6300/app/rental/contracts" onClick={(e) => { e.preventDefault(); copyToClipboard(value, `Contract ${value} copied!`); window.open(e.currentTarget.href, "_blank"); }} style={{ color: isDuplicated ? '#fff' : '#1976d2', textDecoration: 'none', fontWeight: 'bold', cursor: 'pointer' }}>{value}</a>;
                      } else if (row.type === 'open' && headerKey === 'bookingNumber') {
                        content = <a href="https://dashboard.invygo.com/bookings" onClick={(e) => { e.preventDefault(); copyToClipboard(value, `Booking ${value} copied!`); window.open(e.currentTarget.href, "_blank"); }} style={{ color: isDuplicated ? '#fff' : '#0077b5', textDecoration: 'none', fontWeight: 'bold', cursor: 'pointer' }}>{value}</a>;
                      }
    
                      return (
                        <td key={headerKey} style={{...cellStyle, width: columnWidths[headerKey] || 150 }} title={value}>
                            {content}
                            {isDuplicated && headerKey === 'invygoPlate' && (
                              <div style={{ fontSize: 12, fontWeight: 'bold', marginTop: 2 }}>
                                ⚠️ Rented to: {
                                  (() => {
                                    const other = allContracts.find(r => r.type === 'open' && normalize(r.invygoPlate) === normalize(row.invygoPlate) && r !== row);
                                    if (!other) return 'N/A';
                                    return (<button onClick={() => { setSelectedContract(other); setShowModal(true); }} style={{ color: '#ffd600', background: 'none', border: 'none', textDecoration: 'underline', fontWeight: 'bold', cursor: 'pointer', padding: 0, fontSize: 'inherit' }} title="Show contract details">{`${other.customer} (${other.contractNo})`}</button>);
                                  })
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
      );
}

export default DataTable;
