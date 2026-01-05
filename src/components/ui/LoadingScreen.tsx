import React from 'react';
import { RefreshCw, Wallet } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  showTimeout?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = "Loading your budget...", 
  showTimeout = false 
}) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col items-center justify-center px-4">
      {/* Loading Animation */}
      <div className="mb-8">
        <div className="relative">
          <RefreshCw size={48} className="text-blue-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Wallet size={24} className="text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>

      {/* Loading Message */}
      <div className="text-center space-y-3">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {message}
        </h2>
        <p className="text-sm text-gray-600 dark:text-zinc-400 max-w-md">
          This may take a moment on slow connections. We're fetching your budget data securely.
        </p>
      </div>

      {/* Skeleton Elements for Perceived Structure */}
      <div className="mt-12 w-full max-w-md space-y-4">
        {/* Header Skeleton */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex justify-between items-center">
            <div className="h-6 bg-gray-200 dark:bg-zinc-700 rounded w-24 animate-pulse"></div>
            <div className="flex gap-2">
              <div className="h-8 w-8 bg-gray-200 dark:bg-zinc-700 rounded-full animate-pulse"></div>
              <div className="h-8 w-8 bg-gray-200 dark:bg-zinc-700 rounded-full animate-pulse"></div>
              <div className="h-8 w-8 bg-gray-200 dark:bg-zinc-700 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Available to Budget Skeleton */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-32 mb-2 animate-pulse"></div>
          <div className="h-8 bg-gray-200 dark:bg-zinc-700 rounded w-20 animate-pulse"></div>
        </div>

        {/* Income Sources Skeleton */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex justify-between items-center mb-4">
            <div className="h-5 bg-gray-200 dark:bg-zinc-700 rounded w-28 animate-pulse"></div>
            <div className="h-6 w-6 bg-gray-200 dark:bg-zinc-700 rounded-full animate-pulse"></div>
          </div>
          <div className="space-y-3">
            <div className="h-12 bg-gray-100 dark:bg-zinc-800 rounded-xl animate-pulse"></div>
            <div className="h-12 bg-gray-100 dark:bg-zinc-800 rounded-xl animate-pulse"></div>
          </div>
        </div>

        {/* Envelopes Skeleton */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex justify-between items-center mb-4">
            <div className="h-5 bg-gray-200 dark:bg-zinc-700 rounded w-32 animate-pulse"></div>
            <div className="h-6 w-6 bg-gray-200 dark:bg-zinc-700 rounded-full animate-pulse"></div>
          </div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-100 dark:bg-zinc-800 rounded-xl animate-pulse"></div>
            <div className="h-16 bg-gray-100 dark:bg-zinc-800 rounded-xl animate-pulse"></div>
            <div className="h-16 bg-gray-100 dark:bg-zinc-800 rounded-xl animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Timeout Message */}
      {showTimeout && (
        <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 max-w-md">
          <p className="text-sm text-amber-800 dark:text-amber-200 text-center">
            This is taking longer than usual. If you're on a very slow connection, this is normal. Your data will load shortly.
          </p>
        </div>
      )}

      {/* Progress Indicator */}
      <div className="mt-8 w-full max-w-md">
        <div className="h-1 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
        </div>
      </div>
    </div>
  );
};
