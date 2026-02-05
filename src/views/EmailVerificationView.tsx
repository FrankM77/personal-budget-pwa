import { useState, useEffect } from 'react';
import { Mail, RefreshCw, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

export const EmailVerificationView = () => {
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const { currentUser, resendEmailVerification, checkVerificationStatus, logout, loginError } = useAuthStore();

  // Redirect if no current user (shouldn't happen in normal flow)
  useEffect(() => {
    if (!currentUser) {
      console.warn('EmailVerificationView: No current user, this should not happen');
    }
  }, [currentUser]);

  // Auto-check when window regains focus
  useEffect(() => {
    const handleFocus = () => {
      console.log('Window focused, checking verification status...');
      checkVerificationStatus();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [checkVerificationStatus]);

  const handleResendVerification = async () => {
    setIsResending(true);
    setResendSuccess(false);

    const success = await resendEmailVerification();
    setIsResending(false);

    if (success) {
      setResendSuccess(true);
      // Hide success message after 3 seconds
      setTimeout(() => setResendSuccess(false), 3000);
    }
  };

  const handleBackToLogin = async () => {
    await logout();
    // App will automatically show LoginView when currentUser is cleared
  };

  if (!currentUser) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Logo/Brand */}
        <div className="text-center">
          <div className="flex flex-col items-center gap-3 mb-2">
            <div className="flex items-center gap-3">
              <img
                src={`${import.meta.env.BASE_URL}icon-192.png`}
                alt="House Budget Logo"
                className="w-10 h-10"
              />
              <h1 className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                House Budget
              </h1>
            </div>
          </div>
        </div>

        {/* Verification Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <div className="text-center">
            {/* Success Icon */}
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
              <Mail className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Check your email
            </h2>

            {/* Description */}
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              We've sent a verification link to{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                {currentUser.email}
              </span>
            </p>

            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                    What to do next:
                  </p>
                  <ol className="text-sm text-blue-700 dark:text-blue-300 mt-1 space-y-1">
                    <li>1. Open your email inbox</li>
                    <li>2. Find the email from House Budget</li>
                    <li>3. Click the "Verify Email" link</li>
                    <li>4. Return here and sign in</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {loginError && (
              <div className="text-red-600 dark:text-red-400 text-sm mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                {loginError}
              </div>
            )}

            {/* Success Message */}
            {resendSuccess && (
              <div className="text-green-600 dark:text-green-400 text-sm mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                Verification email sent successfully!
              </div>
            )}

            {/* Resend Button */}
            <button
              onClick={handleResendVerification}
              disabled={isResending}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed mb-4 flex items-center justify-center gap-2"
            >
              {isResending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Resend verification email
                </>
              )}
            </button>

            {/* Back to Login */}
            <button
              onClick={handleBackToLogin}
              className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium flex items-center justify-center gap-2 mx-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Didn't receive the email? Check your spam folder or try resending.
          </p>
        </div>
      </div>
    </div>
  );
};
