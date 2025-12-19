import { useState, useMemo, useEffect, useCallback } from 'react';
import { dashboardDB } from '../../services/dashboard_db';
import { syncDashboardData } from '../../services/dashboardSync';
import { normalize as normalizeStr } from '../../utils/normalize';
import { getExpiryDate as getExpDateUtil, isCarExpired as isCarExpiredUtil, parseSheetDate } from '../../utils/dates';
import { isMismatch, getLatestDateIn } from '../../utils/analysis';

// Filter Modes
export const FILTER_MODES = {
    ALL: 'all',
    MISMATCH: 'mismatch',
    SWITCHBACK: 'switchback',
    EXPIRED: 'expired'
};

export const getIssueForRow = (row, maintenanceData) => {
    if (!row.invygoPlate || !maintenanceData) return '';
    const normalizedPlate = normalizeStr(row.invygoPlate);
    const matchingVehicles = maintenanceData.filter(
        (m) => normalizeStr(m.Vehicle) === normalizedPlate
    );
    if (matchingVehicles.length > 0) {
        const vehicleWithoutDateIn = matchingVehicles.find(
            (m) => !m['Date IN'] || m['Date IN'].trim() === ''
        );
        if (vehicleWithoutDateIn) {
            return vehicleWithoutDateIn['Damage Details'] || '';
        }
        return '';
    }
    return '';
};

