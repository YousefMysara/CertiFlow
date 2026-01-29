interface ProgressBarProps {
    value: number;
    max?: number;
    label?: string;
    showPercentage?: boolean;
    size?: 'sm' | 'md' | 'lg';
    animated?: boolean;
    color?: 'primary' | 'success' | 'warning' | 'error';
}

export default function ProgressBar({
    value,
    max = 100,
    label,
    showPercentage = true,
    size = 'md',
    animated = true,
    color = 'primary',
}: ProgressBarProps) {
    const percentage = Math.min(Math.round((value / max) * 100), 100);

    const sizeClasses = {
        sm: 'h-1.5',
        md: 'h-2.5',
        lg: 'h-4',
    };

    const colorClasses = {
        primary: 'from-primary-500 to-accent-500',
        success: 'from-green-500 to-emerald-500',
        warning: 'from-yellow-500 to-orange-500',
        error: 'from-red-500 to-rose-500',
    };

    return (
        <div className="w-full">
            {(label || showPercentage) && (
                <div className="flex justify-between items-center mb-2">
                    {label && <span className="text-sm font-medium text-slate-300">{label}</span>}
                    {showPercentage && (
                        <span className="text-sm font-medium text-slate-500">{percentage}%</span>
                    )}
                </div>
            )}
            <div className={`w-full bg-slate-200 rounded-full overflow-hidden ${sizeClasses[size]}`}>
                <div
                    className={`h-full bg-gradient-to-r ${colorClasses[color]} rounded-full transition-all duration-300 ${animated && percentage < 100 ? 'progress-bar-animated' : ''
                        }`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}
