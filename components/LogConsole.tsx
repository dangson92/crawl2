import React, { useRef, useEffect } from 'react';
import { LogEntry } from '../types';
import { Terminal, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

interface LogConsoleProps {
  logs: LogEntry[];
  title?: string;
  autoScroll?: boolean;
}

const LogConsole: React.FC<LogConsoleProps> = ({ logs, title = "System Logs", autoScroll = true }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'error': return <XCircle size={14} className="text-red-500" />;
      case 'success': return <CheckCircle size={14} className="text-green-500" />;
      case 'warning': return <AlertTriangle size={14} className="text-yellow-500" />;
      default: return <Info size={14} className="text-blue-500" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'error': return "text-red-400";
      case 'success': return "text-green-400";
      case 'warning': return "text-yellow-400";
      default: return "text-gray-300";
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const time = date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${time}.${ms}`;
  };

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2 text-gray-700 font-semibold">
          <Terminal size={14} className="text-gray-500" />
          <span>{title}</span>
        </div>
        <span className="text-gray-400 text-[10px] bg-gray-100 px-2 py-0.5 rounded-full">{logs.length} events</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1 bg-slate-900">
        {logs.length === 0 ? (
          <div className="text-slate-600 italic">Waiting for activity...</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className={`flex items-start gap-2 ${getColor(log.type)}`}>
              <span className="text-slate-600 shrink-0 mt-[2px] select-none">
                {formatTime(log.timestamp)}
              </span>
              <span className="shrink-0 mt-[2px]">{getIcon(log.type)}</span>
              <span className="break-all whitespace-pre-wrap font-medium">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LogConsole;