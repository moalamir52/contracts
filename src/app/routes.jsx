import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Lazy load pages
const DashboardPage = lazy(() => import("../pages/Dashboard/DashboardPage"));
const MultiContractPage = lazy(() => import("../pages/MultiContract/MultiContractPage"));

export default function AppRoutes() {
    return (
        <BrowserRouter>
            <Suspense fallback={<div style={{ padding: 20, textAlign: 'center', fontWeight: 'bold', color: '#6a1b9a' }}>Loading Application...</div>}>
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/multi-car" element={<MultiContractPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
        </BrowserRouter>
    );
}
