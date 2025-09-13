const PROXY_URL = 'https://cors-anywhere.herokuapp.com/';

const fetchSheet = async (url, viewMode) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet: ${response.statusText}`);
    }
    const text = await response.text();
    // Regex to split by comma only if not inside quotes
    const csvRegex = /,(?=(?:(?:[^"\"]*\"){2})*[^"\"]*$)/;
    const rows = text.split("\n").map((r) => r.split(csvRegex).map(c => c.trim().replace(/^"|"$/g, '')));
    const headerIndex = rows.findIndex(row => row.some(cell => cell));
    if (headerIndex === -1) return [];
    const headers = rows[headerIndex].map(h => h.trim());
    const dataRows = rows.slice(headerIndex + 1);
    
    if (viewMode === 'closed_invygo' || viewMode === 'closed_other') {
        let currentDropoffDate = null;
        const processedData = [];
        for (const row of dataRows) {
            const firstCell = row[0] || "";
            const isDateRow = /^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$/.test(firstCell) && row.slice(1).every(cell => !cell || cell.trim() === '');
            if (isDateRow) {
                currentDropoffDate = firstCell;
            } else if (row.some(cell => cell && cell.trim() !== '') && currentDropoffDate) {
                const rowData = {};
                const headerCount = {};
                headers.forEach((header, i) => {
                    headerCount[header] = (headerCount[header] || 0) + 1;
                    const key = headerCount[header] > 1 ? `${header} ` : header;
                    rowData[key] = row[i];
                });
                rowData['Drop-off Date'] = currentDropoffDate;
                processedData.push(rowData);
            }
        }
        return processedData;
    } else {
        return dataRows
            .filter(r => r.length === headers.length && r.some(c => c))
            .map(r => Object.fromEntries(r.map((c, i) => [headers[i], c])));
    }
};

const normalizeData = (rawData, viewMode, columnMappings) => {
    const mapping = columnMappings[viewMode];
    return rawData.map(rawRow => {
        const normalizedRow = { type: viewMode };
        for (const header in mapping) {
            const internalKey = mapping[header];
            normalizedRow[internalKey] = rawRow[header];
        }
        if (viewMode === 'closed_invygo') {
            normalizedRow.invygoPlate = normalizedRow.plateNo1;
            normalizedRow.invygoModel = normalizedRow.model2;
            normalizedRow.ejarPlate = normalizedRow.plateNo2;
        }
        return normalizedRow;
    });
};

self.onmessage = async (event) => {
    const { googleSheetsUrls, columnMappings } = event.data;
    try {
        const encode = (url) => PROXY_URL + encodeURIComponent(url);

        const openContractsUrl = encode(googleSheetsUrls.openContracts);
        const closedInvygoUrl = encode(googleSheetsUrls.closedInvygo);
        const closedOtherUrl = encode(googleSheetsUrls.closedOther);
        const maintenanceUrl = encode(googleSheetsUrls.maintenance);
        const carsUrl = 'https://docs.google.com/spreadsheets/d/1sHvEQMtt3suuxuMA0zhcXk5TYGqZzit0JvGLk1CQ0LI/export?format=csv&gid=804568597';

        const [openRaw, closedInvygoRaw, closedOtherRaw, maintenanceRaw, carsRaw] = await Promise.all([
            fetchSheet(openContractsUrl, 'open'),
            fetchSheet(closedInvygoUrl, 'closed_invygo'),
            fetchSheet(closedOtherUrl, 'closed_other'),
            fetchSheet(maintenanceUrl, 'open'),
            fetchSheet(carsUrl, 'cars')
        ]);

        const normalizedOpen = normalizeData(openRaw, 'open', columnMappings);
        const normalizedClosedInvygo = normalizeData(closedInvygoRaw, 'closed_invygo', columnMappings);
        const normalizedClosedOther = normalizeData(closedOtherRaw, 'closed_other', columnMappings);
        
        const allContracts = [...normalizedOpen, ...normalizedClosedInvygo, ...normalizedClosedOther];
        
        self.postMessage({ allContracts, maintenanceData: maintenanceRaw, carsData: carsRaw });
    } catch (err) {
        self.postMessage({ error: err.message });
    }
};
