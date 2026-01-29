import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    FileText,
    Mail,
    CheckCircle,
    Clock,
    AlertCircle,
    ArrowRight,
    TrendingUp,
    Sparkles
} from 'lucide-react';
import { jobApi, emailApi } from '../services/api';
import toast from 'react-hot-toast';

interface Job {
    id: string;
    type: string;
    status: string;
    totalCount: number;
    processedCount: number;
    successCount: number;
    failedCount: number;
    createdAt: string;
    completedAt: string | null;
}

interface EmailStats {
    emailsSentToday: number;
    dailyLimit: number;
    remaining: number;
}

export default function Dashboard() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [jobsRes, statsRes] = await Promise.all([
                jobApi.list(),
                emailApi.getStats(),
            ]);
            setJobs(jobsRes.data);
            setEmailStats(statsRes.data);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="w-5 h-5 text-green-600" />;
            case 'processing':
                return <Clock className="w-5 h-5 text-amber-500 animate-pulse" />;
            case 'failed':
                return <AlertCircle className="w-5 h-5 text-red-500" />;
            default:
                return <Clock className="w-5 h-5 text-slate-500" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
                return 'text-green-700 bg-green-100';
            case 'processing':
                return 'text-amber-700 bg-amber-100';
            case 'failed':
                return 'text-red-700 bg-red-100';
            default:
                return 'text-slate-600 bg-slate-100';
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const totalCertificates = jobs
        .filter(j => j.type === 'certificate')
        .reduce((sum, j) => sum + j.successCount, 0);

    const totalEmails = jobs
        .filter(j => j.type === 'email')
        .reduce((sum, j) => sum + j.successCount, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 mb-2">Dashboard</h1>
                    <p className="text-slate-500">Welcome to CertiFlow - your certificate management system</p>
                </div>
                <Link to="/certificates" className="btn-primary flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Create Certificates
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-primary-600" />
                        </div>
                        <TrendingUp className="w-5 h-5 text-green-500" />
                    </div>
                    <p className="text-3xl font-bold text-slate-800 mb-1">{totalCertificates}</p>
                    <p className="text-sm text-slate-500">Certificates Generated</p>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-accent-100 flex items-center justify-center">
                            <Mail className="w-6 h-6 text-accent-600" />
                        </div>
                        <TrendingUp className="w-5 h-5 text-green-500" />
                    </div>
                    <p className="text-3xl font-bold text-slate-800 mb-1">{totalEmails}</p>
                    <p className="text-sm text-slate-500">Emails Sent</p>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-800 mb-1">
                        {jobs.filter(j => j.status === 'completed').length}
                    </p>
                    <p className="text-sm text-slate-500">Completed Jobs</p>
                </div>

                {emailStats && (
                    <div className="card">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                                <Mail className="w-6 h-6 text-amber-600" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-slate-800 mb-1">{emailStats.remaining}</p>
                        <p className="text-sm text-slate-500">Emails Left Today ({emailStats.dailyLimit}/day)</p>
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Link to="/certificates" className="card-hover group">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg">
                                <FileText className="w-7 h-7 text-slate-800" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-1">Generate Certificates</h3>
                                <p className="text-sm text-slate-500">Upload template and CSV to create certificates</p>
                            </div>
                        </div>
                        <ArrowRight className="w-6 h-6 text-slate-500 group-hover:text-primary-600 group-hover:translate-x-1 transition-all" />
                    </div>
                </Link>

                <Link to="/email" className="card-hover group">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center shadow-lg">
                                <Mail className="w-7 h-7 text-slate-800" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-1">Send Emails</h3>
                                <p className="text-sm text-slate-500">Send certificates via email to recipients</p>
                            </div>
                        </div>
                        <ArrowRight className="w-6 h-6 text-slate-500 group-hover:text-accent-600 group-hover:translate-x-1 transition-all" />
                    </div>
                </Link>
            </div>

            {/* Recent Jobs */}
            <div className="card">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-slate-800">Recent Jobs</h2>
                    <Link to="/certificates" className="text-sm text-primary-600 hover:text-primary-700 transition-colors">
                        View All
                    </Link>
                </div>

                {jobs.length === 0 ? (
                    <div className="text-center py-12">
                        <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500 mb-4">No jobs yet</p>
                        <Link to="/certificates" className="btn-primary">
                            Create Your First Batch
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Type</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Status</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Progress</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Created</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {jobs.slice(0, 5).map((job) => (
                                    <tr key={job.id} className="border-b border-slate-100 hover:bg-slate-50">
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-2">
                                                {job.type === 'certificate' ? (
                                                    <FileText className="w-5 h-5 text-primary-600" />
                                                ) : (
                                                    <Mail className="w-5 h-5 text-accent-600" />
                                                )}
                                                <span className="text-slate-700 capitalize">{job.type}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                                                {getStatusIcon(job.status)}
                                                {job.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full"
                                                        style={{ width: `${(job.processedCount / job.totalCount) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm text-slate-500">
                                                    {job.successCount}/{job.totalCount}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-sm text-slate-500">
                                            {formatDate(job.createdAt)}
                                        </td>
                                        <td className="py-4 px-4">
                                            <Link
                                                to={`/jobs/${job.id}`}
                                                className="text-sm text-primary-600 hover:text-primary-700 transition-colors"
                                            >
                                                View Details
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
