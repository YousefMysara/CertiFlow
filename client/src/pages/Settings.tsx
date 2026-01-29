import { useState, useEffect } from 'react';
import {
    Settings as SettingsIcon,
    Mail,
    Plus,
    Trash2,
    Check,
    AlertCircle,
    Save,
    TestTube,
    Folder
} from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsApi } from '../services/api';

interface AppSettings {
    id: string;
    defaultOutputPath: string;
    emailDelayMs: number;
    maxEmailsPerDay: number;
}

interface SmtpConfig {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    fromName?: string;
    isDefault: boolean;
}

export default function Settings() {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [smtpConfigs, setSmtpConfigs] = useState<SmtpConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddSmtp, setShowAddSmtp] = useState(false);
    const [testingSmtp, setTestingSmtp] = useState<string | null>(null);

    // New SMTP form
    const [newSmtp, setNewSmtp] = useState({
        name: '',
        host: 'smtp.gmail.com',
        port: 587,
        username: '',
        password: '',
        fromName: '',
        isDefault: false,
    });

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const [settingsRes, smtpRes] = await Promise.all([
                settingsApi.get(),
                settingsApi.getSmtpConfigs(),
            ]);
            setSettings(settingsRes.data);
            setSmtpConfigs(smtpRes.data);
        } catch (error) {
            console.error('Error loading settings:', error);
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        if (!settings) return;
        try {
            await settingsApi.update({
                defaultOutputPath: settings.defaultOutputPath,
                emailDelayMs: settings.emailDelayMs,
                maxEmailsPerDay: settings.maxEmailsPerDay,
            });
            toast.success('Settings saved');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings');
        }
    };

    const handleAddSmtp = async () => {
        if (!newSmtp.name || !newSmtp.username || !newSmtp.password) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            await settingsApi.createSmtpConfig(newSmtp);
            toast.success('SMTP configuration added');
            setShowAddSmtp(false);
            setNewSmtp({
                name: '',
                host: 'smtp.gmail.com',
                port: 587,
                username: '',
                password: '',
                fromName: '',
                isDefault: false,
            });
            loadSettings();
        } catch (error) {
            console.error('Error adding SMTP:', error);
            toast.error('Failed to add SMTP configuration');
        }
    };

    const handleTestSmtp = async (id: string) => {
        setTestingSmtp(id);
        try {
            const res = await settingsApi.testSmtpConfig({ id });
            if (res.data.success) {
                toast.success('SMTP connection successful!');
            } else {
                toast.error(res.data.message);
            }
        } catch (error) {
            console.error('Error testing SMTP:', error);
            toast.error('SMTP connection failed');
        } finally {
            setTestingSmtp(null);
        }
    };

    const handleDeleteSmtp = async (id: string) => {
        if (!confirm('Are you sure you want to delete this SMTP configuration?')) return;

        try {
            await settingsApi.deleteSmtpConfig(id);
            toast.success('SMTP configuration deleted');
            loadSettings();
        } catch (error) {
            console.error('Error deleting SMTP:', error);
            toast.error('Failed to delete SMTP configuration');
        }
    };

    const handleSetDefault = async (id: string) => {
        try {
            await settingsApi.updateSmtpConfig(id, { isDefault: true });
            toast.success('Default SMTP updated');
            loadSettings();
        } catch (error) {
            console.error('Error setting default:', error);
            toast.error('Failed to set default');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-800 mb-2">Settings</h1>
                <p className="text-slate-500">Configure your CertiFlow application</p>
            </div>

            {/* General Settings */}
            <div className="card">
                <h2 className="text-xl font-semibold text-slate-800 mb-6 flex items-center gap-2">
                    <SettingsIcon className="w-5 h-5 text-primary-600" />
                    General Settings
                </h2>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                            <Folder className="w-4 h-4" />
                            Default Output Path
                        </label>
                        <input
                            type="text"
                            className="input"
                            placeholder="e.g., C:\Users\YourName\Documents\Certificates"
                            value={settings?.defaultOutputPath || ''}
                            onChange={(e) => setSettings(s => s ? { ...s, defaultOutputPath: e.target.value } : s)}
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Default folder where certificates will be saved
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Email Delay (milliseconds)
                            </label>
                            <input
                                type="number"
                                className="input"
                                min={1000}
                                max={10000}
                                value={settings?.emailDelayMs || 3000}
                                onChange={(e) => setSettings(s => s ? { ...s, emailDelayMs: parseInt(e.target.value) } : s)}
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Delay between sending emails (recommended: 3000ms)
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Daily Email Limit
                            </label>
                            <input
                                type="number"
                                className="input"
                                min={1}
                                max={2000}
                                value={settings?.maxEmailsPerDay || 500}
                                onChange={(e) => setSettings(s => s ? { ...s, maxEmailsPerDay: parseInt(e.target.value) } : s)}
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Gmail free: 500/day, Workspace: 2000/day
                            </p>
                        </div>
                    </div>

                    <button onClick={handleSaveSettings} className="btn-primary flex items-center gap-2">
                        <Save className="w-4 h-4" />
                        Save Settings
                    </button>
                </div>
            </div>

            {/* SMTP Configuration */}
            <div className="card">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                        <Mail className="w-5 h-5 text-accent-600" />
                        SMTP Configuration
                    </h2>
                    <button
                        onClick={() => setShowAddSmtp(true)}
                        className="btn-primary text-sm flex items-center gap-1"
                    >
                        <Plus className="w-4 h-4" />
                        Add SMTP
                    </button>
                </div>

                {/* Gmail Instructions */}
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                    <h3 className="font-medium text-amber-500 mb-2 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Gmail SMTP Setup
                    </h3>
                    <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
                        <li>Enable 2-Factor Authentication on your Google Account</li>
                        <li>Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Google App Passwords</a></li>
                        <li>Create a new App Password for "Mail"</li>
                        <li>Use that 16-character password below (not your regular Gmail password)</li>
                    </ol>
                </div>

                {/* SMTP List */}
                {smtpConfigs.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">
                        No SMTP configurations yet. Add one to start sending emails.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {smtpConfigs.map((config) => (
                            <div
                                key={config.id}
                                className={`p-4 rounded-lg border transition-colors ${config.isDefault
                                        ? 'bg-accent-500/10 border-accent-500/50'
                                        : 'bg-slate-100 border-slate-600'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center">
                                            <Mail className="w-6 h-6 text-accent-600" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-slate-800">{config.name}</p>
                                                {config.isDefault && (
                                                    <span className="text-xs bg-accent-500/20 text-accent-600 px-2 py-0.5 rounded">
                                                        Default
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-500">
                                                {config.username} • {config.host}:{config.port}
                                            </p>
                                            {config.fromName && (
                                                <p className="text-xs text-slate-500">From: {config.fromName}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleTestSmtp(config.id)}
                                            disabled={testingSmtp === config.id}
                                            className="btn-outline text-sm flex items-center gap-1"
                                        >
                                            <TestTube className={`w-4 h-4 ${testingSmtp === config.id ? 'animate-pulse' : ''}`} />
                                            {testingSmtp === config.id ? 'Testing...' : 'Test'}
                                        </button>
                                        {!config.isDefault && (
                                            <button
                                                onClick={() => handleSetDefault(config.id)}
                                                className="btn-outline text-sm flex items-center gap-1"
                                            >
                                                <Check className="w-4 h-4" />
                                                Set Default
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteSmtp(config.id)}
                                            className="p-2 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Add SMTP Modal */}
                {showAddSmtp && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl max-w-md w-full p-6">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">Add SMTP Configuration</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-slate-500 mb-1">Configuration Name *</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="e.g., My Gmail"
                                        value={newSmtp.name}
                                        onChange={(e) => setNewSmtp(s => ({ ...s, name: e.target.value }))}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-slate-500 mb-1">SMTP Host</label>
                                        <input
                                            type="text"
                                            className="input"
                                            value={newSmtp.host}
                                            onChange={(e) => setNewSmtp(s => ({ ...s, host: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-slate-500 mb-1">Port</label>
                                        <select
                                            className="input"
                                            value={newSmtp.port}
                                            onChange={(e) => setNewSmtp(s => ({ ...s, port: parseInt(e.target.value) }))}
                                        >
                                            <option value={587}>587 (TLS)</option>
                                            <option value={465}>465 (SSL)</option>
                                            <option value={25}>25</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm text-slate-500 mb-1">Email / Username *</label>
                                    <input
                                        type="email"
                                        className="input"
                                        placeholder="your-email@gmail.com"
                                        value={newSmtp.username}
                                        onChange={(e) => setNewSmtp(s => ({ ...s, username: e.target.value }))}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-slate-500 mb-1">App Password *</label>
                                    <input
                                        type="password"
                                        className="input"
                                        placeholder="16-character App Password"
                                        value={newSmtp.password}
                                        onChange={(e) => setNewSmtp(s => ({ ...s, password: e.target.value }))}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-slate-500 mb-1">From Name (optional)</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="e.g., CertiFlow"
                                        value={newSmtp.fromName}
                                        onChange={(e) => setNewSmtp(s => ({ ...s, fromName: e.target.value }))}
                                    />
                                </div>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newSmtp.isDefault}
                                        onChange={(e) => setNewSmtp(s => ({ ...s, isDefault: e.target.checked }))}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-200 text-primary-500 focus:ring-primary-500"
                                    />
                                    <span className="text-sm text-slate-300">Set as default</span>
                                </label>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowAddSmtp(false)}
                                    className="btn-outline flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddSmtp}
                                    className="btn-primary flex-1"
                                >
                                    Add Configuration
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* About */}
            <div className="card">
                <h2 className="text-xl font-semibold text-slate-800 mb-4">About CertiFlow</h2>
                <p className="text-slate-500 mb-4">
                    CertiFlow is a powerful web application for batch certificate generation and automated email delivery.
                    Generate personalized PDF certificates from templates and send them to recipients with custom HTML emails.
                </p>
                <div className="text-sm text-slate-500">
                    <p>Version: 1.0.0</p>
                    <p>Built with React, Node.js, and pdf-lib</p>
                </div>
            </div>
        </div>
    );
}
