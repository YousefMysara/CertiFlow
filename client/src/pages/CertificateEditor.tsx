import { useState, useEffect, useRef } from 'react';
import {
    Upload,
    Play,
    Move,
    Type,
    Palette,
    AlignLeft,
    AlignCenter,
    AlignRight,
    FolderOpen,
    FileText,
    Loader2,
    Database,
    Plus,
    Check,
    X,
    CheckCircle,
    FolderOutput,
    RefreshCw,
    Bold,
    Italic
} from 'lucide-react';
import toast from 'react-hot-toast';
import FileUpload from '../components/FileUpload';
import { certificateTemplateApi, certificateApi, csvApi } from '../services/api';
import { renderPdfToImage } from '../utils/pdfUtils';

interface FieldConfig {
    id: string;
    field: string;
    x: number;
    y: number;
    fontSize: number;
    fontFamily: 'Helvetica' | 'Times' | 'Courier' | 'Cairo' | 'Montserrat';
    fontWeight: 'normal' | 'bold' | 'italic' | 'boldItalic';
    color: string;
    alignment: 'left' | 'center' | 'right';
    isVisible: boolean; // Whether field is placed on canvas
}

interface Template {
    id: string;
    name: string;
    fieldConfigs: FieldConfig[];
    width?: number;
    height?: number;
}

interface CSVData {
    headers: string[];
    totalRows: number;
    preview: Record<string, string>[];
}

const FONT_FAMILIES = [
    { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Times', label: 'Times New Roman' },
    { value: 'Courier', label: 'Courier' },
    { value: 'Cairo', label: 'Cairo' },
    { value: 'Montserrat', label: 'Montserrat' },
];



// Draggable field component
interface DraggableFieldProps {
    config: FieldConfig;
    isSelected: boolean;
    onSelect: () => void;
    onDrag: (x: number, y: number) => void;
    containerRef: React.RefObject<HTMLDivElement>;
}

function DraggableField({ config, isSelected, onSelect, onDrag, containerRef }: DraggableFieldProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const fieldRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        onSelect();
        setIsDragging(true);
        setDragStart({ x: e.clientX - config.x, y: e.clientY - config.y });
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const newX = Math.max(0, Math.min(e.clientX - dragStart.x, rect.width - 100));
            const newY = Math.max(0, Math.min(e.clientY - dragStart.y, rect.height - 30));
            onDrag(newX, newY);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStart, onDrag, containerRef]);

    if (!config.isVisible) return null;

    // Calculate transform based on alignment to make x the anchor point
    let transform = 'translate(0, 0)';
    if (config.alignment === 'center') {
        transform = 'translate(-50%, 0)';
    } else if (config.alignment === 'right') {
        transform = 'translate(-100%, 0)';
    }

    return (
        <div
            ref={fieldRef}
            onMouseDown={handleMouseDown}
            className="absolute cursor-move select-none"
            style={{
                left: config.x,
                top: config.y,
                transform,
                fontSize: `${config.fontSize}px`,
                fontFamily: config.fontFamily,
                fontWeight: config.fontWeight === 'bold' || config.fontWeight === 'boldItalic' ? 'bold' : 'normal',
                fontStyle: config.fontWeight === 'italic' || config.fontWeight === 'boldItalic' ? 'italic' : 'normal',
                color: config.color,
                textAlign: config.alignment,
                borderBottom: isSelected ? '2px dashed #3b82f6' : 'none',
                paddingBottom: isSelected ? '2px' : '0',
                whiteSpace: 'nowrap', // Prevent wrapping
            }}
        >
            {`{{${config.field}}}`}
        </div>
    );
}

