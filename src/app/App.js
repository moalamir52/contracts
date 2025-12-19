import React, { useEffect } from 'react';
import AppRoutes from './routes';
import { assertReadOnlyConfig } from '../config';

function App() {
    // Validate config on mount
    useEffect(() => {
        assertReadOnlyConfig();
    }, []);

    return (
        <div className="App">
            <AppRoutes />
        </div>
    );
}

export default App;
