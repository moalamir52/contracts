self.onmessage = (event) => {
    const { allContracts, searchTerm } = event.data;

    if (!searchTerm || searchTerm.trim() === '') {
        self.postMessage({
            filteredData: [],
            openContractsFromSearch: [],
            closedContractsFromSearch: []
        });
        return;
    }

    const s = searchTerm.trim().toLowerCase();
    const searchResults = allContracts.filter(row =>
        Object.values(row).some(val => val && val.toString().toLowerCase().includes(s))
    );

    self.postMessage({
        filteredData: searchResults,
        openContractsFromSearch: searchResults.filter(c => c.type === 'open'),
        closedContractsFromSearch: searchResults.filter(c => c.type !== 'open')
    });
};
