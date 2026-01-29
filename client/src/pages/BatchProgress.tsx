import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft,
    Download,
    RefreshCw,
    CheckCircle,
    XCircle,
    Clock,
    Mail,
    FileText,
    RotateCcw,
    ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import ProgressBar from '../components/ProgressBar';
import { jobApi, certificateApi } from '../services/api';
import socketService, { JobProgress } from '../services/socket';

interface Job {
    id: string;
    type: string;
    status: string;
    config: {
        templateId?: string;
        namingPattern?: string;
        outputPath?: string;
        emailTemplateId?: string;
        smtpConfigId?: string;
    };
    totalCount: number;
    processedCount: number;
    successCount: number;
    failedCount: number;
    outputPath?: string;
    createdAt: string;
    completedAt: string | null;
}

interface Recipient {
    id: string;
    email: string;
    fullName: string;
    certificatePath: string | null;
    emailStatus: string;
    errorMessage: string | null;
    sentAt: string | null;
}

export default function BatchProgress() {
    const { jobId } = useParams<{ jobId: string }>();
    const [job, setJob] = useState<Job | null>(null);
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [isRetrying, setIsRetrying] = useState(false);

    useEffect(() => {
        if (jobId) {
            loadJob();
            loadRecipients();

            // Connect to socket for real-time updates
            socketService.connect();
            socketService.joinJob(jobId);
            socketService.onJobProgress(handleProgress);
        }

        return () => {
            if (jobId) {
                socketService.leaveJob(jobId);
                socketService.offJobProgress();
            }
        };
    }, [jobId]);

    useEffect(() => {
        loadRecipients();
    }, [currentPage, statusFilter]);

    const loadJob = async () => {
        if (!jobId) return;
        try {
            const res = await jobApi.get(jobId);
            setJob(res.data);
        } catch (error) {
            console.error('Error loading job:', error);
            toast.error('Failed to load job');
        } finally {
            setLoading(false);
        }
    };

    const loadRecipients = async () => {
        if (!jobId) return;
        try {
            const res = await jobApi.getRecipients(jobId, {
                page: currentPage,
                limit: 20,
                status: statusFilter || undefined,
            });
            setRecipients(res.data.recipients);
            setTotalPages(res.data.pagination.totalPages);
        } catch (error) {
            console.error('Error loading recipients:', error);
        }
    };

    const handleProgress = (data: JobProgress) => {
        if (data.jobId === jobId) {
            setJob(prev => prev ? {
                ...prev,
                processedCount: data.processed,
                status: data.status,
            } : null);

            if (data.status === 'completed') {
                loadJob();
                loadRecipients();
            }
        }
    };

    const handleRetryFailed = async () => {
        if (!jobId) return;
        setIsRetrying(true);
        try {
            const res = await jobApi.retryFailed(jobId);
            toast.success(`${res.data.retriedCount} recipient(s) queued for retry`);
            loadJob();
            loadRecipients();
        } catch (error) {
            console.error('Error retrying failed:', error);
            toast.error('Failed to retry');
        } finally {
            setIsRetrying(false);
        }
    };

    const handleDownloadAll = () => {
        if (!jobId) return;
        window.open(certificateApi.downloadAll(jobId), '_blank');
    };

    const handleOpenFolder = () => {
        if (job?.outputPath) {
            // This would ideally trigger a native file explorer
            toast.success(`Certificates saved to: ${job.outputPath}`);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
            case 'sent':
                return <CheckCircle className="w-5 h-5 text-green-600" />;
            case 'processing':
                return <Clock className="w-5 h-5 text-amber-500 animate-pulse" />;
            case 'failed':
                return <XCircle className="w-5 h-5 text-red-500" />;
            default:
                return <Clock className="w-5 h-5 text-slate-500" />;
        }
    };

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            completed: 'bg-green-500/20 text-green-600',
            sent: 'bg-green-500/20 text-green-600',
            processing: 'bg-yellow-500/20 text-amber-500',
            failed: 'bg-red-500/20 text-red-500',
            pending: 'bg-slate-500/20 text-slate-500',
        };
        return colors[status] || colors.pending;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!job) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500 mb-4">Job not found</p>
                <Link to="/" className="btn-primary">Go to Dashboard</Link>
            </div>
        );
    }

    const percentage = job.totalCount > 0 ? Math.round((job.processedCount / job.totalCount) * 100) : 0;
    const isProcessing = job.status === 'processing';

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/" className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-800">
                                {job.type === 'certificate' ? 'Certificate Generation' : 'Email Sending'}
                            </h1>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(job.status)}`}>
                                {job.status}
                            </span>
                        </div>
                        <p className="text-slate-500 text-sm">Job ID: {job.id}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {job.type === 'certificate' && job.status === 'completed' && (
                        <>
                            <button onClick={handleOpenFolder} className="btn-outline flex items-center gap-2">
                                <ExternalLink className="w-4 h-4" />
                                Open Folder
                            </button>
                            <button onClick={handleDownloadAll} className="btn-primary flex items-center gap-2">
                                <Download className="w-4 h-4" />
                                Download All
                            </button>
                        </>
                    )}
                    {job.failedCount > 0 && (
                        <button
                            onClick={handleRetryFailed}
                            disabled={isRetrying}
                            className="btn-secondary flex items-center gap-2"
                        >
                            <RotateCcw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                            Retry Failed ({job.failedCount})
                        </button>
                    )}
                </div>
            </div>

            {/* Progress Card */}
            <div className="card">
                <div className="flex items-center gap-6 mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center relative">
                        {job.type === 'certificate' ? (
                            <FileText className="w-10 h-10 text-primary-600" />
                        ) : (
                            <Mail className="w-10 h-10 text-accent-600" />
                        )}
                        {isProcessing && <span className="absolute inset-0 rounded-2xl animate-ping bg-primary-500/20" />}
                    </div>
                    <div className="flex-1">
                        <ProgressBar
                            value={job.processedCount}
                            max={job.totalCount}
                            label={isProcessing ? 'Processing...' : 'Completed'}
                            size="lg"
                            animated={isProcessing}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-100 rounded-lg p-4">
                        <p className="text-2xl font-bold text-slate-800">{job.totalCount}</p>
                        <p className="text-sm text-slate-500">Total</p>
                    </div>
                    <div className="bg-slate-100 rounded-lg p-4">
                        <p className="text-2xl font-bold text-slate-800">{job.processedCount}</p>
                        <p className="text-sm text-slate-500">Processed</p>
                    </div>
                    <div className="bg-green-500/10 rounded-lg p-4">
                        <p className="text-2xl font-bold text-green-600">{job.successCount}</p>
                        <p className="text-sm text-slate-500">Successful</p>
                    </div>
                    <div className="bg-red-500/10 rounded-lg p-4">
                        <p className="text-2xl font-bold text-red-500">{job.failedCount}</p>
                        <p className="text-sm text-slate-500">Failed</p>
                    </div>
                </div>

                {job.outputPath && (
                    <div className="mt-4 p-3 bg-slate-100 rounded-lg">
                        <p className="text-sm text-slate-500">
                            Output Path: <span className="text-slate-800 font-mono">{job.outputPath}</span>
                        </p>
                    </div>
                )}
            </div>

            {/* Recipients Table */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-800">Recipients</h2>
                    <div className="flex gap-2">
                        <select
                            className="input w-40"
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                        >
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="sent">Sent</option>
                            <option value="failed">Failed</option>
                        </select>
                        <button onClick={loadRecipients} className="btn-outline p-2">
                            <RefreshCw className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Name</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Email</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Status</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">
                                    {job.type === 'certificate' ? 'Certificate' : 'Sent At'}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {recipients.map((recipient) => (
                                <tr key={recipient.id} className="border-b border-slate-200 hover:bg-slate-50">
                                    <td className="py-3 px-4 text-slate-800">{recipient.fullName}</td>
                                    <td className="py-3 px-4 text-slate-500">{recipient.email}</td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(recipient.emailStatus)}
                                            <span className={`text-sm ${recipient.emailStatus === 'sent' ? 'text-green-600' :
                                                recipient.emailStatus === 'failed' ? 'text-red-500' :
                                                    'text-slate-500'
                                                }`}>
                                                {recipient.emailStatus}
                                            </span>
                                        </div>
                                        {recipient.errorMessage && (
                                            <p className="text-xs text-red-500 mt-1">{recipient.errorMessage}</p>
                                        )}
                                    </td>
                                    <td className="py-3 px-4">
                                        {job.type === 'certificate' ? (
                                            recipient.certificatePath ? (
                                                <a
                                                    href={certificateApi.download(recipient.id)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary-600 hover:text-primary-300 text-sm flex items-center gap-1"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    Download
                                                </a>
                                            ) : (
                                                <span className="text-slate-500 text-sm">-</span>
                                            )
                                        ) : (
                                            recipient.sentAt ? (
                                                <span className="text-sm text-slate-500">
                                                    {new Date(recipient.sentAt).toLocaleString()}
                                                </span>
                                            ) : (
                                                <span className="text-slate-500 text-sm">-</span>
                                            )
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {recipients.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-slate-500">
                                        No recipients found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-slate-200">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="btn-outline p-2 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-slate-500">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="btn-outline p-2 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            {/* Continue to Email */}
            {job.type === 'certificate' && job.status === 'completed' && (
                <div className="card bg-gradient-to-r from-primary-500/10 to-accent-500/10 border-primary-500/30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Mail className="w-10 h-10 text-accent-600" />
                            <div>
                                <h3 className="font-semibold text-slate-800">Ready to send emails?</h3>
                                <p className="text-sm text-slate-500">
                                    {job.successCount} certificates are ready to be sent to recipients
                                </p>
                            </div>
                        </div>
                        <Link to="/email" className="btn-primary">
                            Continue to Email
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
