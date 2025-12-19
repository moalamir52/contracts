import { openDB } from 'idb';

const DB_NAME = 'dashboard_db';
const DB_VERSION = 4;

export const STORES = {
    OPEN_CONTRACTS: 'open_contracts',
    CLOSED_INVYGO: 'closed_invygo',
    CLOSED_OTHER: 'closed_other',
    MAINTENANCE: 'maintenance',
    CARS: 'cars',
    METADATA: 'metadata'
};

const dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
        // Create object stores
        if (!db.objectStoreNames.contains(STORES.OPEN_CONTRACTS)) {
            db.createObjectStore(STORES.OPEN_CONTRACTS, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.CLOSED_INVYGO)) {
            db.createObjectStore(STORES.CLOSED_INVYGO, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.CLOSED_OTHER)) {
            db.createObjectStore(STORES.CLOSED_OTHER, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.MAINTENANCE)) {
            db.createObjectStore(STORES.MAINTENANCE, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.CARS)) {
            db.createObjectStore(STORES.CARS, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.METADATA)) {
            db.createObjectStore(STORES.METADATA);
        }
    },
});

export const dashboardDB = {
    async clearAll() {
        const db = await dbPromise;
        const tx = db.transaction(Object.values(STORES), 'readwrite');
        await Promise.all([
            tx.objectStore(STORES.OPEN_CONTRACTS).clear(),
            tx.objectStore(STORES.CLOSED_INVYGO).clear(),
            tx.objectStore(STORES.CLOSED_OTHER).clear(),
            tx.objectStore(STORES.MAINTENANCE).clear(),
            tx.objectStore(STORES.CARS).clear(),
            tx.objectStore(STORES.METADATA).clear(),
        ]);
        await tx.done;
    },

    async saveAllData(data) {
        const db = await dbPromise;
        const tx = db.transaction(Object.values(STORES), 'readwrite');

        // Helper to bulk add
        const saveToStore = async (storeName, items) => {
            const store = tx.objectStore(storeName);
            for (const item of items) {
                await store.put(item);
            }
        };

        await Promise.all([
            saveToStore(STORES.OPEN_CONTRACTS, data.openContracts || []),
            saveToStore(STORES.CLOSED_INVYGO, data.closedInvygo || []),
            saveToStore(STORES.CLOSED_OTHER, data.closedOther || []),
            saveToStore(STORES.MAINTENANCE, data.maintenance || []),
            saveToStore(STORES.CARS, data.cars || []),
            tx.objectStore(STORES.METADATA).put(new Date().toISOString(), 'last_sync')
        ]);

        await tx.done;
    },

    async getAllData() {
        const db = await dbPromise;
        return {
            openContracts: await db.getAll(STORES.OPEN_CONTRACTS),
            closedInvygo: await db.getAll(STORES.CLOSED_INVYGO),
            closedOther: await db.getAll(STORES.CLOSED_OTHER),
            maintenance: await db.getAll(STORES.MAINTENANCE),
            cars: await db.getAll(STORES.CARS),
            lastSync: await db.get(STORES.METADATA, 'last_sync')
        };
    }
};
