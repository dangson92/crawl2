import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, Pause, Plus, Trash2, Settings, Download, 
  Activity, Globe, Search, RefreshCw, X, ChevronRight, LayoutDashboard, Check, ChevronDown
} from 'lucide-react';
import { Task, TaskStatus, AppConfig, LogEntry, QueueStats, HotelData } from './types';
import LogConsole from './components/LogConsole';
import ResultModal from './components/ResultModal';
import { exportToExcel, exportToJSON } from './utils/excelGenerator';

const INITIAL_CONFIG: AppConfig = {
  concurrency: 2,
  delayPerLink: 2,
  batchWait: 10,
  batchWaitTime: 30,
  headless: false, // false = show browser, true = hide browser
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...'
};

export default function App() {
  // State
  const [queue, setQueue] = useState<Task[]>([]);
  const [config, setConfig] = useState<AppConfig>(INITIAL_CONFIG);
  const [isRunning, setIsRunning] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [activeTaskCount, setActiveTaskCount] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [globalLogs, setGlobalLogs] = useState<LogEntry[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [chromePath, setChromePath] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Refs for logic that runs in intervals/timeouts
  const queueRef = useRef(queue);
  const runningRef = useRef(isRunning);
  const configRef = useRef(config);
  const activeCountRef = useRef(0);

  // Sync refs
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { runningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { activeCountRef.current = activeTaskCount; }, [activeTaskCount]);

  // Find Chrome path on mount (only in Electron)
  useEffect(() => {
    if (window.isElectron && window.electron?.crawler) {
      window.electron.crawler.findChrome().then(result => {
        if (result.success && result.path) {
          setChromePath(result.path);
          addLog(`Chrome found: ${result.path}`, 'success');
        } else {
          addLog('Chrome not found. Will use bundled Chromium.', 'warning');
        }
      }).catch(err => {
        addLog(`Error finding Chrome: ${err.message}`, 'error');
      });

      // Setup crawler log listener
      const unsubscribe = window.electron.crawler.onCrawlerLog(({ taskId, message, type }) => {
        addLog(message, type as LogEntry['type'], taskId);
      });

      return () => unsubscribe();
    }
  }, []);

  // Load tasks from database on mount
  useEffect(() => {
    if (window.isElectron && window.electron?.db) {
      window.electron.db.getAllTasks().then(result => {
        if (result.success && result.data) {
          setQueue(result.data);
          addLog(`Loaded ${result.data.length} tasks from database`, 'info');
        }
      }).catch(err => {
        addLog(`Error loading tasks: ${err.message}`, 'error');
      });
    }
  }, []);

  // Auto-save tasks to database when queue changes
  useEffect(() => {
    if (window.isElectron && window.electron?.db && queue.length > 0) {
      // Debounce save to avoid too frequent writes
      const timeoutId = setTimeout(() => {
        queue.forEach(task => {
          window.electron.db.saveTask(task).catch(err => {
            console.error(`Error saving task ${task.id}:`, err);
          });
        });
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [queue]);

  // Logging Helper
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info', taskId?: string) => {
    const entry: LogEntry = { timestamp: Date.now(), message, type };
    
    // Update global logs
    setGlobalLogs(prev => [...prev.slice(-99), entry]);

    // Update specific task logs if taskId provided
    if (taskId) {
      setQueue(prev => prev.map(t => 
        t.id === taskId ? { ...t, logs: [...t.logs, entry] } : t
      ));
    }
  }, []);

  // Task Processor
  const processTask = useCallback(async (task: Task) => {
    // Set to processing
    setQueue(prev => prev.map(t => t.id === task.id ? { ...t, status: TaskStatus.PROCESSING } : t));
    setActiveTaskCount(prev => prev + 1);

    try {
      addLog(`Starting task ${task.id}`, 'info', task.id);

      let result: HotelData;

      // Check if running in Electron with crawler API
      if (window.isElectron && window.electron?.crawler) {
        // Use real crawler in Electron
        const response = await window.electron.crawler.crawlHotel(
          task.id,
          task.url,
          configRef.current.headless,
          chromePath
        );

        if (!response.success) {
          throw new Error(response.error || 'Crawl failed');
        }

        // Map crawler data to HotelData format
        const crawlerData = response.data;
        result = {
          name: crawlerData.name || 'Unknown Hotel',
          address: crawlerData.address || 'No address',
          rating: crawlerData.rating?.score || 0,
          images: crawlerData.images || [],
          // Store additional data
          facilities: crawlerData.facilities,
          faqs: crawlerData.faqs,
          about: crawlerData.about,
          reviewCount: crawlerData.rating?.reviewCount,
          ratingCategory: crawlerData.rating?.category,
          houseRules: crawlerData.houseRules,
          // Location data
          cityName: crawlerData.cityName,
          regionName: crawlerData.regionName,
          countryName: crawlerData.countryName,
        };
      } else {
        // Fallback: not in Electron or crawler not available
        throw new Error('Crawler not available. Please run in Electron app.');
      }

      setQueue(prev => prev.map(t =>
        t.id === task.id
          ? {
              ...t,
              status: TaskStatus.COMPLETED,
              result,
              progress: 100,
              finishedAt: Date.now()
            }
          : t
      ));
      addLog(`Task ${task.id} finished successfully.`, 'success', task.id);

    } catch (err: any) {
      setQueue(prev => prev.map(t =>
        t.id === task.id
          ? {
              ...t,
              status: TaskStatus.ERROR,
              error: err.message,
              finishedAt: Date.now()
            }
          : t
      ));
      addLog(`Task ${task.id} failed: ${err.message}`, 'error', task.id);
    } finally {
      setActiveTaskCount(prev => prev - 1);

      // Delay before slot frees up logically (simulating cleanup)
      setTimeout(() => {
        // Trigger next loop check
        checkQueue();
      }, configRef.current.delayPerLink * 1000);
    }
  }, [addLog, chromePath]);

  // Queue Checker Loop
  const checkQueue = useCallback(() => {
    if (!runningRef.current) return;
    
    const currentQueue = queueRef.current;
    const processing = currentQueue.filter(t => t.status === TaskStatus.PROCESSING).length;
    const limit = configRef.current.concurrency;

    if (processing < limit) {
      const nextTask = currentQueue.find(t => t.status === TaskStatus.WAITING);
      if (nextTask) {
        processTask(nextTask);
      } else if (processing === 0 && currentQueue.every(t => t.status !== TaskStatus.WAITING)) {
        setIsRunning(false);
        addLog("Queue processing finished.", 'success');
      }
    }
  }, [processTask, addLog]);

  // Watcher for queue/running changes to trigger check
  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(checkQueue, 1000);
      return () => clearInterval(interval);
    }
  }, [isRunning, checkQueue]);


  // Actions
  const handleAddLinks = () => {
    if (!urlInput.trim()) return;
    const urls = urlInput.split('\n').filter(u => u.trim().length > 0);
    const newTasks: Task[] = urls.map(url => ({
      id: Math.random().toString(36).substr(2, 9),
      url: url.trim(),
      status: TaskStatus.WAITING,
      progress: 0,
      logs: [],
      createdAt: Date.now()
    }));
    
    setQueue(prev => [...prev, ...newTasks]);
    setUrlInput('');
    addLog(`Added ${newTasks.length} links to queue.`, 'info');
  };

  const handleClearQueue = () => {
    if (isRunning) return;

    // Clear from database
    if (window.isElectron && window.electron?.db) {
      window.electron.db.deleteAllTasks().then(() => {
        addLog('All tasks cleared from database', 'info');
      }).catch(err => {
        addLog(`Error clearing database: ${err.message}`, 'error');
      });
    }

    setQueue([]);
    setGlobalLogs([]);
  };

  const handleExport = () => {
    exportToExcel(queue);
  };

  const handleExportJSON = () => {
    exportToJSON(queue);
  };

  const handleDeleteTask = (taskId: string) => {
    // Delete from database
    if (window.isElectron && window.electron?.db) {
      window.electron.db.deleteTask(taskId).catch(err => {
        addLog(`Error deleting task: ${err.message}`, 'error');
      });
    }

    // Remove from queue
    setQueue(prev => prev.filter(t => t.id !== taskId));
    setSelectedTaskIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(taskId);
      return newSet;
    });
    addLog('Task deleted', 'info');
  };

  const handleResetTask = (taskId: string) => {
    setQueue(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, status: TaskStatus.WAITING, progress: 0, error: undefined, result: undefined, finishedAt: undefined }
        : t
    ));
    addLog('Task reset to WAITING', 'info');
  };

  const handleBulkDelete = () => {
    if (selectedTaskIds.size === 0) return;

    // Delete from database
    if (window.isElectron && window.electron?.db) {
      selectedTaskIds.forEach(taskId => {
        window.electron.db.deleteTask(taskId).catch(err => {
          addLog(`Error deleting task ${taskId}: ${err.message}`, 'error');
        });
      });
    }

    // Remove from queue
    setQueue(prev => prev.filter(t => !selectedTaskIds.has(t.id)));
    addLog(`Deleted ${selectedTaskIds.size} tasks`, 'info');
    setSelectedTaskIds(new Set());
  };

  const handleBulkReset = () => {
    if (selectedTaskIds.size === 0) return;

    setQueue(prev => prev.map(t =>
      selectedTaskIds.has(t.id)
        ? { ...t, status: TaskStatus.WAITING, progress: 0, error: undefined, result: undefined, finishedAt: undefined }
        : t
    ));
    addLog(`Reset ${selectedTaskIds.size} tasks to WAITING`, 'info');
    setSelectedTaskIds(new Set());
  };

  const handleToggleSelectAll = () => {
    if (selectedTaskIds.size === queue.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(queue.map(t => t.id)));
    }
  };

  const handleToggleSelect = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  // Stats
  const stats: QueueStats = {
    total: queue.length,
    waiting: queue.filter(t => t.status === TaskStatus.WAITING).length,
    processing: queue.filter(t => t.status === TaskStatus.PROCESSING).length,
    completed: queue.filter(t => t.status === TaskStatus.COMPLETED).length,
    error: queue.filter(t => t.status === TaskStatus.ERROR).length,
  };

  return (
    <div className="flex h-screen w-screen bg-gray-50 text-gray-900 overflow-hidden font-sans selection:bg-blue-200">
      
      {/* Sidebar / Config Panel */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col shrink-0 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] z-20">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 tracking-tight">
              <Globe size={22} className="text-blue-600" />
              Hotel<span className="text-blue-600">Crawler</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1 font-medium">Electron Bot Manager</p>
          </div>
        </div>

        {/* Scrollable Control Area - Fixed Height Limit */}
        <div className="p-5 space-y-6 overflow-y-auto shrink-0 max-h-[70vh] custom-scrollbar">
          
          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => {
                setIsRunning(!isRunning);
                if (!isRunning) addLog("Started queue processing.", 'info');
                else addLog("Paused queue processing.", 'warning');
              }}
              className={`group w-full flex items-center justify-center gap-2 p-3.5 rounded-xl font-bold transition-all shadow-md active:scale-95 ${
                isRunning
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-transparent shadow-amber-100'
                  : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg shadow-blue-200 hover:-translate-y-0.5'
              }`}
            >
              {isRunning ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current" />}
              {isRunning ? 'Pause' : 'Start'}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleExport}
                disabled={stats.completed === 0}
                className="group flex items-center justify-center gap-2 p-3.5 bg-white text-gray-600 hover:text-green-600 border border-gray-200 hover:border-green-200 rounded-xl font-semibold shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <Download size={18} className="group-hover:animate-bounce" /> Excel
              </button>
              <button
                onClick={handleExportJSON}
                disabled={stats.completed === 0}
                className="group flex items-center justify-center gap-2 p-3.5 bg-white text-gray-600 hover:text-blue-600 border border-gray-200 hover:border-blue-200 rounded-xl font-semibold shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <Download size={18} className="group-hover:animate-bounce" /> JSON
              </button>
            </div>
          </div>

          {/* Configuration */}
          <div className="space-y-4">
            <button 
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center justify-between w-full text-xs font-bold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings size={14} /> Configuration
              </div>
              {showConfig ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            
            {showConfig && (
              <div className="space-y-4 bg-gray-50/80 p-4 rounded-2xl border border-gray-100 animate-in fade-in slide-in-from-top-2 duration-200">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1.5 ml-1">Concurrency (Threads)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      min="1" 
                      max="10"
                      value={config.concurrency}
                      onChange={e => setConfig({...config, concurrency: parseInt(e.target.value) || 1})}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1.5 ml-1">Delay per Link (sec)</label>
                  <input 
                    type="number" 
                    min="0"
                    value={config.delayPerLink}
                    onChange={e => setConfig({...config, delayPerLink: parseInt(e.target.value) || 0})}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1.5 ml-1">Batch Wait Strategy</label>
                  <div className="flex gap-2">
                    <div className="relative w-1/2">
                      <input 
                        type="number" 
                        placeholder="N"
                        value={config.batchWait}
                        onChange={e => setConfig({...config, batchWait: parseInt(e.target.value) || 0})}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                      />
                      <span className="absolute right-2 top-2.5 text-[10px] text-gray-400 font-bold">LINKS</span>
                    </div>
                    <div className="relative w-1/2">
                      <input 
                        type="number" 
                        placeholder="S"
                        value={config.batchWaitTime}
                        onChange={e => setConfig({...config, batchWaitTime: parseInt(e.target.value) || 0})}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                      />
                      <span className="absolute right-2 top-2.5 text-[10px] text-gray-400 font-bold">SEC</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 px-1">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Hide Browser</span>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {config.headless ? 'Browser hidden (headless)' : 'Browser visible'}
                    </p>
                  </div>
                  <button
                    onClick={() => setConfig({...config, headless: !config.headless})}
                    className={`w-11 h-6 rounded-full relative transition-all shadow-inner ${config.headless ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${config.headless ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stats Widget */}
          <div className="bg-white rounded-2xl p-4 space-y-3 border border-gray-100 shadow-sm">
             <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <LayoutDashboard size={14} /> Queue Stats
             </div>
             <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 flex flex-col items-center">
                    <span className="text-xs text-gray-400 font-semibold uppercase">Waiting</span>
                    <span className="text-xl font-bold text-gray-700">{stats.waiting}</span>
                </div>
                <div className="bg-blue-50 p-2 rounded-lg border border-blue-100 flex flex-col items-center">
                    <span className="text-xs text-blue-400 font-semibold uppercase">Running</span>
                    <span className="text-xl font-bold text-blue-600">{stats.processing}</span>
                </div>
                <div className="bg-green-50 p-2 rounded-lg border border-green-100 flex flex-col items-center">
                    <span className="text-xs text-green-500 font-semibold uppercase">Done</span>
                    <span className="text-xl font-bold text-green-600">{stats.completed}</span>
                </div>
                <div className="bg-red-50 p-2 rounded-lg border border-red-100 flex flex-col items-center">
                    <span className="text-xs text-red-400 font-semibold uppercase">Errors</span>
                    <span className="text-xl font-bold text-red-600">{stats.error}</span>
                </div>
             </div>
             <div className="pt-2">
               <div className="h-2 w-full bg-gray-100 rounded-full mt-1 overflow-hidden">
                 <div 
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-700 ease-out" 
                    style={{ width: `${stats.total > 0 ? ((stats.completed + stats.error) / stats.total) * 100 : 0}%` }}
                 />
               </div>
             </div>
          </div>

        </div>

        {/* Global Log View (Flexible Height) */}
        <div className="flex-1 border-t border-gray-200 p-4 bg-gray-50 min-h-0 flex flex-col">
          <LogConsole logs={globalLogs} title="System Console" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full bg-gray-50 relative">
        
        {/* Top Bar: Input */}
        <div className="p-6 bg-white border-b border-gray-200 shadow-sm z-10">
           <div className="flex gap-4">
             <div className="relative flex-1 group">
               <div className="absolute top-3.5 left-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors">
                 <Search size={18} />
               </div>
               <textarea
                 value={urlInput}
                 onChange={(e) => setUrlInput(e.target.value)}
                 placeholder="Paste Booking.com links here (one per line)..."
                 className="w-full bg-gray-50 hover:bg-white border border-gray-200 group-hover:border-blue-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none resize-none h-24 leading-relaxed font-mono transition-all shadow-inner"
               />
             </div>
             <div className="flex flex-col gap-2 w-36">
               <button 
                onClick={handleAddLinks}
                className="flex-1 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg shadow-blue-200 active:scale-95 flex items-center justify-center gap-2"
               >
                 <Plus size={18} /> Add
               </button>
               <button
                onClick={handleClearQueue}
                disabled={isRunning}
                className="px-4 py-2.5 bg-white hover:bg-red-50 text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
               >
                 <Trash2 size={14} /> Clear All
               </button>
               {selectedTaskIds.size > 0 && (
                 <>
                   <button
                     onClick={handleBulkReset}
                     disabled={isRunning}
                     className="px-4 py-2.5 bg-white hover:bg-yellow-50 text-gray-500 hover:text-yellow-600 border border-gray-200 hover:border-yellow-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                   >
                     <RefreshCw size={14} /> Reset ({selectedTaskIds.size})
                   </button>
                   <button
                     onClick={handleBulkDelete}
                     disabled={isRunning}
                     className="px-4 py-2.5 bg-white hover:bg-red-50 text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                   >
                     <Trash2 size={14} /> Delete ({selectedTaskIds.size})
                   </button>
                 </>
               )}
             </div>
           </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto p-6">
          {queue.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                <div className="p-6 bg-white rounded-full shadow-sm border border-gray-100">
                    <Activity size={48} className="text-gray-300" />
                </div>
                <p className="font-medium text-gray-500">Queue is empty. Add links to start.</p>
             </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="p-4 w-12">
                      <input
                        type="checkbox"
                        checked={selectedTaskIds.size === queue.length && queue.length > 0}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="p-4 w-20 text-center">ID</th>
                    <th className="p-4">URL</th>
                    <th className="p-4 w-36">Status</th>
                    <th className="p-4 w-48">Progress</th>
                    <th className="p-4 w-32 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {queue.map(task => (
                    <tr key={task.id} className="hover:bg-blue-50/50 transition-colors group">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedTaskIds.has(task.id)}
                          onChange={() => handleToggleSelect(task.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-4 text-center text-gray-400 font-mono text-xs font-semibold">{task.id}</td>
                      <td className="p-4">
                        <div className="truncate max-w-md text-gray-700 font-medium" title={task.url}>
                          {task.url}
                        </div>
                        {task.error && <div className="text-xs text-red-500 mt-1 font-medium bg-red-50 inline-block px-2 py-0.5 rounded">{task.error}</div>}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border
                          ${task.status === TaskStatus.WAITING ? 'bg-gray-100 text-gray-500 border-gray-200' : ''}
                          ${task.status === TaskStatus.PROCESSING ? 'bg-blue-100 text-blue-700 border-blue-200' : ''}
                          ${task.status === TaskStatus.COMPLETED ? 'bg-green-100 text-green-700 border-green-200' : ''}
                          ${task.status === TaskStatus.ERROR ? 'bg-red-100 text-red-700 border-red-200' : ''}
                        `}>
                          {task.status === TaskStatus.PROCESSING && <RefreshCw size={10} className="mr-1.5 animate-spin" />}
                          {task.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {task.status === TaskStatus.PROCESSING && (
                          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                             <div className="h-full bg-blue-500 animate-pulse w-2/3 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                          </div>
                        )}
                        {task.status === TaskStatus.COMPLETED && (
                           <div className="text-xs font-medium text-gray-500 flex items-center gap-1">
                             <Check size={12} className="text-green-500" />
                             Done in {((task.finishedAt! - task.createdAt) / 1000).toFixed(1)}s
                           </div>
                        )}
                        {task.status === TaskStatus.IDLE && <span className="text-gray-300">-</span>}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          {task.result && (
                            <button
                              onClick={() => setSelectedTask(task)}
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-semibold bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-all"
                              title="View Details"
                            >
                              <Search size={14} />
                            </button>
                          )}
                          {(task.status === TaskStatus.COMPLETED || task.status === TaskStatus.ERROR) && (
                            <button
                              onClick={() => handleResetTask(task.id)}
                              className="flex items-center gap-1 text-yellow-600 hover:text-yellow-800 text-xs font-semibold bg-yellow-50 hover:bg-yellow-100 px-2.5 py-1.5 rounded-lg transition-all"
                              title="Reset to Waiting"
                            >
                              <RefreshCw size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="flex items-center gap-1 text-red-600 hover:text-red-800 text-xs font-semibold bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-all"
                            title="Delete Task"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedTask && (
        selectedTask.status === TaskStatus.COMPLETED ? (
          <ResultModal task={selectedTask} onClose={() => setSelectedTask(null)} />
        ) : (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/30 backdrop-blur-sm p-4">
             <div className="bg-white w-full max-w-2xl h-[60vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-black/5">
               <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Activity size={16} className="text-blue-500" />
                    Live Logs: <span className="font-mono text-gray-500">{selectedTask.id}</span>
                  </h3>
                  <button onClick={() => setSelectedTask(null)} className="p-1 hover:bg-gray-100 rounded-full"><X size={18} className="text-gray-400" /></button>
               </div>
               <div className="flex-1 bg-gray-50 p-3 overflow-hidden">
                  <LogConsole logs={selectedTask.logs} title={`Task Execution Log`} />
               </div>
             </div>
          </div>
        )
      )}
    </div>
  );
}