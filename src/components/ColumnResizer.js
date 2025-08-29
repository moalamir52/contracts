import React from 'react';

// Resizer component for table columns
function ColumnResizer({ onResize }) {
  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.pageX;
    const thElement = e.target.parentElement;
    const startWidth = thElement.offsetWidth;

    const handleMouseMove = (moveEvent) => {
      const newWidth = startWidth + (moveEvent.pageX - startX);
      if (newWidth > 60) {
        onResize(newWidth);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        height: '100%',
        width: '8px',
        cursor: 'col-resize',
        zIndex: 10,
      }}
    />
  );
}

export default ColumnResizer;
