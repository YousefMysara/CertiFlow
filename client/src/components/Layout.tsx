import { Link, Outlet, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    FileText,
    Mail,
    Settings,
    GraduationCap
} from 'lucide-react';

const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/certificates', icon: FileText, label: 'Certificates' },
    { path: '/email', icon: Mail, label: 'Email' },
    { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
    const location = useLocation();

    return (
        <div className="min-h-screen flex bg-slate-50">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm">
                {/* Logo */}
                <div className="p-6 border-b border-slate-200">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg">
                            <GraduationCap className="w-6 h-6 text-slate-800" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold gradient-text">CertiFlow</h1>
                            <p className="text-xs text-slate-500">Certificate Generator</p>
                        </div>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4">
                    <ul className="space-y-2">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path;
                            const Icon = item.icon;

                            return (
                                <li key={item.path}>
                                    <Link
                                        to={item.path}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                                            ? 'bg-gradient-to-r from-primary-500/10 to-accent-500/10 text-primary-700 border border-primary-200'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                            }`}
                                    >
                                        <Icon className={`w-5 h-5 ${isActive ? 'text-primary-600' : ''}`} />
                                        <span className="font-medium">{item.label}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200">
                    <div className="bg-slate-100 rounded-lg p-4">
                        <p className="text-xs text-slate-500 text-center">
                            CertiFlow v1.0.0
                        </p>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-slate-50">
                <div className="p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
