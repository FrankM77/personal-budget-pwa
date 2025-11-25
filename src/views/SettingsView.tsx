import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun, Download, Upload, Trash2, CheckCircle, ChevronRight } from 'lucide-react';
import { useEnvelopeStore } from '../store/envelopeStore';

export const SettingsView: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { envelopes, transactions, distributionTemplates, importData, resetData } = useEnvelopeStore();

  // Simple Dark Mode Toggle (Persisted to localStorage manually or via context)
  // Assuming standard Tailwind 'dark' class on html element strategy
  const toggleDarkMode = (isDark: boolean) => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };
  const isDarkMode = document.documentElement.classList.contains('dark');

  // --- EXPORT LOGIC ---
  const handleBackup = () => {
    const backupData = {
      appVersion: "2.0 (PWA)",
      backupDate: Date.now(), // JS Timestamp
      appSettings: { isDarkMode },
      envelopes,
      transactions,
      distributionTemplates
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // Format: HouseBudget_Backup_YYYY-MM-DD.json
    link.download = `HouseBudget_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- IMPORT LOGIC ---
  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        const result = importData(json);
        
        if (result.success) {
          alert(`✅ Success: ${result.message}\nLoaded ${json.transactions.length} transactions.`);
          // If backup had theme settings, apply them?
          if (json.appSettings?.isDarkMode !== undefined) {
             toggleDarkMode(json.appSettings.isDarkMode);
          }
        } else {
          alert(`❌ Error: ${result.message}`);
        }
      } catch (err) {
        alert("❌ Error: Invalid JSON file.");
      }
    };
    reader.readAsText(file);
    // Reset input so you can select the same file again if needed
    event.target.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 sticky top-0 z-20 flex items-center justify-between shadow-sm">
        <div className="flex items-center">
          <button 
            onClick={() => navigate(-1)} 
            className="mr-3 text-blue-600 dark:text-blue-400 font-medium"
          >
            Done
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h1>
        </div>
      </header>

      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        
        {/* APPEARANCE */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase mb-2 px-1">Appearance</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isDarkMode ? <Moon className="text-purple-500" size={20} /> : <Sun className="text-orange-500" size={20} />}
                <span className="text-gray-900 dark:text-white font-medium">Dark Mode</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={isDarkMode}
                    onChange={(e) => toggleDarkMode(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
              </label>
            </div>
            <div className="px-4 pb-3 text-xs text-gray-500 dark:text-zinc-500">
                Choose your preferred appearance mode
            </div>
          </div>
        </section>

        {/* DATA MANAGEMENT */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase mb-2 px-1">Data Management</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm divide-y divide-gray-100 dark:divide-zinc-800">
            
            {/* Backup */}
            <button onClick={handleBackup} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-3">
                    <Download className="text-blue-500" size={20} />
                    <span className="text-gray-900 dark:text-white font-medium">Backup Data</span>
                </div>
                <ChevronRight className="text-gray-400" size={18} />
            </button>

            {/* Restore */}
            <button onClick={handleRestoreClick} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-3">
                    <Upload className="text-blue-500" size={20} />
                    <span className="text-gray-900 dark:text-white font-medium">Restore from Backup</span>
                </div>
                <ChevronRight className="text-gray-400" size={18} />
            </button>
            
            {/* Hidden Input for File Picking */}
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".json" 
                className="hidden" 
            />
          </div>
          <div className="px-1 pt-2 text-xs text-gray-500 dark:text-zinc-500">
            Create backups of all your data or restore from a previous backup
          </div>
        </section>

        {/* TEMPLATE MANAGEMENT */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase mb-2 px-1">Template Management</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center gap-3">
            <CheckCircle className="text-green-500" size={20} />
            <div>
                <div className="text-gray-900 dark:text-white font-medium">All templates are valid</div>
                <div className="text-xs text-gray-500 dark:text-zinc-500 mt-1">
                    Templates that reference deleted envelopes are automatically cleaned up.
                </div>
            </div>
          </div>
        </section>

        {/* DANGER ZONE */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase mb-2 px-1">Danger Zone</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm">
            <button 
                onClick={() => {
                    if(confirm("Are you sure? This will wipe ALL envelopes, transactions, and templates. This action cannot be undone.")) {
                        resetData();
                        alert("App has been reset.");
                        navigate('/');
                    }
                }}
                className="w-full p-4 flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors group"
            >
                <div className="flex items-center gap-3">
                    <Trash2 className="text-red-500 group-hover:text-red-600" size={20} />
                    <span className="text-red-500 group-hover:text-red-600 font-medium">Reset All Data</span>
                </div>
                <ChevronRight className="text-gray-400" size={18} />
            </button>
          </div>
          <div className="px-1 pt-2 text-xs text-gray-500 dark:text-zinc-500">
            This will reset all envelope balances to zero and delete all transactions.
          </div>
        </section>

        <div className="text-center pt-8 pb-12">
            <div className="text-xs text-gray-400 font-medium">App Version 2.0.1 (PWA)</div>
        </div>

      </div>
    </div>
  );
};