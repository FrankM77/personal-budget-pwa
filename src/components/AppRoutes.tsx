import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { EnvelopeListView } from '../views/EnvelopeListView';
import EnvelopeDetail from '../views/EnvelopeDetail';
import { SettingsView } from '../views/SettingsView';
import { CategorySettingsView } from '../views/CategorySettingsView';
import { AddEnvelopeView } from '../views/AddEnvelopeView';
import { AddTransactionView } from '../views/AddTransactionView';
import { TransactionHistoryView } from '../views/TransactionHistoryView';
import { EmailVerificationView } from '../views/EmailVerificationView';
import { AnalyticsView } from '../views/AnalyticsView';
import { BudgetBreakdownView } from '../views/BudgetBreakdownView';
import { ReportsView } from '../views/ReportsView';
import { ErrorBoundary } from './ErrorBoundary';

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
  );
};
