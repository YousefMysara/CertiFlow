import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CertificateEditor from './pages/CertificateEditor';
import EmailEditor from './pages/EmailEditor';
import BatchProgress from './pages/BatchProgress';
import Settings from './pages/Settings';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
    return (
        <ErrorBoundary>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="certificates" element={
                        <ErrorBoundary>
                            <CertificateEditor />
                        </ErrorBoundary>
                    } />
                    <Route path="email" element={
                        <ErrorBoundary>
                            <EmailEditor />
                        </ErrorBoundary>
                    } />
                    <Route path="jobs/:jobId" element={
                        <ErrorBoundary>
                            <BatchProgress />
                        </ErrorBoundary>
                    } />
                    <Route path="settings" element={
                        <ErrorBoundary>
                            <Settings />
                        </ErrorBoundary>
                    } />
                </Route>
            </Routes>
        </ErrorBoundary>
    );
}

export default App;
