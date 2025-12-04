// استخدام proxy أسرع أو بدون proxy إذا أمكن
const PROXY_URL = 'https://corsproxy.io/?';

// إضافة cache بسيط
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 دقائق

const fetchSheet = async (url, viewMode) => {
    // فحص الـ cache أولاً
    const cacheKey = url + viewMode;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
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
        
        // حفظ في الـ cache
        cache.set(cacheKey, {
            data: processedData,
            timestamp: Date.now()
        });
        
        return processedData;
    } else {
        const result = dataRows
            .filter(r => r.length === headers.length && r.some(c => c))
            .map(r => Object.fromEntries(r.map((c, i) => [headers[i], c])));
        
        // حفظ في الـ cache
        cache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
        });
        
        return result;
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
        const carsUrl = encode('https://docs.google.com/spreadsheets/d/1sHvEQMtt3suuxuMA0zhcXk5TYGqZzit0JvGLk1CQ0LI/export?format=csv&gid=804568597');

        // تحميل البيانات الأساسية أولاً (العقود المفتوحة)

        const openRaw = await fetchSheet(openContractsUrl, 'open');
        const normalizedOpen = normalizeData(openRaw, 'open', columnMappings);
        
        // إرسال العقود المفتوحة فوراً
        self.postMessage({ 
            partialData: { 
                allContracts: normalizedOpen,
                maintenanceData: [],
                carsData: []
            },

        });
        
        // تحميل باقي البيانات
        const [closedInvygoRaw, closedOtherRaw, maintenanceRaw, carsRaw] = await Promise.all([
            fetchSheet(closedInvygoUrl, 'closed_invygo'),
            fetchSheet(closedOtherUrl, 'closed_other'),
            fetchSheet(maintenanceUrl, 'open'),
            fetchSheet(carsUrl, 'cars')
        ]);

        const normalizedClosedInvygo = normalizeData(closedInvygoRaw, 'closed_invygo', columnMappings);
        const normalizedClosedOther = normalizeData(closedOtherRaw, 'closed_other', columnMappings);
        
        const allContracts = [...normalizedOpen, ...normalizedClosedInvygo, ...normalizedClosedOther];
        
        // إرسال البيانات النهائية
        self.postMessage({ allContracts, maintenanceData: maintenanceRaw, carsData: carsRaw });
    } catch (err) {
        self.postMessage({ error: err.message });
    }
};