export default function CertificateEditor() {
    const overlayRef = useRef<HTMLDivElement>(null);

    // State - NEW WORKFLOW: csv -> template -> fields -> generate
    const [step, setStep] = useState<'csv' | 'template' | 'fields' | 'generate'>('csv');
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [templateFile, setTemplateFile] = useState<File | null>(null);
    const [templateName, setTemplateName] = useState('');
    const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([]);
    const [selectedField, setSelectedField] = useState<string | null>(null);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvData, setCsvData] = useState<CSVData | null>(null);
    const [outputPath, setOutputPath] = useState('');
    const [namingPattern, setNamingPattern] = useState('{{sn}}_{{name}}');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationComplete, setGenerationComplete] = useState(false);
    const [generationProgress, setGenerationProgress] = useState(0);
    const [generatedCount, setGeneratedCount] = useState(0);
    const [pdfImage, setPdfImage] = useState<string | null>(null);
    const [isLoadingPdf, setIsLoadingPdf] = useState(false);
    const [pdfDimensions, setPdfDimensions] = useState<{ width: number; height: number } | null>(null);
    const [displayDimensions, setDisplayDimensions] = useState<{ width: number; height: number } | null>(null);

    // Load templates on mount
    useEffect(() => {
        loadTemplates();

        // Load Google Fonts for preview
        const link = document.createElement('link');
        link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&family=Montserrat:wght@400;700;400i;700i&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);

        return () => {
            document.head.removeChild(link);
        };
    }, []);

    // Set PDF URL and render image when template is selected
    useEffect(() => {
        if (selectedTemplate) {
            const url = certificateTemplateApi.getPdf(selectedTemplate.id) + '?t=' + Date.now();

            // Render PDF to image
            const renderPdf = async () => {
                setIsLoadingPdf(true);
                try {
                    const { dataUrl, width, height, actualWidth, actualHeight } = await renderPdfToImage(url);
                    setPdfImage(dataUrl);
                    // Store actual PDF dimensions (for coordinate scaling to PDF)
                    setPdfDimensions({ width: actualWidth, height: actualHeight });
                    // Display dimensions will be measured after render via overlayRef
                    console.log('[CertificateEditor] PDF actual dimensions:', actualWidth, 'x', actualHeight);
                    console.log('[CertificateEditor] PDF display dimensions:', width, 'x', height);
                } catch (error) {
                    console.error('Error rendering PDF:', error);
                    toast.error('Failed to load PDF preview');
                } finally {
                    setIsLoadingPdf(false);
                }
            };
            renderPdf();
        }
    }, [selectedTemplate]);

    // Measure display container dimensions when PDF loads
    useEffect(() => {
        if (pdfImage && overlayRef.current) {
            const rect = overlayRef.current.getBoundingClientRect();
            setDisplayDimensions({ width: rect.width, height: rect.height });
        }
    }, [pdfImage]);

    // Auto-generate fields from CSV headers when CSV is parsed
    const generateFieldsFromCSV = (headers: string[]) => {
        const newFields: FieldConfig[] = headers.map((header, index) => ({
            id: `field_${Date.now()}_${index}`,
            field: header,
            x: 100,
            y: 100 + (index * 40), // Stack fields vertically initially
            fontSize: 16,
            fontFamily: 'Helvetica',
            fontWeight: 'normal',
            color: '#000000',
            alignment: 'center',
            isVisible: false, // Not placed on canvas yet
        }));
        setFieldConfigs(newFields);
    };

    const loadTemplates = async () => {
        try {
            const res = await certificateTemplateApi.list();
            const parsedTemplates = res.data.map((t: { fieldConfigs: string } & Omit<Template, 'fieldConfigs'>) => {
                try {
                    return {
                        ...t,
                        fieldConfigs: typeof t.fieldConfigs === 'string'
                            ? (t.fieldConfigs ? JSON.parse(t.fieldConfigs) : [])
                            : (t.fieldConfigs || []),
                    };
                } catch {
                    return { ...t, fieldConfigs: [] };
                }
            });
            setTemplates(parsedTemplates);
        } catch (error) {
            console.error('Error loading templates:', error);
            toast.error('Failed to load templates');
        }
    };

    const handleCsvUpload = async () => {
        if (!csvFile) {
            toast.error('Please select a CSV file');
            return;
        }

        try {
            const res = await csvApi.parse(csvFile);
            setCsvData(res.data);
            // Auto-generate fields from CSV columns
            generateFieldsFromCSV(res.data.headers);
            toast.success(`CSV loaded: ${res.data.totalRows} rows, ${res.data.headers.length} columns`);
        } catch (error) {
            console.error('CSV parse error:', error);
            toast.error('Failed to parse CSV file');
        }
    };

    const handleSelectTemplate = (template: Template) => {
        setSelectedTemplate(template);
        setStep('fields');
    };

    const handleUploadTemplate = async () => {
        if (!templateFile) {
            toast.error('Please select a PDF file');
            return;
        }

        try {
            const name = templateName || templateFile.name.replace('.pdf', '');
            const res = await certificateTemplateApi.upload(templateFile, name, JSON.stringify([]));
            toast.success('Template uploaded successfully');

            const newTemplate: Template = {
                id: res.data.id,
                name: res.data.name,
                fieldConfigs: [],
                width: res.data.width,
                height: res.data.height,
            };

            setTemplates(prev => [newTemplate, ...prev]);
            setSelectedTemplate(newTemplate);
            setStep('fields');
            setTemplateFile(null);
            setTemplateName('');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Failed to upload template');
        }
    };

    // Add field to canvas at default position
    const addFieldToCanvas = (id: string) => {
        const visibleCount = fieldConfigs.filter(f => f.isVisible).length;
        setFieldConfigs(prev => prev.map(f =>
            f.id === id ? { ...f, isVisible: true, x: 100, y: 100 + (visibleCount * 40) } : f
        ));
        setSelectedField(id);
    };

    // Remove field from canvas
    const removeFieldFromCanvas = (id: string) => {
        setFieldConfigs(prev => prev.map(f =>
            f.id === id ? { ...f, isVisible: false } : f
        ));
        if (selectedField === id) {
            setSelectedField(null);
        }
    };

    const updateField = (id: string, updates: Partial<FieldConfig>) => {
        setFieldConfigs(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const saveFieldConfigs = async () => {
        if (!selectedTemplate) return;

        try {
            // Only save visible fields
            const visibleFields = fieldConfigs.filter(f => f.isVisible);

            // Scale coordinates from display dimensions to actual PDF dimensions
            let scaledFields = visibleFields;
            if (pdfDimensions && displayDimensions && displayDimensions.width > 0 && displayDimensions.height > 0) {
                const scaleX = pdfDimensions.width / displayDimensions.width;
                const scaleY = pdfDimensions.height / displayDimensions.height;

                scaledFields = visibleFields.map(f => ({
                    ...f,
                    x: Math.round(f.x * scaleX),
                    y: Math.round(f.y * scaleY),
                    fontSize: Math.round(f.fontSize * scaleY), // Scale font size too
                }));
            }

            await certificateTemplateApi.update(selectedTemplate.id, {
                fieldConfigs: scaledFields,
            });
            toast.success('Field configuration saved');
            setStep('generate');
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Failed to save field configuration');
        }
    };

    const handleGenerate = async () => {
        if (!selectedTemplate || !csvData || !outputPath) {
            toast.error('Please complete all steps');
            return;
        }

        setIsGenerating(true);
        setGenerationComplete(false);
        setGenerationProgress(0);
        setGeneratedCount(0);

        try {
            await certificateApi.generate(
                csvFile!,
                selectedTemplate.id,
                outputPath,
                namingPattern
            );

            // Simulate progress for now - in production this would be WebSocket updates
            const total = csvData.totalRows;
            for (let i = 1; i <= total; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                setGeneratedCount(i);
                setGenerationProgress(Math.round((i / total) * 100));
            }

            setGenerationComplete(true);
            toast.success(`Successfully generated ${total} certificates!`);
        } catch (error) {
            console.error('Generation error:', error);
            toast.error('Failed to generate certificates');
        } finally {
            setIsGenerating(false);
        }
    };

    const resetAndStartNew = () => {
        setStep('csv');
        setCsvFile(null);
        setCsvData(null);
        setSelectedTemplate(null);
        setFieldConfigs([]);
        setGenerationComplete(false);
        setGenerationProgress(0);
        setPdfImage(null);
    };

    const selectedFieldConfig = fieldConfigs.find(f => f.id === selectedField);
    const visibleFields = fieldConfigs.filter(f => f.isVisible);
    const availableFields = fieldConfigs.filter(f => !f.isVisible);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Certificate Editor</h1>
                    <p className="text-slate-600">Design and generate certificates from templates</p>
                </div>
            </div>

            {/* Progress Steps - NEW ORDER: csv -> template -> fields -> generate */}
            <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200">
                {[
                    { key: 'csv', label: 'Data (CSV)' },
                    { key: 'template', label: 'Template' },
                    { key: 'fields', label: 'Position Fields' },
                    { key: 'generate', label: 'Generate' }
                ].map((s, i) => (
                    <div key={s.key} className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === s.key ? 'bg-primary-500 text-white' :
                            ['csv', 'template', 'fields', 'generate'].indexOf(step) > i
                                ? 'bg-green-500 text-white'
                                : 'bg-slate-200 text-slate-600'
                            }`}>
                            {i + 1}
                        </div>
                        <span className={`text-sm ${step === s.key ? 'font-medium text-primary-600' : 'text-slate-600'}`}>
                            {s.label}
                        </span>
                        {i < 3 && <div className="w-8 h-0.5 bg-slate-200" />}
                    </div>
                ))}
            </div>

            {/* STEP 1: CSV Data (NEW FIRST STEP) */}
            {step === 'csv' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="card">
                        <div className="flex items-center gap-2 mb-4">
                            <Database className="w-5 h-5 text-primary-500" />
                            <h3 className="text-lg font-semibold text-slate-800">Upload CSV Data</h3>
                        </div>
                        <p className="text-sm text-slate-600 mb-4">
                            Start by uploading your CSV file. Each column will become a field you can place on the certificate.
                        </p>
                        <div className="space-y-4">
                            <FileUpload
                                accept={{ 'text/csv': ['.csv'] }}
                                onFileSelect={(file) => setCsvFile(file)}
                                label="Drop CSV file here"
                            />
                            {csvFile && (
                                <div className="space-y-3">
                                    <p className="text-sm text-slate-600">Selected: {csvFile.name}</p>
                                    <button onClick={handleCsvUpload} className="btn-primary w-full">
                                        Parse CSV
                                    </button>
                                </div>
                            )}
                        </div>
                        {csvData && (
                            <div className="mt-4">
                                <button onClick={() => setStep('template')} className="btn-primary w-full">
                                    Continue to Template Selection
                                </button>
                            </div>
                        )}
                    </div>

                    {csvData && (
                        <div className="card">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">
                                Data Preview ({csvData.totalRows} rows)
                            </h3>
                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-green-700 text-sm font-medium">
                                    ✓ {csvData.headers.length} fields detected from CSV columns
                                </p>
                                <p className="text-green-600 text-xs mt-1">
                                    Fields: {csvData.headers.join(', ')}
                                </p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-100">
                                            {csvData.headers.map(h => (
                                                <th key={h} className="px-3 py-2 text-left font-medium text-slate-700">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {csvData.preview.slice(0, 5).map((row, i) => (
                                            <tr key={i} className="border-b border-slate-200">
                                                {csvData.headers.map(h => (
                                                    <td key={h} className="px-3 py-2 text-slate-600">
                                                        {row[h] || row[h.toLowerCase()]}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* STEP 2: Template Selection */}
            {step === 'template' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Upload New */}
                    <div className="card">
                        <div className="flex items-center gap-2 mb-4">
                            <Upload className="w-5 h-5 text-primary-500" />
                            <h3 className="text-lg font-semibold text-slate-800">Upload New Template</h3>
                        </div>
                        <div className="space-y-4">
                            <FileUpload
                                accept={{ 'application/pdf': ['.pdf'] }}
                                onFileSelect={(file) => setTemplateFile(file)}
                                label="Drop PDF template here"
                            />
                            {templateFile && (
                                <div className="space-y-3">
                                    <p className="text-sm text-slate-600">Selected: {templateFile.name}</p>
                                    <input
                                        type="text"
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value)}
                                        placeholder="Template name (optional)"
                                        className="input w-full"
                                    />
                                    <button onClick={handleUploadTemplate} className="btn-primary w-full">
                                        Upload Template
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="mt-4">
                            <button onClick={() => setStep('csv')} className="btn-outline w-full">
                                Back to CSV
                            </button>
                        </div>
                    </div>

                    {/* Existing Templates */}
                    <div className="card">
                        <div className="flex items-center gap-2 mb-4">
                            <FolderOpen className="w-5 h-5 text-primary-500" />
                            <h3 className="text-lg font-semibold text-slate-800">Existing Templates</h3>
                        </div>
                        {templates.length === 0 ? (
                            <p className="text-slate-500 text-center py-8">No templates yet. Upload one to get started.</p>
                        ) : (
                            <div className="space-y-3 max-h-80 overflow-y-auto">
                                {templates.map((template) => (
                                    <button
                                        key={template.id}
                                        onClick={() => handleSelectTemplate(template)}
                                        className="w-full p-4 bg-slate-100 hover:bg-slate-200 rounded-lg text-left transition-colors flex items-center justify-between group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                                                <FileText className="w-5 h-5 text-primary-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-800">{template.name}</p>
                                                <p className="text-xs text-slate-500">
                                                    Click to use this template
                                                </p>
                                            </div>
                                        </div>
                                        <Play className="w-5 h-5 text-slate-500 group-hover:text-primary-600 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* STEP 3: Field Positioning */}
            {step === 'fields' && selectedTemplate && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* PDF Viewer with Overlay */}
                    <div className="xl:col-span-2 card">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">Position Fields on Template</h3>
                            <div className="flex gap-2">
                                <button onClick={() => setStep('template')} className="btn-outline text-sm">
                                    Back
                                </button>
                                <button onClick={saveFieldConfigs} className="btn-primary text-sm">
                                    Save & Generate
                                </button>
                            </div>
                        </div>

                        {/* Two-Layer Container */}
                        <div className="relative border border-slate-300 rounded-lg overflow-hidden bg-slate-100" style={{ height: '600px' }}>
                            {/* Layer 1: PDF Viewer (bottom) */}
                            {isLoadingPdf ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                                    <div className="text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto mb-2" />
                                        <p className="text-sm text-slate-500">Rendering PDF Preview...</p>
                                    </div>
                                </div>
                            ) : pdfImage ? (
                                <img
                                    src={pdfImage}
                                    alt="Certificate Template"
                                    className="absolute inset-0 w-full h-full object-contain"
                                    style={{ zIndex: 1 }}
                                />
                            ) : null}

                            {/* Layer 2: Transparent Overlay for Dragging (top) */}
                            <div
                                ref={overlayRef}
                                className="absolute inset-0"
                                style={{
                                    zIndex: 10,
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                    pointerEvents: 'none',
                                }}
                            >
                                {/* Draggable Fields */}
                                {visibleFields.map(config => (
                                    <div key={config.id} style={{ pointerEvents: 'auto' }}>
                                        <DraggableField
                                            config={config}
                                            isSelected={selectedField === config.id}
                                            onSelect={() => setSelectedField(config.id)}
                                            onDrag={(x, y) => updateField(config.id, { x, y })}
                                            containerRef={overlayRef}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Help text */}
                            <div className="absolute bottom-4 left-4 z-20 bg-white/90 px-3 py-2 rounded-lg shadow text-sm text-slate-600">
                                <Move className="w-4 h-4 inline mr-2" />
                                Drag fields to position them on the certificate
                            </div>
                        </div>
                    </div>

                    {/* Field Controls - REDESIGNED */}
                    <div className="card">
                        {/* Available Fields (from CSV) */}
                        <div className="mb-6">
                            <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                <Database className="w-4 h-4" />
                                Available Fields (from CSV)
                            </h4>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {availableFields.length === 0 ? (
                                    <p className="text-slate-500 text-sm text-center py-2">
                                        All fields are on the canvas
                                    </p>
                                ) : (
                                    availableFields.map(config => (
                                        <div
                                            key={config.id}
                                            className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
                                        >
                                            <span className="text-sm text-slate-700">{config.field}</span>
                                            <button
                                                onClick={() => addFieldToCanvas(config.id)}
                                                className="btn-secondary text-xs px-2 py-1 flex items-center gap-1"
                                            >
                                                <Plus className="w-3 h-3" />
                                                Add
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Fields on Canvas */}
                        <div className="mb-6">
                            <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                <Type className="w-4 h-4" />
                                Fields on Canvas ({visibleFields.length})
                            </h4>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {visibleFields.length === 0 ? (
                                    <p className="text-slate-500 text-sm text-center py-2">
                                        Click "Add" above to place fields
                                    </p>
                                ) : (
                                    visibleFields.map(config => (
                                        <div
                                            key={config.id}
                                            onClick={() => setSelectedField(config.id)}
                                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${selectedField === config.id
                                                ? 'bg-primary-100 border-2 border-primary-500'
                                                : 'bg-slate-100 hover:bg-slate-200 border-2 border-transparent'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Check className="w-4 h-4 text-green-500" />
                                                <span className="font-medium text-slate-700">{`{{${config.field}}}`}</span>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeFieldFromCanvas(config.id); }}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Field Properties */}
                        {selectedFieldConfig && selectedFieldConfig.isVisible && (
                            <div className="space-y-4 border-t border-slate-200 pt-4">
                                <h4 className="font-medium text-slate-700">Field Properties: {selectedFieldConfig.field}</h4>

                                {/* Position */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1">X</label>
                                        <input
                                            type="number"
                                            value={selectedFieldConfig.x}
                                            onChange={(e) => updateField(selectedFieldConfig.id, { x: parseInt(e.target.value) || 0 })}
                                            className="input w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1">Y</label>
                                        <input
                                            type="number"
                                            value={selectedFieldConfig.y}
                                            onChange={(e) => updateField(selectedFieldConfig.id, { y: parseInt(e.target.value) || 0 })}
                                            className="input w-full"
                                        />
                                    </div>
                                </div>

                                {/* Font Size */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">
                                        Font Size: {selectedFieldConfig.fontSize}px
                                    </label>
                                    <input
                                        type="range"
                                        min="8"
                                        max="72"
                                        value={selectedFieldConfig.fontSize}
                                        onChange={(e) => updateField(selectedFieldConfig.id, { fontSize: parseInt(e.target.value) })}
                                        className="w-full"
                                    />
                                </div>

                                {/* Font Family */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Font</label>
                                    <select
                                        value={selectedFieldConfig.fontFamily}
                                        onChange={(e) => updateField(selectedFieldConfig.id, { fontFamily: e.target.value as FieldConfig['fontFamily'] })}
                                        className="input w-full"
                                    >
                                        {FONT_FAMILIES.map(f => (
                                            <option key={f.value} value={f.value}>{f.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Font Style (Bold / Italic) */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Style</label>
                                    <div className="flex gap-2">
                                        {/* Bold Toggle */}
                                        <button
                                            onClick={() => {
                                                const current = selectedFieldConfig.fontWeight;
                                                let next: FieldConfig['fontWeight'] = 'normal';

                                                if (current === 'normal') next = 'bold';
                                                else if (current === 'italic') next = 'boldItalic';
                                                else if (current === 'bold') next = 'normal';
                                                else if (current === 'boldItalic') next = 'italic';

                                                updateField(selectedFieldConfig.id, { fontWeight: next });
                                            }}
                                            className={`flex-1 p-2 rounded flex items-center justify-center gap-2 ${selectedFieldConfig.fontWeight === 'bold' || selectedFieldConfig.fontWeight === 'boldItalic'
                                                ? 'bg-primary-500 text-white'
                                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                                }`}
                                        >
                                            <Bold className="w-4 h-4" />
                                            Bold
                                        </button>

                                        {/* Italic Toggle */}
                                        <button
                                            onClick={() => {
                                                const current = selectedFieldConfig.fontWeight;
                                                let next: FieldConfig['fontWeight'] = 'normal';

                                                if (current === 'normal') next = 'italic';
                                                else if (current === 'bold') next = 'boldItalic';
                                                else if (current === 'italic') next = 'normal';
                                                else if (current === 'boldItalic') next = 'bold';

                                                updateField(selectedFieldConfig.id, { fontWeight: next });
                                            }}
                                            className={`flex-1 p-2 rounded flex items-center justify-center gap-2 ${selectedFieldConfig.fontWeight === 'italic' || selectedFieldConfig.fontWeight === 'boldItalic'
                                                ? 'bg-primary-500 text-white'
                                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                                }`}
                                        >
                                            <Italic className="w-4 h-4" />
                                            Italic
                                        </button>
                                    </div>
                                </div>

                                {/* Color */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">
                                        <Palette className="w-4 h-4 inline mr-1" />
                                        Color
                                    </label>
                                    <input
                                        type="color"
                                        value={selectedFieldConfig.color}
                                        onChange={(e) => updateField(selectedFieldConfig.id, { color: e.target.value })}
                                        className="w-full h-10 rounded cursor-pointer"
                                    />
                                </div>

                                {/* Alignment */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Alignment</label>
                                    <div className="flex gap-2">
                                        {[
                                            { value: 'left', icon: AlignLeft },
                                            { value: 'center', icon: AlignCenter },
                                            { value: 'right', icon: AlignRight },
                                        ].map(({ value, icon: Icon }) => (
                                            <button
                                                key={value}
                                                onClick={() => updateField(selectedFieldConfig.id, { alignment: value as FieldConfig['alignment'] })}
                                                className={`flex-1 p-2 rounded ${selectedFieldConfig.alignment === value
                                                    ? 'bg-primary-500 text-white'
                                                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                                    }`}
                                            >
                                                <Icon className="w-4 h-4 mx-auto" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* STEP 4: Generate */}
            {step === 'generate' && (
                <div className="card max-w-2xl mx-auto">
                    {/* Completion State */}
                    {generationComplete ? (
                        <div className="text-center py-8">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle className="w-12 h-12 text-green-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-2">
                                Generation Complete!
                            </h3>
                            <p className="text-slate-600 mb-6">
                                Successfully generated {csvData?.totalRows} certificates
                            </p>

                            <div className="p-4 bg-slate-50 rounded-lg mb-6 text-left">
                                <div className="flex items-center gap-2 mb-2">
                                    <FolderOutput className="w-5 h-5 text-primary-500" />
                                    <span className="font-medium text-slate-700">Output Location:</span>
                                </div>
                                <p className="text-sm text-slate-600 bg-white p-2 rounded border font-mono">
                                    {outputPath}
                                </p>
                            </div>

                            <button
                                onClick={resetAndStartNew}
                                className="btn-primary flex items-center justify-center gap-2 mx-auto"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Generate New Batch
                            </button>
                        </div>
                    ) : isGenerating ? (
                        /* Progress State */
                        <div className="py-8">
                            <div className="text-center mb-6">
                                <Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-slate-800">
                                    Generating Certificates...
                                </h3>
                                <p className="text-slate-600 mt-1">
                                    Please wait while your certificates are being created
                                </p>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-4">
                                <div className="flex justify-between text-sm text-slate-600 mb-2">
                                    <span>Progress</span>
                                    <span>{generatedCount} / {csvData?.totalRows}</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-primary-400 to-primary-600 h-full rounded-full transition-all duration-300 ease-out"
                                        style={{ width: `${generationProgress}%` }}
                                    />
                                </div>
                                <p className="text-center text-sm text-slate-500 mt-2">
                                    {generationProgress}% complete
                                </p>
                            </div>
                        </div>
                    ) : (
                        /* Configuration State */
                        <>
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">Generate Certificates</h3>

                            {/* Summary */}
                            <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                                <h4 className="font-medium text-slate-700 mb-2">Summary</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-slate-500">Template:</p>
                                        <p className="font-medium">{selectedTemplate?.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Records:</p>
                                        <p className="font-medium">{csvData?.totalRows} certificates</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-slate-500">Fields to place:</p>
                                        <p className="font-medium">{visibleFields.map(f => f.field).join(', ') || 'None'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">
                                        Output Folder Path
                                    </label>
                                    <input
                                        type="text"
                                        value={outputPath}
                                        onChange={(e) => setOutputPath(e.target.value)}
                                        placeholder="e.g., C:\Certificates or ./output"
                                        className="input w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">
                                        File Naming Pattern
                                    </label>
                                    <input
                                        type="text"
                                        value={namingPattern}
                                        onChange={(e) => setNamingPattern(e.target.value)}
                                        placeholder="e.g., {{sn}}_{{name}}"
                                        className="input w-full"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        Use field names in {'{{curly braces}}'} like: {'{{sn}}_{{name}}_certificate'}
                                    </p>
                                </div>
                                <div className="flex gap-2 pt-4">
                                    <button onClick={() => setStep('fields')} className="btn-outline flex-1">
                                        Back
                                    </button>
                                    <button
                                        onClick={handleGenerate}
                                        disabled={!outputPath}
                                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                                    >
                                        <Play className="w-4 h-4" />
                                        Generate Certificates
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