export function useDashboardLogic() {
    // Data State (from DB)
    const [openContracts, setOpenContracts] = useState([]);
    const [closedContracts, setClosedContracts] = useState([]); // Combined Invygo + Other
    const [maintenanceData, setMaintenanceData] = useState([]);
    const [carsData, setCarsData] = useState([]);

    // UI State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastSync, setLastSync] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);

    // Filter/Search State
    const [filterMode, setFilterMode] = useState(FILTER_MODES.ALL);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    // --- 1. Load Data from Local DB on Mount ---
    const loadFromDB = useCallback(async () => {
        try {
            setLoading(true);
            const data = await dashboardDB.getAllData();

            setOpenContracts((data.openContracts || []).map(r => ({ ...r, type: 'open' })));
            // Combine closed
            const allClosed = [
                ...(data.closedInvygo || []).map(r => ({ ...r, type: 'closed_invygo' })),
                ...(data.closedOther || []).map(r => ({ ...r, type: 'closed_other' }))
            ];
            setClosedContracts(allClosed);
            setMaintenanceData(data.maintenance || []);
            setCarsData(data.cars || []);
            setLastSync(data.lastSync);
            setLoading(false);

            // If DB is empty, we attempt an initial sync if it's the very first run (no timestamp)
            if ((!data.openContracts || data.openContracts.length === 0) && !data.lastSync) {
                console.log('DB empty, triggering initial sync via simple refresh call...');
                // We can't call refreshData directly here easily due to deps cycle or closure, 
                // so we could set a flag or just rely on the user. 
                // Let's rely on user or a separate effect for simplicity to avoid complexity.
                // Actually, let's just trigger a sync once.
                syncDashboardData().then(res => {
                    if (res.success) {
                        // Reload myself
                        dashboardDB.getAllData().then(newData => {
                            setOpenContracts((newData.openContracts || []).map(r => ({ ...r, type: 'open' })));
                            setClosedContracts([
                                ...(newData.closedInvygo || []).map(r => ({ ...r, type: 'closed_invygo' })),
                                ...(newData.closedOther || []).map(r => ({ ...r, type: 'closed_other' }))
                            ]);
                            setMaintenanceData(newData.maintenance || []);
                            setCarsData(newData.cars || []);
                            setLastSync(newData.lastSync);
                        });
                    }
                });
            }

        } catch (err) {
            console.error('Failed to load dashboard data from DB', err);
            setError(err);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadFromDB();
    }, [loadFromDB]);

    // --- 2. Refresh/Sync Function ---
    const refreshData = async () => {
        try {
            setIsSyncing(true);
            const result = await syncDashboardData();
            if (result.success) {
                await loadFromDB(); // Reload from DB to state
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError(err);
        } finally {
            setIsSyncing(false);
        }
    };

    // --- Helpers Wrappers ---
    // We wrap these utils to use the local state `carsData`
    const isCarExpired = useCallback((plateNo) => {
        if (!plateNo || !carsData.length) return false;

        const normalizedPlate = normalizeStr(plateNo);
        // cars data is NOT mapped, it's raw from Google Sheet 'Cars' tab.
        // We need to check what keys 'cars' sheet has. Usually 'Plate No' or 'Plate Number'
        // config says 'REACT_APP_CARS_URL'. usually has 'Plate No'.
        // Previous logic used 'Plate No'.
        const car = carsData.find(car => normalizeStr(car['Plate No'] || car['Plate Number']) === normalizedPlate);
        if (!car || !car['Reg Exp']) return false;

        // Custom expiry logic matching previous file
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Assuming Reg Exp format dd/mm/yyyy
        const parts = car['Reg Exp'].split('/');
        if (parts.length !== 3) return false;
        const expDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`); // ISO format for safety

        if (isNaN(expDate.getTime())) return false;
        expDate.setHours(23, 59, 59, 999);
        return expDate < today;
    }, [carsData]);

    const getExpiryDate = useCallback((plateNo) => {
        if (!plateNo || !carsData.length) return null;
        const normalizedPlate = normalizeStr(plateNo);
        const car = carsData.find(car => normalizeStr(car['Plate No'] || car['Plate Number']) === normalizedPlate);
        return car ? car['Reg Exp'] : null;
    }, [carsData]);

    // --- 3. Derived Data & Logic ---
    const { mismatchRows, switchbackRows, expiredRows } = useMemo(() => {
        const mismatch = [];
        const switchback = [];
        const expired = [];

        openContracts.forEach(row => {
            if (isMismatch(row)) mismatch.push(row);

            // Switchback Logic: mismatch AND (has replacement) AND (Original Car is Repaired/Back)
            // Note: mapped keys are ejarPlate and ejarModel
            const hasReplacement = (row.ejarPlate && row.ejarPlate.trim() !== '') ||
                (row.ejarModel && row.ejarModel.trim() !== '');

            // Only count as "Switch Back" if the original car is actually back in maintenance
            if (hasReplacement && isMismatch(row)) {
                if (getLatestDateIn(row, maintenanceData)) {
                    switchback.push(row);
                }
            }

            // Expired Logic
            // Check all plates involved. Mapped keys: ejarPlate, invygoPlate
            // 'Plate No.' and 'Rep Plate no.' were old keys.
            const plates = [row.ejarPlate, row.invygoPlate].filter(Boolean);

            if (plates.some(p => isCarExpired(p))) {
                expired.push(row);
            }
        });

        return { mismatchRows: mismatch, switchbackRows: switchback, expiredRows: expired };
    }, [openContracts, isCarExpired, maintenanceData]);

    // Duplication Check
    const duplicatedContractsInfo = useMemo(() => {
        const plateMap = {};
        openContracts.forEach(c => {
            // Check which plate is relevant. Usually invygoPlate is the main one for open contracts
            const p = c.invygoPlate || c.ejarPlate;
            const plate = normalizeStr(p);

            if (plate) {
                if (!plateMap[plate]) plateMap[plate] = [];
                plateMap[plate].push({
                    contractNo: c.contractNo, // Mapped key
                    customer: c.customer,     // Mapped key
                    plate: p
                });
            }
        });

        const duplicates = {};
        Object.keys(plateMap).forEach(key => {
            if (plateMap[key].length > 1) {
                duplicates[key] = plateMap[key];
            }
        });
        return duplicates;
    }, [openContracts]);

    // --- 4. Search Implementation ---
    // --- 4. Search Implementation (Worker Based) ---
    // We use state for search results instead of memo to handle async worker response
    const [workerSearchResults, setWorkerSearchResults] = useState({ openContractsFromSearch: [], closedContractsFromSearch: [] });

    useEffect(() => {
        if (!debouncedSearchTerm.trim()) {
            setWorkerSearchResults({ openContractsFromSearch: [], closedContractsFromSearch: [] });
            return;
        }

        // Initialize worker
        const worker = new Worker(new URL('../../workers/searchWorker.js', import.meta.url));

        // combine all data for search
        const allContracts = [...openContracts, ...closedContracts];

        worker.postMessage({
            allContracts,
            searchTerm: debouncedSearchTerm
        });

        worker.onmessage = (e) => {
            const { openContractsFromSearch, closedContractsFromSearch } = e.data;
            setWorkerSearchResults({
                openContractsFromSearch,
                closedContractsFromSearch
            });
            worker.terminate();
        };

        worker.onerror = (err) => {
            console.error('Search Worker Error', err);
            worker.terminate();
        };

        return () => {
            worker.terminate();
        };
    }, [debouncedSearchTerm, openContracts, closedContracts]);

    // Use the worker results for the main object
    const searchResults = workerSearchResults;

    // --- 5. Filtering for Main View ---
    const { filteredData } = useMemo(() => {
        if (filterMode === FILTER_MODES.MISMATCH) return { filteredData: mismatchRows };
        if (filterMode === FILTER_MODES.SWITCHBACK) return { filteredData: switchbackRows };
        if (filterMode === FILTER_MODES.EXPIRED) return { filteredData: expiredRows };
        return { filteredData: openContracts };
    }, [filterMode, openContracts, mismatchRows, switchbackRows, expiredRows]);

    return {
        // State
        loading,
        error,
        filterMode,
        setFilterMode,
        debouncedSearchTerm,
        setDebouncedSearchTerm,
        // Data
        filteredData,
        duplicatedContractsInfo,
        maintenanceData,
        isCarExpired,
        getExpiryDate,
        stats: {
            mismatch: mismatchRows.length,
            switchback: switchbackRows.length,
            expired: expiredRows.length,
            open: openContracts.length
        },
        searchResults,
        // Sync
        refreshData,
        isSyncing,
        lastSync
    };
}
