import React, { useMemo, useRef, useState, useEffect } from 'react';

import { useNavigate } from 'react-router-dom';
import { Download, Upload, Trash2, CheckCircle, ChevronRight, FileText, Loader, AlertTriangle, Sparkles } from 'lucide-react';
import { useBudgetStore } from '../stores/budgetStore';
import { useAuthStore } from '../stores/authStore';
import { budgetService, type CleanupReport } from '../services/budgetService';
import { migrateTransactions } from '../utils/migration';

export const SettingsView: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { envelopes, transactions, resetData, importData, getEnvelopeBalance, appSettings, updateAppSettings, initializeAppSettings, incomeSources, allocations, currentMonth } = useBudgetStore();

  const { deleteAccount, currentUser } = useAuthStore();
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastBackupDate, setLastBackupDate] = useState<string>(() => {
    return localStorage.getItem('lastBackupDate') || 'Never';
  });
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [operationResult, setOperationResult] = useState<{ success: boolean; message: string; onRetry?: () => void } | null>(null);
  const [isCleaningData, setIsCleaningData] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // Dummy usage to satisfy TypeScript linter (operationResult IS used in JSX)

  const APPLE_EPOCH_OFFSET = 978307200;

  // Use appSettings theme, fallback to system
  const currentTheme = appSettings?.theme ?? 'system';

  // Initialize app settings if they don't exist
  useEffect(() => {
    if (!appSettings) {
      initializeAppSettings().catch((error: unknown) => {
        console.error('Failed to initialize app settings:', error);
      });
    }
  }, [initializeAppSettings, appSettings]);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const dataSummary = useMemo(() => {
    const envelopeCount = envelopes.length;
    const transactionCount = transactions.length;
    const currentAllocations = currentMonth ? allocations[currentMonth] || [] : [];

    const incomeSourceCount = Object.values(incomeSources).reduce((sum, sources) => sum + sources.length, 0);
    const allocationCount = currentAllocations.length;
    const totalBalance = envelopes.reduce((sum, env) => {
      const balance = getEnvelopeBalance(env.id!);
      return sum + (typeof balance === 'number' ? balance : 0);
    }, 0);

    // New store doesn't have lastUpdated, so use latest transaction date
    const latestEnvelope = 0;

    const latestTransaction = transactions.reduce((max, tx) => {
      let ts = 0;
      if (typeof tx.date === 'string') {
        const parsed = Date.parse(tx.date);
        ts = Number.isNaN(parsed) ? 0 : parsed;
      } else if (typeof tx.date === 'number') {
        ts = tx.date < 2000000000 ? (tx.date + APPLE_EPOCH_OFFSET) * 1000 : tx.date;
      }
      return Math.max(max, ts);
    }, 0);

    const lastUpdated =
      latestEnvelope || latestTransaction
        ? new Date(Math.max(latestEnvelope, latestTransaction)).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Never';

    return {
      envelopeCount,
      transactionCount,
      incomeSourceCount,
      allocationCount,
      totalBalance,
      lastUpdated,
    };
  }, [envelopes, transactions, incomeSources, allocations, currentMonth]);

  const handleBackup = () => {
    try {
      console.log(' Creating backup...');
      console.log(' Envelopes in store:', envelopes.map(env => ({
        id: env.id,
        name: env.name,
        isPiggybank: env.isPiggybank,
        hasPiggybankConfig: !!env.piggybankConfig,
        piggybankConfig: env.piggybankConfig
      })));

      const backupData = {
        appVersion: '2.1 (PWA)',
        backupDate: Date.now(),
        appSettings: appSettings || {
          theme: 'system',
        },
        envelopes: envelopes.map(env => ({
          ...env,
          currentBalance: (() => {
            const balance = getEnvelopeBalance(env.id!);
            return typeof balance === 'number' ? balance : 0;
          })(), // Use computed balance for backup compatibility
          lastUpdated: new Date().toISOString()
        })),
        transactions,
        allocations,
        incomeSources,
      };

      console.log(' Backup data created:', {
        envelopeCount: backupData.envelopes.length,
        piggybankEnvelopes: backupData.envelopes.filter(e => e.isPiggybank).length,
        sampleEnvelope: backupData.envelopes.find(e => e.isPiggybank) || backupData.envelopes[0]
      });

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `HouseBudget_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Update last backup date
      const now = new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      localStorage.setItem('lastBackupDate', now);
      setLastBackupDate(now);

      setOperationResult({ success: true, message: 'Backup downloaded successfully.' });
    } catch (error) {
      console.error(error);
      setOperationResult({ 
        success: false, 
        message: 'Failed to create backup file.',
        onRetry: handleBackup 
      });
    }
  };

  const handleExportCSV = () => {
    setIsExportingCSV(true);
    setOperationResult(null);
    try {
      const headers = ['Date', 'Merchant', 'Notes', 'Amount', 'Type', 'Envelope', 'Reconciled'];

      const rows = transactions.map((t) => {
        const envName = envelopes.find((e) => e.id === t.envelopeId)?.name || 'Unknown';
        const safeMerchant = (t.merchant || '').replace(/"/g, '""');
        const safeNotes = (t.description || '').replace(/"/g, '""');

        let dateStr = 'Invalid Date';
        if (t.date) {
          if (typeof t.date === 'string') {
            dateStr = t.date.split('T')[0];
          } else if (typeof t.date === 'number') {
            const ts = t.date < 2000000000 ? (t.date + APPLE_EPOCH_OFFSET) * 1000 : t.date;
            dateStr = new Date(ts).toISOString().split('T')[0];
          }
        }
        return [
          dateStr,
          `"${safeMerchant}"`,
          `"${safeNotes}"`,
          (t.amount as number).toFixed(2),
          t.type,
          `"${envName}"`,
          t.reconciled ? 'Yes' : 'No',
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `HouseBudget_Transactions_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setOperationResult({ success: true, message: 'Transactions CSV exported successfully.' });
    } catch (error) {
      console.error(error);
      setOperationResult({ 
        success: false, 
        message: 'Failed to export CSV. Please try again.',
        onRetry: handleExportCSV
      });
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        const result = await importData(parsed);

        if (!result.success) {
          showStatus('error', result.message);
          return;
        }

        if (parsed.appSettings?.theme) {
          try {
            await updateAppSettings({ theme: parsed.appSettings.theme });
          } catch (error) {
            console.error('Failed to update imported settings:', error);
          }
        } else if (parsed.appSettings?.isDarkMode !== undefined) {
          // Backward compatibility with old backups
          try {
            const theme = parsed.appSettings.isDarkMode ? 'dark' : 'light';
            await updateAppSettings({ theme });
          } catch (error) {
            console.error('Failed to update imported settings:', error);
          }
        }

        showStatus(
          'success',
          `Loaded ${parsed.envelopes?.length ?? 0} envelopes, ${parsed.transactions?.length ?? 0} transactions, ${parsed.allocations ? Object.keys(parsed.allocations).reduce((sum, month) => sum + (parsed.allocations[month]?.length || 0), 0) : 0} allocations, and ${parsed.incomeSources ? Object.keys(parsed.incomeSources).reduce((sum, month) => sum + (parsed.incomeSources[month]?.length || 0), 0) : 0} income sources.`
        );
      } catch (error) {
        console.error(error);
        showStatus('error', 'Invalid backup file. Please verify the JSON.');
      }
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  const handleReset = async () => {
    if (
      window.confirm(
        'Are you sure? This will permanently delete all envelopes, transactions, budget allocations, income sources, and settings from the cloud. This action cannot be undone.'
      )
    ) {
      try {
        await resetData();
        showStatus('success', 'All data has been permanently deleted.');
        navigate('/');
      } catch (error) {
        console.error('Reset failed:', error);
        showStatus('error', 'Failed to delete all data. Some data may remain.');
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      showStatus('error', 'Please enter your password to confirm account deletion.');
      return;
    }

    setIsDeletingAccount(true);
    try {
      // First, reset all data
      await resetData();

      // Then delete the account
      const success = await deleteAccount(deletePassword);
      if (success) {
        showStatus('success', 'Your account has been permanently deleted.');
        // Navigate to login - this will happen automatically due to auth state change
      } else {
        showStatus('error', 'Failed to delete account. Please try again.');
      }
    } catch (error) {
      console.error('Account deletion failed:', error);
      showStatus('error', 'Failed to delete account. Please try again.');
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteDialog(false);
      setDeletePassword('');
    }
  };

  const handleMigrateDB = async () => {
    if (!currentUser) return;
    
    if (!window.confirm('Run DB Migration (Phase 3.2)? This converts string amounts to numbers and adds month keys. Backup recommended.')) {
      return;
    }

    setIsMigrating(true);
    try {
      const result = await migrateTransactions(currentUser.id);
      if (result.errors.length > 0) {
        console.error('Migration errors:', result.errors);
        showStatus('error', `Migration finished with ${result.errors.length} errors. Check console.`);
      } else {
        showStatus('success', `Migrated ${result.migratedCount} transactions successfully.`);
      }
    } catch (error) {
      console.error('Migration failed:', error);
      showStatus('error', 'Migration failed.');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleCleanupOrphanedData = async () => {
    if (!currentUser) {
      showStatus('error', 'You must be logged in to clean up data.');
      return;
    }

    setIsCleaningData(true);
    try {
      const report: CleanupReport = await budgetService.cleanupOrphanedData(currentUser.id);
      
      const totalDeleted = report.orphanedAllocationsDeleted + report.orphanedTransactionsDeleted;
      if (totalDeleted > 0) {
        showStatus('success', 
          `Cleaned ${totalDeleted} orphaned items: ${report.orphanedAllocationsDeleted} allocations and ${report.orphanedTransactionsDeleted} transactions from ${report.details.monthsProcessed.length} months.`
        );
      } else {
        showStatus('success', 'No orphaned data found. Your database is already clean!');
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
      showStatus('error', 'Failed to clean up orphaned data. Please try again.');
    } finally {
      setIsCleaningData(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-200">
      <header className="bg-white dark:bg-black border-b dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 sticky top-0 z-20 flex items-center justify-center shadow-sm relative">
        <button onClick={() => navigate(-1)} className="absolute left-4 text-blue-600 dark:text-blue-400 font-medium">
          Done
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h1>
      </header>

      <div className="p-4 space-y-6 max-w-2xl mx-auto pb-24">

        {statusMessage && (
          <div
            className={`px-4 py-3 rounded-2xl text-sm font-medium flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-green-50 text-green-700 dark:bg-emerald-900/30 dark:text-emerald-200'
                : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200'
            }`}
          >
            {statusMessage.type === 'success' ? <CheckCircle size={18} /> : <Trash2 size={18} />}
            {statusMessage.text}
          </div>
        )}

        {/* Backup hero */}
        <section>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Download className="text-blue-500" size={22} />
              <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">Backup & Restore</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  Create backups of all your data including envelopes, transactions, budget allocations, income sources, and settings.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div className="text-center">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-500">Envelopes</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{dataSummary.envelopeCount}</p>
              </div>
              <div className="text-center">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-500">Transactions</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{dataSummary.transactionCount}</p>
              </div>
              <div className="text-center">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-500">Income Sources</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{dataSummary.incomeSourceCount}</p>
              </div>
              <div className="text-center">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-500">Allocations</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{dataSummary.allocationCount}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase mb-2 px-1">Appearance</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {currentTheme === 'light' && <span className="text-orange-500 text-lg">☀️</span>}
                {currentTheme === 'dark' && <span className="text-purple-500 text-lg">🌙</span>}
                {currentTheme === 'system' && <span className="text-gray-500 text-lg">⚙️</span>}
                <span className="text-gray-900 dark:text-white font-medium">Theme</span>
              </div>
              <span className="text-sm text-gray-500 dark:text-zinc-400 capitalize">{currentTheme}</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-zinc-500 mb-3">
              Choose your preferred appearance.
            </div>
            <div className="flex gap-2">
              {[
                { label: 'Light', value: 'light' as const },
                { label: 'Dark', value: 'dark' as const },
                { label: 'System', value: 'system' as const }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={async () => {
                    try {
                      await updateAppSettings({ theme: option.value });
                    } catch (error) {
                      console.error('Failed to update theme setting:', error);
                    }
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    currentTheme === option.value
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-200'
                      : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-gray-300 dark:hover:border-zinc-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Actions */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase mb-2 px-1">Actions</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm divide-y divide-gray-100 dark:divide-zinc-800">
            <button
              onClick={handleBackup}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Download className="text-blue-500" size={20} />
                <div className="flex flex-col items-start">
                  <span className="text-gray-900 dark:text-white font-medium">Create Backup</span>
                  <span className="text-xs text-gray-500 dark:text-zinc-400">Last backup: {lastBackupDate}</span>
                </div>
              </div>
              <ChevronRight className="text-gray-400" size={18} />
            </button>

            <button
              onClick={handleRestoreClick}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Upload className="text-blue-500" size={20} />
                <span className="text-gray-900 dark:text-white font-medium">Restore from Backup</span>
              </div>
              <ChevronRight className="text-gray-400" size={18} />
            </button>

            <div className="p-4">
              <button
                onClick={handleExportCSV}
                disabled={isExportingCSV}
                className="w-full flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed rounded-xl border border-gray-100 dark:border-zinc-800 px-4 py-3 bg-white dark:bg-zinc-900"
              >
                <div className="flex items-center gap-3">
                  {isExportingCSV ? (
                    <Loader className="text-blue-500 animate-spin" size={20} />
                  ) : (
                    <FileText className="text-blue-500" size={20} />
                  )}
                  <span className="text-gray-900 dark:text-white font-medium">
                    {isExportingCSV ? 'Preparing CSV…' : 'Export Transactions (CSV)'}
                  </span>
                </div>
                <ChevronRight className="text-gray-400" size={18} />
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
          </div>
        </section>

        {/* Tips */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase mb-2 px-1">Tips</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4 text-sm text-gray-600 dark:text-zinc-300 space-y-2">
            <p>Create regular backups before major changes.</p>
            <p>Store backups in iCloud, Files, or another safe location.</p>
            <p>Backups are plain JSON files and can be inspected in any text editor.</p>
            <p>Restoring replaces all current envelopes, transactions, budget allocations, income sources, and settings.</p>
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase mb-2 px-1">Danger Zone</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm">
            <button
              onClick={handleMigrateDB}
              disabled={isMigrating}
              className="w-full p-4 flex items-center justify-between hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors border-b border-gray-100 dark:border-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                {isMigrating ? (
                  <Loader className="text-orange-500 animate-spin" size={20} />
                ) : (
                  <Sparkles className="text-orange-500" size={20} />
                )}
                <div className="flex flex-col items-start">
                  <span className="text-gray-900 dark:text-white font-medium">
                    {isMigrating ? 'Migrating...' : '⚡ Migrate DB Types'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-zinc-400">Convert strings to numbers (Phase 3.2)</span>
                </div>
              </div>
              <ChevronRight className="text-gray-400" size={18} />
            </button>

            <button
              onClick={handleReset}
              className="w-full p-4 flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border-b border-gray-100 dark:border-zinc-800"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="text-red-500" size={20} />
                <div className="flex flex-col items-start">
                  <span className="text-gray-900 dark:text-white font-medium">Reset All Data</span>
                  <span className="text-xs text-gray-500 dark:text-zinc-400">Permanently delete all envelopes, transactions, allocations, income sources, and settings</span>
                </div>
              </div>
              <ChevronRight className="text-gray-400" size={18} />
            </button>

            <button
              onClick={handleCleanupOrphanedData}
              disabled={isCleaningData}
              className="w-full p-4 flex items-center justify-between hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors border-b border-gray-100 dark:border-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                {isCleaningData ? (
                  <Loader className="text-orange-500 animate-spin" size={20} />
                ) : (
                  <Sparkles className="text-orange-500" size={20} />
                )}
                <div className="flex flex-col items-start">
                  <span className="text-gray-900 dark:text-white font-medium">
                    {isCleaningData ? 'Cleaning Data...' : '🧹 Purge Orphaned Data'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-zinc-400">Remove allocations and transactions pointing to deleted envelopes</span>
                </div>
              </div>
              <ChevronRight className="text-gray-400" size={18} />
            </button>

            <button
              onClick={() => setShowDeleteDialog(true)}
              className="w-full p-4 flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-red-500" size={20} />
                <div className="flex flex-col items-start">
                  <span className="text-gray-900 dark:text-white font-medium">Delete Account</span>
                  <span className="text-xs text-gray-500 dark:text-zinc-400">Permanently delete your account and all data</span>
                </div>
              </div>
              <ChevronRight className="text-gray-400" size={18} />
            </button>
          </div>
        </section>

        {/* App Version */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-400 dark:text-zinc-500">Version 1.2.0 (PWA)</p>
        </div>

        {/* Operation Result Modal */}
        {operationResult && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-sm w-full">
              <div className="flex items-center gap-3 mb-4">
                {operationResult.success ? (
                  <CheckCircle className="text-green-500" size={24} />
                ) : (
                  <AlertTriangle className="text-red-500" size={24} />
                )}
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {operationResult.success ? 'Success' : 'Error'}
                </h3>
              </div>
              <p className="text-gray-600 dark:text-zinc-300 mb-4">{operationResult.message}</p>
              <div className="flex gap-2">
                {operationResult.onRetry && (
                  <button
                    onClick={() => {
                      setOperationResult(null);
                      operationResult.onRetry?.();
                    }}
                    className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                  >
                    Retry
                  </button>
                )}
                <button
                  onClick={() => setOperationResult(null)}
                  className="flex-1 py-2 px-4 bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-zinc-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Account Dialog */}
        {showDeleteDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-sm w-full">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="text-red-500" size={24} />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Account</h3>
              </div>
              <p className="text-gray-600 dark:text-zinc-300 mb-4">
                This action cannot be undone. This will permanently delete your account and remove all data from our servers.
              </p>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-400 mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setDeletePassword('');
                  }}
                  className="flex-1 py-2 px-4 bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-zinc-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount || !deletePassword.trim()}
                  className="flex-1 py-2 px-4 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
