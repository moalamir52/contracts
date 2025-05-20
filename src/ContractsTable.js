import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

export default function ContractsTable() {
  const [data, setData] = useState([]);
  const [maintenanceData, setMaintenanceData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSheet = async (url) => {
      const response = await fetch(url);
      const text = await response.text();
      const rows = text.split("\n").map((r) => r.split(","));
      const headers = rows.find((row) => row.some((c) => c.trim() !== ""));
      const values = rows.slice(rows.indexOf(headers) + 1);
      return values
        .filter((r) => r.length === headers.length && r.some((c) => c.trim() !== ""))
        .map((r) => Object.fromEntries(r.map((c, i) => [headers[i]?.trim(), c?.trim()])));
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

  const filtered = data.filter((row) =>
    Object.values(row).some((val) => normalize(val).includes(normalize(searchTerm)))
  );

  const headersToShow = [
    "Contract No.",
    "Booking Number",
    "Customer",
    "EJAR",
    "Model ( Ejar )",
    "INVYGO",
    "Model",
    "Phone Number",
    "Pick-up Date",
  ];

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

  return (
    <div style={{ padding: 30, fontFamily: "Segoe UI", background: "#fff9e5", minHeight: "100vh" }}>
      <a
        href="https://moalamir52.github.io/Yelo/"
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

      {loading ? (
        <p style={{ textAlign: "center" }}>Loading...</p>
      ) : error ? (
        <p style={{ color: "red", textAlign: "center" }}>{error}</p>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="🔍 Search in all fields..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: 10,
                minWidth: 320,
                borderRadius: 8,
                border: "1px solid #ccc",
                fontSize: 16
              }}
            />
            <button
              onClick={() => setSearchTerm("")}
              style={{
                padding: "10px 16px",
                backgroundColor: "#6a1b9a",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              ❌ Reset
            </button>
            <button
              onClick={exportToExcel}
              style={{
                padding: "10px 16px",
                backgroundColor: "#388e3c",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              📤 Export to Excel
            </button>
            <button
              onClick={printTable}
              style={{
                padding: "10px 16px",
                backgroundColor: "#1976d2",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              🖨 Print
            </button>
          </div>

          <div id="contracts-table" style={{ overflowX: "auto", maxHeight: "75vh", background: "white", borderRadius: 10 }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "#ffd600" }}>
                <tr>
                  <th style={{ border: "1px solid #ccc", padding: 10, minWidth: 50, color: "#6a1b9a", textAlign: "center" }}>#</th>
                  {headersToShow.map((header, idx) => (
                    <th
                      key={idx}
                      style={{
                        border: "1px solid #ccc",
                        padding: 10,
                        minWidth: 150,
                        background: "#ffd600",
                        color: "#6a1b9a",
                        textAlign: "center"
                      }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => {
                  let backgroundColor = "#ffffff";
                  const booking = row["Booking Number"] || "";
                  const isNumericBooking = !isNaN(Number(booking));
                  const ejar = normalize(row["EJAR"]);
                  const invygo = normalize(row["INVYGO"]);

                  const inMaintenance = isNumericBooking && ejar !== invygo && isInMaintenance(row);
                  const completed = isNumericBooking && ejar !== invygo && isCompleted(row);

                  if (inMaintenance && !completed) backgroundColor = "#ffcccc";
                  else if (inMaintenance && completed) backgroundColor = "#ccffcc";
                  else backgroundColor = idx % 2 === 0 ? "#fffde7" : "#ffffff";

                  return (
                    <tr key={idx} style={{ backgroundColor }}>
                      <td style={{ border: "1px solid #ddd", padding: 8, textAlign: "center" }}>{idx + 1}</td>
                      {headersToShow.map((header, i) => (
                        <td key={i} style={{ border: "1px solid #ddd", padding: 8, textAlign: "center" }}>
                          {header === "Phone Number" && row[header] ? (
                            <a
                              href={`https://wa.me/${row[header].replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "#25D366", textDecoration: "none", fontWeight: "bold" }}
                            >
                              {row[header]}
                            </a>
                          ) : (
                            row[header] || ""
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
