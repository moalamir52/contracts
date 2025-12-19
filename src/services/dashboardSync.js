import { dashboardDB } from './dashboard_db';
import { GOOGLE_SHEETS_URLS, COLUMN_MAPPINGS } from '../config'; // Import config and mappings
import Papa from 'papaparse';

// Helper to fetch using full URL
const fetchCSV = async (url) => {
    // Check if URL is valid (might be undefined from env)
    if (!url) {
        throw new Error('Missing Google Sheet URL configuration.');
    }

    // Check if URL is not a CSV export link? Usually config has full export link.
    // The previous .env showed full export?format=csv urls.
    // Let's assume URL is complete.
    // But CORS proxy? config says PROXY_URL exists. 
    // Let's assume direct fetch works since previous version did, OR use proxy if needed.
    // dataFetcher.js likely used direct fetch.

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    return new Promise((resolve) => {
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data),
        });
    });
};

const mapData = (data, mapping) => {
    if (!mapping) return data;
    return data.map(row => {
        const newRow = {};
        Object.keys(row).forEach(key => {
            // Trim key to handle potential whitespace in CSV headers
            const cleanKey = key.trim();
            // If mapping exists, use it. Otherwise keep original key.
            // We check both raw key and trimmed key against mapping just in case.
            // PRIORITIZE EXACT MATCH (key) because config relies on trailing spaces to distinguish columns.
            const mappedKey = mapping[key] || mapping[cleanKey];
            if (mappedKey) {
                newRow[mappedKey] = row[key];
            }
            // We ALSO keep the original key-value pair because some generic logic might use it,
            // and to be safe against missing mappings. 
            // However, mixing camelCase and "Title Case" is fine.
            newRow[cleanKey] = row[key];
        });
        return newRow;
    });
};

export const syncDashboardData = async () => {
    try {
        console.log('Starting Dashboard Sync...');

        // Use the URLs from config object which maps to env vars
        const [openContractsRaw, closedInvygoRaw, closedOtherRaw, maintenance, cars] = await Promise.all([
            fetchCSV(GOOGLE_SHEETS_URLS.openContracts),
            fetchCSV(GOOGLE_SHEETS_URLS.closedInvygo),
            fetchCSV(GOOGLE_SHEETS_URLS.closedOther),
            fetchCSV(GOOGLE_SHEETS_URLS.maintenance),
            fetchCSV(GOOGLE_SHEETS_URLS.cars)
        ]);

        console.log('Data fetched, applying mappings...');

        const openContracts = mapData(openContractsRaw, COLUMN_MAPPINGS.open);
        const closedInvygo = mapData(closedInvygoRaw, COLUMN_MAPPINGS.closed_invygo);
        const closedOther = mapData(closedOtherRaw, COLUMN_MAPPINGS.closed_other);
        // Maintenance and Cars usually don't have mappings in config, so keep raw

        console.log('Saving into dashboard_db...');

        const allData = {
            openContracts,
            closedInvygo,
            closedOther,
            maintenance, // Raw
            cars        // Raw
        };

        // Clear and Save
        await dashboardDB.clearAll();
        await dashboardDB.saveAllData(allData);

        console.log('Dashboard Sync complete.');
        return { success: true, timestamp: new Date().toISOString() };
    } catch (error) {
        console.error('Dashboard Sync failed:', error);
        return { success: false, error };
    }
};
