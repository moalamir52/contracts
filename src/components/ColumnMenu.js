import React, { useEffect, useRef, useState } from 'react';

export default function ColumnMenu({ headers, visibleColumns, setVisibleColumns, setShowColumnMenu, headerDisplayNames }) {
  const menuRef = useRef(null);
  const [allSelected, setAllSelected] = useState(() => {
    if (!headers) return true;
    if (!visibleColumns) return true;
    return headers.every(col => visibleColumns.includes(col));
  });

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowColumnMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setShowColumnMenu]);

  useEffect(() => {
    if (!headers) return;
    if (!visibleColumns) setAllSelected(true);
    else setAllSelected(headers.every(col => visibleColumns.includes(col)));
  }, [headers, visibleColumns]);

  const handleSelectAll = () => {
    if (allSelected) {
      setVisibleColumns([]);
    } else {
      setVisibleColumns([...headers]);
    }
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: '60px',
        top: '120px',
        zIndex: 9999,
        background: 'rgba(255,255,255,0.98)',
        border: '1px solid #888',
        borderRadius: 8,
        padding: 14,
        minWidth: 200,
        boxShadow: '0 4px 24px #0005',
        color: '#222',
        fontSize: 15
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>اختيار الأعمدة الظاهرة</div>
      <button
        style={{marginBottom: 10, width: '100%', background: allSelected ? '#eee' : '#dbeafe', border: '1px solid #bbb', borderRadius: 4, padding: 6, cursor: 'pointer'}}
        onClick={handleSelectAll}
      >
        {allSelected ? 'إلغاء تحديد الكل' : 'تحديد كل الأعمدة'}
      </button>
      {(headers || []).map(col => (
        <label key={col} style={{ display: 'block', marginBottom: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={visibleColumns ? visibleColumns.includes(col) : true}
            onChange={e => {
              if (e.target.checked) {
                setVisibleColumns(prev => prev ? [...prev, col] : [col]);
              } else {
                setVisibleColumns(prev => (prev || headers).filter(c => c !== col));
              }
            }}
            style={{marginInlineEnd: 6}}
          /> {headerDisplayNames[col] || col}
        </label>
      ))}
      <button style={{marginTop:10, width:'100%'}} onClick={() => setShowColumnMenu(false)}>إغلاق</button>
    </div>
  );
}
