import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

export default function ContractsTable() {
  const [data, setData] = useState([]);
  const [maintenanceData, setMaintenanceData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState("all");
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
    "EJAR",
    "Model ( Ejar )",
    "INVYGO",
    "Model",
    "Phone Number",
    "Pick-up Date",
  ];

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contracts");
    XLSX.writeFile(wb, `Contracts_${new Date().toISOString().slice(0,10)}.xlsx`);
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
          style={{ padding: 10, minWidth: 280 }}
        />
        <button onClick={() => setSearchTerm("")}>❌ Reset</button>
        <button onClick={exportToExcel}>📤 Export</button>
        <button onClick={() => setFilterMode("all")}>📋 All ({data.length})</button>
        <button onClick={() => setFilterMode("mismatch")}>⚠️ Mismatch ({data.filter(isMismatch).length})</button>
        <button onClick={() => setFilterMode("switchback")}>🔁 Switch Back ({data.filter(row => isMismatch(row) && isCompleted(row)).length})</button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead style={{ backgroundColor: "#ffd600" }}>
            <tr>
              <th style={{ border: "1px solid #ccc", padding: 10 }}>#</th>
              {headersToShow.map((header, idx) => (
                <th key={idx} style={{ border: "1px solid #ccc", padding: 10 }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, idx) => {
              const mismatch = isMismatch(row);
              const completed = mismatch && isCompleted(row);
              const backgroundColor = completed
                ? "#ccffcc"
                : mismatch
                ? "#ffcccc"
                : idx % 2 === 0
                ? "#fffde7"
                : "#ffffff";

              return (
                <tr key={idx} style={{ backgroundColor }}>
                  <td style={{ border: "1px solid #ccc", padding: 8 }}>{idx + 1}</td>
                  {headersToShow.map((header, i) => (
                    <td key={i} style={{ border: "1px solid #ccc", padding: 8 }}>{row[header]}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
