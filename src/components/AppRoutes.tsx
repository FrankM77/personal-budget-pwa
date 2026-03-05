import React, { Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { EnvelopeListView } from '../views/EnvelopeListView';
import EnvelopeDetail from '../views/EnvelopeDetail';
import { AddTransactionView } from '../views/AddTransactionView';
import { ErrorBoundary } from './ErrorBoundary';

// Lazy-loaded views (code-split for smaller initial bundle)
const SettingsView = lazy(() => import('../views/SettingsView').then(m => ({ default: m.SettingsView })));
const CategorySettingsView = lazy(() => import('../views/CategorySettingsView').then(m => ({ default: m.CategorySettingsView })));
const AddEnvelopeView = lazy(() => import('../views/AddEnvelopeView').then(m => ({ default: m.AddEnvelopeView })));
const TransactionHistoryView = lazy(() => import('../views/TransactionHistoryView').then(m => ({ default: m.TransactionHistoryView })));
const EmailVerificationView = lazy(() => import('../views/EmailVerificationView').then(m => ({ default: m.EmailVerificationView })));
const AnalyticsView = lazy(() => import('../views/AnalyticsView').then(m => ({ default: m.AnalyticsView })));
const BudgetBreakdownView = lazy(() => import('../views/BudgetBreakdownView').then(m => ({ default: m.BudgetBreakdownView })));
const ReportsView = lazy(() => import('../views/ReportsView').then(m => ({ default: m.ReportsView })));

const LazyFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">
    <div className="w-8 h-8 border-3 border-blue-200 dark:border-blue-800 border-t-blue-500 rounded-full animate-spin" />
  </div>
);

const PageTransition = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="w-full h-full bg-gray-50 dark:bg-black"
    >
      {children}
    </motion.div>
  );
};

export const AppRoutes = () => {
  const location = useLocation();

  return (
    <Suspense fallback={<LazyFallback />}>
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route 
          path="/" 
          element={
            <PageTransition>
              <ErrorBoundary>
                <EnvelopeListView />
              </ErrorBoundary>
            </PageTransition>
          } 
        />
        <Route 
          path="/envelope/:id" 
          element={
            <PageTransition>
              <ErrorBoundary>
                <EnvelopeDetail />
              </ErrorBoundary>
            </PageTransition>
          } 
        />
        <Route 
          path="/add-envelope" 
          element={
            <PageTransition>
              <ErrorBoundary>
                <AddEnvelopeView />
              </ErrorBoundary>
            </PageTransition>
          } 
        />
        <Route 
          path="/add-transaction" 
          element={
            <PageTransition>
              <ErrorBoundary>
                <AddTransactionView />
              </ErrorBoundary>
            </PageTransition>
          } 
        />
        <Route 
          path="/transactions" 
          element={
            <PageTransition>
              <ErrorBoundary>
                <TransactionHistoryView />
              </ErrorBoundary>
            </PageTransition>
          } 
        />
        <Route 
          path="/settings" 
            element={
            <PageTransition>
              <ErrorBoundary>
                <SettingsView />
              </ErrorBoundary>
            </PageTransition>
          } 
        />
        <Route 
          path="/settings/categories" 
            element={
            <PageTransition>
              <ErrorBoundary>
                <CategorySettingsView />
              </ErrorBoundary>
            </PageTransition>
          } 
        />
        <Route
          path="/verify-email"
          element={
            <PageTransition>
              <ErrorBoundary>
                <EmailVerificationView />
              </ErrorBoundary>
            </PageTransition>
          }
        />
        <Route
          path="/analytics"
          element={
            <PageTransition>
              <ErrorBoundary>
                <AnalyticsView />
              </ErrorBoundary>
            </PageTransition>
          }
        />
        <Route
          path="/budget-breakdown"
          element={
            <PageTransition>
              <ErrorBoundary>
                <BudgetBreakdownView />
              </ErrorBoundary>
            </PageTransition>
          }
        />
        <Route
          path="/reports"
          element={
            <PageTransition>
              <ErrorBoundary>
                <ReportsView />
              </ErrorBoundary>
            </PageTransition>
          }
        />
      </Routes>
    </AnimatePresence>
    </Suspense>
  );
};
