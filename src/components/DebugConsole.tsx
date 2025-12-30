import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X, Minimize2, Maximize2, Trash2 } from 'lucide-react';

export interface LogEntry {
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'success';
    message: string;
    details?: any;
}

// Global logger to intercept console methods or be called directly
export const logger = {
    listeners: [] as ((entry: LogEntry) => void)[],

    emit(level: LogEntry['level'], message: string, details?: any) {
        const entry: LogEntry = {
            timestamp: Date.now(),
            level,
            message,
            details
        };
        this.listeners.forEach(l => l(entry));

        // Also log to browser console for redundancy
        const consoleArgs = [message, details].filter(Boolean);
        if (level === 'error') console.error('[APP]', ...consoleArgs);
        else if (level === 'warn') console.warn('[APP]', ...consoleArgs);
        else console.log('[APP]', ...consoleArgs);
    },

    info(msg: string, details?: any) { this.emit('info', msg, details); },
    warn(msg: string, details?: any) { this.emit('warn', msg, details); },
    error(msg: string, details?: any) { this.emit('error', msg, details); },
    success(msg: string, details?: any) { this.emit('success', msg, details); },

    subscribe(listener: (entry: LogEntry) => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
};

const DebugConsole: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Scroll to bottom on new logs
        if (isOpen && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, isOpen]);

    useEffect(() => {
        return logger.subscribe((entry) => {
            setLogs(prev => [...prev.slice(-99), entry]); // Keep last 100 logs
        });
    }, []);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 left-4 z-50 bg-black/80 text-green-400 p-2 rounded-full border border-green-900/50 hover:bg-black transition-all shadow-lg backdrop-blur-sm"
                title="Open Debug Console"
            >
                <Terminal size={16} />
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 left-4 z-50 w-full max-w-lg bg-black/90 border border-brand-800 rounded-lg shadow-2xl backdrop-blur-md flex flex-col overflow-hidden text-xs font-mono">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-brand-900/50 border-b border-brand-800">
                <div className="flex items-center gap-2 text-brand-100">
                    <Terminal size={12} />
                    <span className="font-semibold">System Logs</span>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setLogs([])} className="p-1 hover:bg-white/10 rounded text-brand-300 hover:text-red-400 transition-colors">
                        <Trash2 size={12} />
                    </button>
                    <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded text-brand-300 hover:text-white transition-colors">
                        <Minimize2 size={12} />
                    </button>
                </div>
            </div>

            {/* Logs Area */}
            <div
                ref={scrollRef}
                className="h-64 overflow-y-auto p-3 space-y-1.5 scrollbar-thin scrollbar-thumb-brand-700 scrollbar-track-transparent"
            >
                {logs.length === 0 && (
                    <div className="text-brand-500 italic text-center mt-20">No logs yet...</div>
                )}
                {logs.map((log, i) => (
                    <div key={`${log.timestamp}-${i}`} className="flex gap-2 items-start animate-fade-in">
                        <span className="text-brand-500 shrink-0">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <div className={`break-words ${log.level === 'error' ? 'text-red-400' :
                                log.level === 'warn' ? 'text-yellow-400' :
                                    log.level === 'success' ? 'text-green-400' :
                                        'text-blue-300'
                            }`}>
                            <span className="font-bold mr-1">[{log.level.toUpperCase()}]</span>
                            {log.message}
                            {log.details && (
                                <pre className="mt-0.5 ml-2 text-[10px] opacity-70 overflow-x-auto">
                                    {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                                </pre>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DebugConsole;
