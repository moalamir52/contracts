import React from 'react';

const ColumnMenu = ({ headers, visibleColumns, setVisibleColumns, setShowColumnMenu, headerDisplayNames }) => {
  const toggleColumn = (e, header) => {
    e.stopPropagation();
    let newVisible = [...(visibleColumns || headers)];
    if (newVisible.includes(header)) {
      newVisible = newVisible.filter(h => h !== header);
    } else {
      newVisible.push(header);
      // Sort according to headers order
      newVisible.sort((a, b) => headers.indexOf(a) - headers.indexOf(b));
    }
    setVisibleColumns(newVisible);
  };

  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, zIndex: 200,
      background: 'white', border: '1px solid #ccc', borderRadius: 4,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: 10,
      maxHeight: 300, overflowY: 'auto', minWidth: 200
    }} onClick={(e) => e.stopPropagation()}>
      <div style={{ fontWeight: 'bold', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Show Columns</span>
        <button onClick={() => setShowColumnMenu(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
      </div>
      {headers.map(h => (
        <div key={h} style={{ padding: '4px 0' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!visibleColumns || visibleColumns.includes(h)}
              onChange={(e) => toggleColumn(e, h)}
              style={{ marginRight: 8 }}
            />
            {headerDisplayNames[h] || h}
          </label>
        </div>
      ))}
    </div>
  );
};

export default ColumnMenu;
