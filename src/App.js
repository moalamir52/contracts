import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

// نافذة مبسطة لعرض بيانات العقد
function ContractModal({ contract, onClose }) {
  if (!contract) return null;
  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 12, padding: 32, minWidth: 320, maxWidth: 500, boxShadow: '0 4px 24px #0002', position: 'relative' }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 16, background: '#ff0800', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontWeight: 'bold', cursor: 'pointer' }}>X</button>
        <h2 style={{ color: '#6a1b9a', marginBottom: 16 }}>Contract Details</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {Object.entries(contract).map(([key, val]) => (
              <tr key={key}>
                <td style={{ fontWeight: 'bold', padding: 4, borderBottom: '1px solid #eee', color: '#6a1b9a' }}>{key}</td>
                <td style={{ padding: 4, borderBottom: '1px solid #eee' }}>{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ContractsTable() {
  const [data, setData] = useState([]);
  const [maintenanceData, setMaintenanceData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const parseDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    let day, month, year;
    if (dateStr.includes("-")) {
      [day, month, year] = dateStr.split("-");
    } else if (dateStr.includes("/")) {
      [day, month, year] = dateStr.split("/");
    } else {
      return new Date(0);
    }
    return new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
  };
  const getDaysSinceRepair = (row) => {
    const invygo = normalize(row["INVYGO"]);
    const records = maintenanceData.filter(m => normalize(m["Vehicle"]) === invygo);
    if (!records.length) return "";
    // اختار أحدث سجل بناءً على Date IN
    const latestRecord = records.reduce((a, b) => {
      const dateA = parseDate(a["Date IN"]);
      const dateB = parseDate(b["Date IN"]);
      return dateA > dateB ? a : b;
    });
    if (!latestRecord || !latestRecord["Date IN"]) return "";
    const dateStr = latestRecord["Date IN"];
    let day, month, year;
    if (dateStr.includes("-")) {
      [day, month, year] = dateStr.split("-");
    } else if (dateStr.includes("/")) {
      [day, month, year] = dateStr.split("/");
    } else {
      return "";
    }
    const formatted = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const date = new Date(formatted);
    if (isNaN(date)) return "";
    const now = new Date();
    const diffMs = now - date;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return `${days} days since repaired`;
  };

  const getDaysSince = (dateStr) => {
    if (!dateStr) return "";

    let day, month, year;

    if (dateStr.includes("-")) {
      [day, month, year] = dateStr.split("-");
    } else if (dateStr.includes("/")) {
      [day, month, year] = dateStr.split("/");
    } else {
      return "";
    }

    if (!day || !month || !year) return "";

    const formatted = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const date = new Date(formatted);

    if (isNaN(date)) return "";
    const now = new Date();
    const diffMs = now - date;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return `${days} days ago`;
  };




  useEffect(() => {
    const fetchSheet = async (url) => {
      const response = await fetch(url);
      const text = await response.text();
      const rows = text.split("\n").map((r) => r.split(","));
      const headers = rows.find((row) => row.some((c) => c.trim() !== ""));
      const values = rows.slice(rows.indexOf(headers) + 1);
      return values
        .filter((r) => r.length === headers.length && r.some((c) => c.trim() !== ""))
        .map((r) => Object.fromEntries(r.map((c, i) => [headers[i]?.trim(), c?.trim().replace(/\n/g, " ")])))
    };

    const loadSheets = async () => {
      try {
        const [contracts, maintenance] = await Promise.all([
          fetchSheet("https://docs.google.com/spreadsheets/d/1XwBko5v8zOdTdv-By8HK_DvZnYT2T12mBw_SIbCfMkE/export?format=csv&gid=769459790"),
          fetchSheet("https://docs.google.com/spreadsheets/d/1v4rQWn6dYPVQPd-PkhvrDNgKVnexilrR2XIUVa5RKEM/export?format=csv&gid=0")
        ]);
        setData(contracts);
        setMaintenanceData(maintenance);
        setLoading(false);
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Failed to load data.");
        setLoading(false);
      }
    };

    loadSheets();
  }, []);

  const normalize = (str) => str?.toLowerCase().replace(/\s+/g, "").trim();

  const isInMaintenance = (row) => {
    const booking = row["Booking Number"] || "";
    const isNumeric = !isNaN(Number(booking));
    const ejar = normalize(row["EJAR"]);
    const invygo = normalize(row["INVYGO"]);
    if (!isNumeric || ejar === invygo) return false;
    const match = maintenanceData.find(m => normalize(m["Vehicle"]) === invygo);
    return !!match;
  };

  const isCompleted = (row) => {
    const booking = row["Booking Number"] || "";
    const isNumeric = !isNaN(Number(booking));
    const ejar = normalize(row["EJAR"]);
    const invygo = normalize(row["INVYGO"]);
    if (!isNumeric || ejar === invygo) return false;
    const record = maintenanceData.find(m => normalize(m["Vehicle"]) === invygo);
    return record && !!record["Date IN"];
  };

  const isMismatch = (row) => {
    const booking = row["Booking Number"] || "";
    const isNumeric = !isNaN(Number(booking));
    const ejar = normalize(row["EJAR"]);
    const invygo = normalize(row["INVYGO"]);
    return isNumeric && ejar && invygo && ejar !== invygo;
  };

  // حساب تكرار أرقام اللوحات في عمود INVYGO
  const invygoCounts = data.reduce((acc, row) => {
    const plate = normalize(row["INVYGO"]);
    if (plate) acc[plate] = (acc[plate] || 0) + 1;
    return acc;
  }, {});

  const filtered = data.filter((row) => {
    const searchMatch = Object.values(row).some((val) => normalize(val).includes(normalize(searchTerm)));
    if (!searchMatch) return false;

    if (filterMode === "mismatch") return isMismatch(row);
    if (filterMode === "switchback") return isMismatch(row) && isCompleted(row);

    return true;
  });

  const headersToShow = [
    "Contract No.",
    "Booking Number",
    "Customer",
    "Model ( Ejar )",
    "EJAR",
    "Model",
    "INVYGO",
    "Phone Number",
    "Pick-up Date",
    "Replacement Date"
  ];

  const headerDisplayNames = {
    "Model ( Ejar )": "Replace Model",
    "EJAR": "Rep Plate no.",
    "Model": "Invygo Model",
    "INVYGO": "Plate no.",
    // يمكنك إضافة بقية الأعمدة إذا أردت تغييرها
  };

  const columnWidths = {
    "Customer": 180,
    "Model ( Ejar )": 140,
    "Model": 140,
    "Phone Number": 70,
    "INVYGO": 330,
    "Contract No.": 170,
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contracts");
    XLSX.writeFile(wb, `Contracts_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const printTable = () => {
    const printContents = document.getElementById("contracts-table")?.innerHTML;
    const printWindow = window.open("", "", "height=800,width=1200");
    if (printWindow) {
      printWindow.document.write("<html><head><title>Contracts Print</title></head><body>");
      printWindow.document.write(printContents);
      printWindow.document.write("</body></html>");
      printWindow.document.close();
      printWindow.print();
    }
  };

  const buttonStyle = {
    padding: "10px 16px",
    backgroundColor: "#fff",
    color: "#6a1b9a",
    border: "2px solid #6a1b9a",
    borderRadius: 12,
    fontWeight: "bold",
    cursor: "pointer",
    boxShadow: "0px 2px 6px rgba(0,0,0,0.1)",
    transition: "0.3s",
  };

  const cellStyle = {
    border: "1px solid #ccc",
    padding: "4px 6px",
    textAlign: "center",
    whiteSpace: "nowrap",
    maxWidth: 120,
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

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

      <div style={{
        backgroundColor: "#ffd600",
        padding: "25px 35px",
        borderRadius: "20px",
        boxShadow: "0 6px 24px rgba(0, 0, 0, 0.15)",
        maxWidth: "720px",
        margin: "0 auto 30px auto",
        textAlign: "center",
        border: "2px solid #6a1b9a"
      }}>
        <h1 style={{ color: "#6a1b9a", fontSize: "36px", marginBottom: 10, fontWeight: "bold" }}>Business Bay Contracts</h1>
        <p style={{ color: "#6a1b9a", fontSize: "16px", fontWeight: "bold" }}>Search and view all active contracts in one place</p>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="🔍 Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ padding: 10, minWidth: 280, borderRadius: 10, border: "1px solid #6a1b9a" }}
        />
        <button onClick={() => setSearchTerm("")} style={buttonStyle}>❌ Reset</button>
        <button onClick={exportToExcel} style={buttonStyle}>📤 Export</button>
        <button onClick={printTable} style={buttonStyle}>🖨 Print</button>
        <button onClick={() => setFilterMode("all")} style={buttonStyle}>📋 All ({data.length})</button>
        <button onClick={() => setFilterMode("mismatch")} style={buttonStyle}>
  ♻️ Replacements ({data.filter(isMismatch).length})
</button>
        <button onClick={() => setFilterMode("switchback")} style={buttonStyle}>🔁 Switch Back ({data.filter(row => isMismatch(row) && isCompleted(row)).length})</button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : (
        <div id="contracts-table">
          <table style={{ borderCollapse: "collapse", width: "auto", maxWidth: 900, margin: "0 auto", tableLayout: "auto" }}>
            <thead style={{ backgroundColor: "#ffd600" }}>
              <tr>
                <th style={{ ...cellStyle }}>#</th>
                {headersToShow.map((header, idx) => (
                  <th key={idx} style={{ ...cellStyle, minWidth: columnWidths[header] }}>
                    {headerDisplayNames[header] || header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => {
                const mismatch = isMismatch(row);
                const completed = mismatch && isCompleted(row);
                // تحديد إذا كان رقم اللوحة في INVYGO مكرر
                const isInvygoDuplicated = invygoCounts[normalize(row["INVYGO"])] > 1;
                const backgroundColor = isInvygoDuplicated
                  ? "#ff0800" // أحمر داكن
                  : completed
                  ? "#ccffcc"
                  : mismatch
                  ? "#ffcccc"
                  : idx % 2 === 0
                  ? "#fffde7"
                  : "#ffffff";

                // دالة لنسخ النص المنسق المطلوب
                const copyIndexText = () => {
                  const bookingNo = row["Booking Number"] || "";
                  const customer = row["Customer"] || "";
                  const firstName = customer.split(" ")[0] || customer;
                  const phone = row["Phone Number"] || "";
                  const oldCarModel = row["Model ( Ejar )"] || "";
                  const oldCarPlate = row["EJAR"] || "";
                  let text = "";
                  if (filterMode === "switchback") {
                    const newCarModel = row["Model"] || "";
                    const newCarPlate = row["INVYGO"] || "";
                    text = `${bookingNo} - Switch Back\n\n${firstName} - ${phone}\n\nOld car / ${oldCarModel} - ${oldCarPlate}\n\nNew car / ${newCarModel} - ${newCarPlate}`;
                  } else {
                    text = `${bookingNo} - Switch\n\n${firstName} - ${phone}\n\nOld car / ${oldCarModel} - ${oldCarPlate}\n\nNew car /`;
                  }
                  navigator.clipboard.writeText(text);
                };

                return (
                  <tr key={idx} style={{ backgroundColor, color: isInvygoDuplicated ? "#fff" : undefined }}>
                    <td style={cellStyle}>
                      <span
                        onClick={copyIndexText}
                        style={{ cursor: 'pointer', color: '#6a1b9a', fontWeight: 'bold', textDecoration: 'underline' }}
                        title="Click to copy WhatsApp message"
                      >
                        {idx + 1}
                      </span>
                    </td>
                    {headersToShow.map((header, i) => {
  const value = row[header];
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const clickableHeaders = ["Contract No.", "Booking Number", "Model ( Ejar )", "EJAR", "Model", "INVYGO"];

  const linkColor = isInvygoDuplicated ? "#fff" : undefined;

  return (
    <td key={i} style={{
      ...cellStyle,
      backgroundColor: header === "INVYGO" && isInvygoDuplicated ? backgroundColor : undefined,
      color: isInvygoDuplicated ? "#fff" : undefined,
      minWidth: columnWidths[header]
    }} title={typeof value === 'string' && value.length > 0 ? value : undefined}>
      {header === "Phone Number" && value ? (
        <a
          href={`https://wa.me/${value.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: isInvygoDuplicated ? '#fff' : '#25D366', textDecoration: 'none', fontWeight: 'bold' }}
        >
          {value}
        </a>
      ) : header === "Contract No." && value ? (
        <a
          href="https://ejar.iyelo.com:6300/app/rental/contracts"
          onClick={(e) => {
            e.preventDefault();
            copyToClipboard(value);
            window.open("https://ejar.iyelo.com:6300/app/rental/contracts", "_blank");
          }}
          style={{ color: isInvygoDuplicated ? '#fff' : '#1976d2', textDecoration: 'none', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {value}
        </a>
      ) : header === "Booking Number" && value ? (
        <a
          href="https://dashboard.invygo.com/bookings"
          onClick={(e) => {
            e.preventDefault();
            copyToClipboard(value);
            window.open("https://dashboard.invygo.com/bookings", "_blank");
          }}
          style={{ color: isInvygoDuplicated ? '#fff' : '#0077b5', textDecoration: 'none', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {value}
        </a>
      ) : header === "Replacement Date" && value ? (
        <span style={{ fontWeight: 'bold', color: '#6a1b9a' }}>
          {value} ({getDaysSince(value)})
        </span>
        ) : filterMode === "switchback" && header === "INVYGO" && value ? (
        <span style={{ fontWeight: 'bold', color: isInvygoDuplicated ? '#fff' : '#388e3c', display: 'inline-block' }}>
          {value} — {getDaysSinceRepair(row)}
          {isInvygoDuplicated && (() => {
            const other = data.find(
              (r) => normalize(r["INVYGO"]) === normalize(value) && r !== row
            );
            if (other) {
              return (
                <div style={{ fontSize: 12, color: '#fff', fontWeight: 'bold', marginTop: 2 }}>
                  ⚠️ Rented to: {(() => {
                    const names = (other["Customer"] || "").split(" ").filter(Boolean);
                    return names.slice(0, 2).join(" ");
                  })()} (No: 
                    <button
                      onClick={() => {
                        setSelectedContract(data.find(c => c["Contract No."] === other["Contract No."]));
                        setShowModal(true);
                      }}
                      style={{
                        color: '#ffd600', background: 'none', border: 'none', textDecoration: 'underline', fontWeight: 'bold', cursor: 'pointer', padding: 0, fontSize: 'inherit'
                      }}
                      title="Show contract details"
                    >
                      {other["Contract No."]}
                    </button>
                  )
                </div>
              );
            }
            return null;
          })()}
        </span>

      ) : header === "INVYGO" && value ? (
        <span
          onClick={() => copyToClipboard(value)}
          style={{
            color: isInvygoDuplicated ? '#fff' : '#6a1b9a',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontWeight: 'bold',
            display: 'inline-block'
          }}
          title="Click to copy"
        >
          {value}
          {/* ملاحظة إذا كان الرقم مكرر */}
          {isInvygoDuplicated && (() => {
            // ابحث عن صف آخر بنفس رقم اللوحة غير الحالي
            const other = data.find(
              (r) => normalize(r["INVYGO"]) === normalize(value) && r !== row
            );
            if (other) {
              return (
                <div style={{ fontSize: 12, color: '#fff', fontWeight: 'bold', marginTop: 2 }}>
                  ⚠️ Rented to: {(() => {
                    const names = (other["Customer"] || "").split(" ").filter(Boolean);
                    return names.slice(0, 2).join(" ");
                  })()} (No: 
                    <button
                      onClick={() => {
                        setSelectedContract(data.find(c => c["Contract No."] === other["Contract No."]));
                        setShowModal(true);
                      }}
                      style={{
                        color: '#ffd600', background: 'none', border: 'none', textDecoration: 'underline', fontWeight: 'bold', cursor: 'pointer', padding: 0, fontSize: 'inherit'
                      }}
                      title="Show contract details"
                    >
                      {other["Contract No."]}
                    </button>
                  )
                </div>
              );
            }
            return null;
          })()}
        </span>
      ) : header === "Model" && value ? (
        <span style={{ fontWeight: 'bold', color: isInvygoDuplicated ? '#fff' : undefined }}>{value}</span>
      ) : clickableHeaders.includes(header) && value ? (
        <span
          onClick={() => copyToClipboard(value)}
          style={{ color: isInvygoDuplicated ? '#fff' : '#6a1b9a', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}
          title="Click to copy"
        >
          {value}
        </span>
      ) : (
        <span style={{ color: isInvygoDuplicated ? '#fff' : undefined }}>{value}</span>
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
      )}
      {showModal && (
        <ContractModal contract={selectedContract} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
