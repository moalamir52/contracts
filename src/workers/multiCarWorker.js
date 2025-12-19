/* eslint-disable no-restricted-globals */
import { analyzeMultiCarContracts } from '../utils/analysis';

// Global state for determining if we are accumulating
let accumulatedRows = [];

self.onmessage = (event) => {
    const { type, data } = event.data;

    try {
        if (type === 'CHUNK') {
            // Append rows
            // data is array of objects (if header:true used in PapaParse)
            if (Array.isArray(data)) {
                // Use concat loop or simple push loop to avoid stack overflow with spread
                for (let i = 0; i < data.length; i++) {
                    accumulatedRows.push(data[i]);
                }
            }
            // Report progress if needed (optional)
            self.postMessage({
                progress: `Processed ${accumulatedRows.length} rows...`
            });
        }
        else if (type === 'DONE') {
            self.postMessage({ progress: 'Analyzing contracts...' });

            // Perform analysis
            const results = analyzeMultiCarContracts(accumulatedRows);

            // Calculate summary
            const singleCarContracts = accumulatedRows.length; // Approximate/Proxy metric or calculate real one?
            // Wait, original logic calculated singleCarContracts count inside the analysis or adjacent?
            // Original code in MultiContractPage.js:
            /*
            const summary = {
                totalRows: jsonData.length,
                totalContracts: Object.keys(contractGroups).length,
                singleCarContracts: singleCarContractsCount,
                multiCarContracts: resultRows.length,
            };
            */
            // analyzeMultiCarContracts returns `results` (the multi-car ones).
            // It DOES NOT return the summary stats (totalRows, single etc).
            // I need to replicate that summary logic if I want to maintain parity.

            // Let's re-read analysis.js to see if it returns summary stats.
            // It returns ONLY `results` array.

            // I should verify if I need to enhance analysis.js or calculate stats here.
            // To maintain "pure function" in utils, I should calculate stats here or separate stats function.
            // I'll calculate stats here to match the output expectation of the page.

            const uniqueContracts = new Set(accumulatedRows.map(r => r['Contract No.'])).size;
            const multiCount = results.length;

            const summary = {
                totalRows: accumulatedRows.length,
                totalContracts: uniqueContracts,
                singleCarContracts: uniqueContracts - multiCount,
                multiCarContracts: multiCount,
            };

            self.postMessage({
                success: true,
                results,
                summary
            });

            // Cleanup
            accumulatedRows = [];
        }
        else if (type === 'RESET') {
            accumulatedRows = [];
        }
    } catch (error) {
        console.error("Worker Error details:", error);
        self.postMessage({ error: error.message });
        accumulatedRows = [];
    }
};
