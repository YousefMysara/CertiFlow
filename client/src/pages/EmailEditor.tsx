import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import {
    Mail,
    Send,
    Eye,
    Code,
    Bold,
    Italic,
    Underline as UnderlineIcon,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Link as LinkIcon,
    List,
    ListOrdered,
    Undo,
    Redo,
    Plus,
    FileText,
    Play,
    TestTube
} from 'lucide-react';
import toast from 'react-hot-toast';
import { emailTemplateApi, emailApi, jobApi, settingsApi } from '../services/api';

interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    htmlContent: string;
    placeholders: string[];
}

interface Job {
    id: string;
    type: string;
    status: string;
    totalCount: number;
    successCount: number;
}

interface SmtpConfig {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    isDefault: boolean;
}

const PLACEHOLDERS = [
    { name: 'name', label: 'Name' },
    { name: 'email', label: 'Email' },
    { name: 'event_name', label: 'Event Name' },
    { name: 'date', label: 'Date' },
    { name: 'certificate_id', label: 'Certificate ID' },
];

export default function EmailEditor() {
    const navigate = useNavigate();

    // State
    const [step, setStep] = useState<'template' | 'select' | 'send'>('template');
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
    const [templateName, setTemplateName] = useState('');
    const [subject, setSubject] = useState('');
    const [isHtmlMode, setIsHtmlMode] = useState(false);
    const [htmlContent, setHtmlContent] = useState('');
    const [previewHtml, setPreviewHtml] = useState('');
    const [showPreview, setShowPreview] = useState(false);

    // Job selection
    const [certificateJobs, setCertificateJobs] = useState<Job[]>([]);
    const [selectedJobId, setSelectedJobId] = useState<string>('');

    // SMTP
    const [smtpConfigs, setSmtpConfigs] = useState<SmtpConfig[]>([]);
    const [selectedSmtpId, setSelectedSmtpId] = useState<string>('');
    const [emailDelay, setEmailDelay] = useState(3000);

    // Test send
    const [testEmail, setTestEmail] = useState('');
    const [isSending, setIsSending] = useState(false);

    // TipTap Editor
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Link.configure({
                openOnClick: false,
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Placeholder.configure({
                placeholder: 'Start writing your email content...',
            }),
        ],
        content: '',
        editorProps: {
            attributes: {
                class: 'tiptap-editor focus:outline-none min-h-[300px]',
            },
        },
        onUpdate: ({ editor }) => {
            setHtmlContent(editor.getHTML());
        },
    });

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (selectedTemplate && editor) {
            setSubject(selectedTemplate.subject);
            editor.commands.setContent(selectedTemplate.htmlContent);
            setHtmlContent(selectedTemplate.htmlContent);
        }
    }, [selectedTemplate, editor]);

    const loadData = async () => {
        try {
            const [templatesRes, jobsRes, smtpRes] = await Promise.all([
                emailTemplateApi.list(),
                jobApi.list({ type: 'certificate', status: 'completed' }),
                settingsApi.getSmtpConfigs(),
            ]);

            setTemplates(templatesRes.data);
            setCertificateJobs(jobsRes.data);
            setSmtpConfigs(smtpRes.data);

            // Set default SMTP
            const defaultSmtp = smtpRes.data.find((s: SmtpConfig) => s.isDefault);
            if (defaultSmtp) {
                setSelectedSmtpId(defaultSmtp.id);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    };

    const handleSelectTemplate = (template: EmailTemplate) => {
        setSelectedTemplate(template);
        setStep('template');
    };

    const handleSaveTemplate = async () => {
        if (!templateName || !subject || !htmlContent) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            if (selectedTemplate) {
                // Update existing
                await emailTemplateApi.update(selectedTemplate.id, {
                    name: templateName,
                    subject,
                    htmlContent,
                });
                toast.success('Template updated');
            } else {
                // Create new
                const res = await emailTemplateApi.create({
                    name: templateName,
                    subject,
                    htmlContent,
                });
                setSelectedTemplate(res.data);
                toast.success('Template created');
            }
            loadData();
        } catch (error) {
            console.error('Error saving template:', error);
            toast.error('Failed to save template');
        }
    };

    const handlePreview = async () => {
        try {
            const res = await emailApi.preview({ htmlContent });
            setPreviewHtml(res.data.html);
            setShowPreview(true);
        } catch (error) {
            console.error('Error previewing email:', error);
            toast.error('Failed to preview email');
        }
    };

    const handleTestSend = async () => {
        if (!testEmail || !subject || !htmlContent) {
            toast.error('Please fill in all required fields and test email address');
            return;
        }

        if (!selectedSmtpId) {
            toast.error('Please configure SMTP settings first');
            return;
        }

        setIsSending(true);
        try {
            await emailApi.testSend({
                to: testEmail,
                subject,
                htmlContent,
                smtpConfigId: selectedSmtpId,
            });
            toast.success('Test email sent successfully!');
        } catch (error: unknown) {
            console.error('Error sending test email:', error);
            const message = error && typeof error === 'object' && 'response' in error
                ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
                : 'Failed to send test email';
            toast.error(message || 'Failed to send test email');
        } finally {
            setIsSending(false);
        }
    };

    const handleSendBatch = async () => {
        if (!selectedJobId || !selectedTemplate || !selectedSmtpId) {
            toast.error('Please select a certificate job, email template, and SMTP configuration');
            return;
        }

        setIsSending(true);
        try {
            const res = await emailApi.sendBatch({
                certificateJobId: selectedJobId,
                emailTemplateId: selectedTemplate.id,
                smtpConfigId: selectedSmtpId,
                subject,
                delayMs: emailDelay,
            });
            toast.success('Email batch started!');
            navigate(`/jobs/${res.data.jobId}`);
        } catch (error) {
            console.error('Error starting email batch:', error);
            toast.error('Failed to start email batch');
        } finally {
            setIsSending(false);
        }
    };

    const insertPlaceholder = (name: string) => {
        if (editor) {
            editor.commands.insertContent(`{{${name}}}`);
        }
    };

    const MenuBar = () => {
        if (!editor) return null;

        return (
            <div className="flex flex-wrap gap-1 p-2 bg-slate-200 rounded-t-lg border-b border-slate-600">
                <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`p-2 rounded hover:bg-slate-300 ${editor.isActive('bold') ? 'bg-slate-600 text-slate-800' : 'text-slate-300'}`}
                >
                    <Bold className="w-4 h-4" />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`p-2 rounded hover:bg-slate-300 ${editor.isActive('italic') ? 'bg-slate-600 text-slate-800' : 'text-slate-300'}`}
                >
                    <Italic className="w-4 h-4" />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={`p-2 rounded hover:bg-slate-300 ${editor.isActive('underline') ? 'bg-slate-600 text-slate-800' : 'text-slate-300'}`}
                >
                    <UnderlineIcon className="w-4 h-4" />
                </button>

                <div className="w-px h-6 bg-slate-600 mx-1 self-center" />

                <button
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    className={`p-2 rounded hover:bg-slate-300 ${editor.isActive({ textAlign: 'left' }) ? 'bg-slate-600 text-slate-800' : 'text-slate-300'}`}
                >
                    <AlignLeft className="w-4 h-4" />
                </button>
                <button
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    className={`p-2 rounded hover:bg-slate-300 ${editor.isActive({ textAlign: 'center' }) ? 'bg-slate-600 text-slate-800' : 'text-slate-300'}`}
                >
                    <AlignCenter className="w-4 h-4" />
                </button>
                <button
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    className={`p-2 rounded hover:bg-slate-300 ${editor.isActive({ textAlign: 'right' }) ? 'bg-slate-600 text-slate-800' : 'text-slate-300'}`}
                >
                    <AlignRight className="w-4 h-4" />
                </button>

                <div className="w-px h-6 bg-slate-600 mx-1 self-center" />

                <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`p-2 rounded hover:bg-slate-300 ${editor.isActive('bulletList') ? 'bg-slate-600 text-slate-800' : 'text-slate-300'}`}
                >
                    <List className="w-4 h-4" />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`p-2 rounded hover:bg-slate-300 ${editor.isActive('orderedList') ? 'bg-slate-600 text-slate-800' : 'text-slate-300'}`}
                >
                    <ListOrdered className="w-4 h-4" />
                </button>

                <div className="w-px h-6 bg-slate-600 mx-1 self-center" />

                <button
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    className="p-2 rounded hover:bg-slate-300 text-slate-300 disabled:opacity-50"
                >
                    <Undo className="w-4 h-4" />
                </button>
                <button
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    className="p-2 rounded hover:bg-slate-300 text-slate-300 disabled:opacity-50"
                >
                    <Redo className="w-4 h-4" />
                </button>

                <div className="flex-1" />

                <button
                    onClick={() => setIsHtmlMode(!isHtmlMode)}
                    className={`p-2 rounded hover:bg-slate-300 ${isHtmlMode ? 'bg-primary-500 text-slate-800' : 'text-slate-300'}`}
                >
                    <Code className="w-4 h-4" />
                </button>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 mb-2">Email Editor</h1>
                    <p className="text-slate-500">Create email templates and send certificates to recipients</p>
                </div>
            </div>

            {/* Steps */}
            <div className="flex items-center gap-4 p-4 card">
                {[
                    { id: 'template', label: 'Template' },
                    { id: 'select', label: 'Select Job' },
                    { id: 'send', label: 'Send' },
                ].map((s, i) => (
                    <button
                        key={s.id}
                        onClick={() => setStep(s.id as typeof step)}
                        className="flex items-center gap-2"
                    >
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm transition-colors ${step === s.id
                                    ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-slate-800'
                                    : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                                }`}
                        >
                            {i + 1}
                        </div>
                        <span className={`text-sm ${step === s.id ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
                            {s.label}
                        </span>
                        {i < 2 && <div className="w-12 h-px bg-slate-200 ml-2" />}
                    </button>
                ))}
            </div>

            {/* Template Editor Step */}
            {step === 'template' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Editor */}
                    <div className="xl:col-span-2 card">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                <Mail className="w-5 h-5 text-primary-600" />
                                Email Editor
                            </h3>
                            <div className="flex gap-2">
                                <button onClick={handlePreview} className="btn-outline text-sm flex items-center gap-1">
                                    <Eye className="w-4 h-4" />
                                    Preview
                                </button>
                                <button onClick={handleSaveTemplate} className="btn-primary text-sm">
                                    Save Template
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-500 mb-1">Template Name</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="e.g., Certificate Delivery"
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-500 mb-1">Email Subject</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="e.g., Your Certificate - {{event_name}}"
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Placeholder Buttons */}
                            <div className="flex flex-wrap gap-2">
                                <span className="text-sm text-slate-500 self-center mr-2">Insert:</span>
                                {PLACEHOLDERS.map((p) => (
                                    <button
                                        key={p.name}
                                        onClick={() => insertPlaceholder(p.name)}
                                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded text-sm text-slate-300 transition-colors"
                                    >
                                        {`{{${p.name}}}`}
                                    </button>
                                ))}
                            </div>

                            {/* Editor */}
                            <div className="border border-slate-600 rounded-lg overflow-hidden">
                                <MenuBar />
                                {isHtmlMode ? (
                                    <textarea
                                        className="w-full h-80 p-4 bg-white text-slate-300 font-mono text-sm focus:outline-none"
                                        value={htmlContent}
                                        onChange={(e) => {
                                            setHtmlContent(e.target.value);
                                            editor?.commands.setContent(e.target.value);
                                        }}
                                    />
                                ) : (
                                    <EditorContent editor={editor} />
                                )}
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={() => setStep('select')}
                                disabled={!htmlContent}
                                className="btn-primary"
                            >
                                Continue to Select Job
                            </button>
                        </div>
                    </div>

                    {/* Templates Sidebar */}
                    <div className="card">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-accent-600" />
                            Saved Templates
                        </h3>

                        <button
                            onClick={() => {
                                setSelectedTemplate(null);
                                setTemplateName('');
                                setSubject('');
                                editor?.commands.setContent('');
                                setHtmlContent('');
                            }}
                            className="w-full mb-4 p-3 border-2 border-dashed border-slate-600 rounded-lg text-slate-500 hover:border-primary-500 hover:text-primary-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            New Template
                        </button>

                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {templates.map((template) => (
                                <button
                                    key={template.id}
                                    onClick={() => {
                                        handleSelectTemplate(template);
                                        setTemplateName(template.name);
                                    }}
                                    className={`w-full p-3 rounded-lg text-left transition-colors ${selectedTemplate?.id === template.id
                                            ? 'bg-primary-500/20 border border-primary-500/50'
                                            : 'bg-slate-100 hover:bg-slate-200'
                                        }`}
                                >
                                    <p className="font-medium text-slate-800 text-sm">{template.name}</p>
                                    <p className="text-xs text-slate-500 truncate">{template.subject}</p>
                                </button>
                            ))}
                            {templates.length === 0 && (
                                <p className="text-slate-500 text-sm text-center py-4">
                                    No templates yet
                                </p>
                            )}
                        </div>

                        {/* Test Send */}
                        <div className="mt-6 pt-6 border-t border-slate-200">
                            <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                                <TestTube className="w-4 h-4 text-amber-500" />
                                Test Send
                            </h4>
                            <div className="space-y-2">
                                <input
                                    type="email"
                                    className="input text-sm"
                                    placeholder="test@example.com"
                                    value={testEmail}
                                    onChange={(e) => setTestEmail(e.target.value)}
                                />
                                <button
                                    onClick={handleTestSend}
                                    disabled={isSending || !testEmail}
                                    className="btn-secondary w-full text-sm"
                                >
                                    {isSending ? 'Sending...' : 'Send Test Email'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Select Job Step */}
            {step === 'select' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="card">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Select Certificate Job</h3>
                        <p className="text-sm text-slate-500 mb-4">
                            Choose a completed certificate generation job to send emails to those recipients.
                        </p>

                        {certificateJobs.length === 0 ? (
                            <div className="text-center py-8">
                                <FileText className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                                <p className="text-slate-500 mb-4">No completed certificate jobs found</p>
                                <button
                                    onClick={() => navigate('/certificates')}
                                    className="btn-primary"
                                >
                                    Generate Certificates First
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {certificateJobs.map((job) => (
                                    <button
                                        key={job.id}
                                        onClick={() => setSelectedJobId(job.id)}
                                        className={`w-full p-4 rounded-lg text-left transition-colors ${selectedJobId === job.id
                                                ? 'bg-primary-500/20 border border-primary-500/50'
                                                : 'bg-slate-100 hover:bg-slate-200'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-slate-800">Job {job.id.slice(0, 8)}...</p>
                                                <p className="text-sm text-slate-500">
                                                    {job.successCount} certificates generated
                                                </p>
                                            </div>
                                            <FileText className="w-5 h-5 text-primary-600" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="mt-4 flex gap-2">
                            <button onClick={() => setStep('template')} className="btn-outline flex-1">
                                Back
                            </button>
                            <button
                                onClick={() => setStep('send')}
                                disabled={!selectedJobId}
                                className="btn-primary flex-1"
                            >
                                Continue
                            </button>
                        </div>
                    </div>

                    <div className="card">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">SMTP Configuration</h3>

                        {smtpConfigs.length === 0 ? (
                            <div className="text-center py-8">
                                <Mail className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                                <p className="text-slate-500 mb-4">No SMTP configuration found</p>
                                <button
                                    onClick={() => navigate('/settings')}
                                    className="btn-primary"
                                >
                                    Configure SMTP
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {smtpConfigs.map((config) => (
                                    <button
                                        key={config.id}
                                        onClick={() => setSelectedSmtpId(config.id)}
                                        className={`w-full p-4 rounded-lg text-left transition-colors ${selectedSmtpId === config.id
                                                ? 'bg-accent-500/20 border border-accent-500/50'
                                                : 'bg-slate-100 hover:bg-slate-200'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-slate-800">{config.name}</p>
                                                <p className="text-sm text-slate-500">
                                                    {config.username} ({config.host}:{config.port})
                                                </p>
                                            </div>
                                            {config.isDefault && (
                                                <span className="text-xs bg-accent-500/20 text-accent-600 px-2 py-1 rounded">
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <label className="block text-sm text-slate-500 mb-1">
                                Delay Between Emails (ms)
                            </label>
                            <input
                                type="number"
                                className="input"
                                value={emailDelay}
                                onChange={(e) => setEmailDelay(parseInt(e.target.value))}
                                min={1000}
                                max={10000}
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Recommended: 3000ms (3 seconds) to avoid Gmail limits
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Send Step */}
            {step === 'send' && (
                <div className="max-w-2xl mx-auto card">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
                        <Send className="w-5 h-5 text-primary-600" />
                        Ready to Send
                    </h3>

                    <div className="bg-slate-100 rounded-lg p-4 mb-6">
                        <h4 className="font-medium text-slate-800 mb-3">Summary</h4>
                        <ul className="text-sm text-slate-500 space-y-2">
                            <li className="flex justify-between">
                                <span>Email Template:</span>
                                <span className="text-slate-800">{selectedTemplate?.name || 'Custom'}</span>
                            </li>
                            <li className="flex justify-between">
                                <span>Subject:</span>
                                <span className="text-slate-800">{subject}</span>
                            </li>
                            <li className="flex justify-between">
                                <span>Certificate Job:</span>
                                <span className="text-slate-800">{selectedJobId.slice(0, 8)}...</span>
                            </li>
                            <li className="flex justify-between">
                                <span>SMTP:</span>
                                <span className="text-slate-800">
                                    {smtpConfigs.find(s => s.id === selectedSmtpId)?.name}
                                </span>
                            </li>
                            <li className="flex justify-between">
                                <span>Delay:</span>
                                <span className="text-slate-800">{emailDelay}ms between emails</span>
                            </li>
                        </ul>
                    </div>

                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                        <p className="text-sm text-amber-500">
                            ⚠️ This will send emails to all recipients in the selected certificate job.
                            Make sure to test your email template first!
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => setStep('select')} className="btn-outline flex-1">
                            Back
                        </button>
                        <button
                            onClick={handleSendBatch}
                            disabled={isSending}
                            className="btn-primary flex-1 flex items-center justify-center gap-2"
                        >
                            {isSending ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Starting...
                                </>
                            ) : (
                                <>
                                    <Play className="w-5 h-5" />
                                    Start Sending Emails
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {showPreview && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200">
                            <h3 className="font-semibold text-slate-800">Email Preview</h3>
                            <button
                                onClick={() => setShowPreview(false)}
                                className="text-slate-500 hover:text-slate-800"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-4 overflow-auto max-h-[70vh]">
                            <div
                                className="bg-white rounded-lg"
                                dangerouslySetInnerHTML={{ __html: previewHtml }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
