import { useState, useEffect } from 'react';
import { Eye, EyeOff, UserPlus, Mail, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { PasswordStrengthIndicator } from '../components/ui/PasswordStrengthIndicator';
import { PasswordRequirementsChecklist } from '../components/ui/PasswordRequirementsChecklist';
import { usePasswordValidation } from '../utils/passwordValidation';

export const LoginView = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const { login, register, sendPasswordReset, isLoading, loginError, clearError } = useAuthStore();

  // Password validation for registration
  const passwordValidation = usePasswordValidation(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError(); // Clear any previous errors before attempting authentication
    if (email.trim() && password.trim()) {
      if (isRegistering) {
        if (!displayName.trim()) {
          return; // Display name is required for registration
        }
        // Check password strength before attempting registration
        if (!passwordValidation.isValid) {
          return; // Password validation will prevent submission
        }
        await register(email.trim(), password, displayName.trim());
        // App will automatically show EmailVerificationView after successful registration
      } else {
        await login(email.trim(), password);
      }
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      const success = await sendPasswordReset(email.trim());
      if (success) {
        setResetEmailSent(true);
      }
    }
  };

  // Reset the form when toggling between login/register/forgot password
  useEffect(() => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setResetEmailSent(false);
  }, [isRegistering, showForgotPassword]);

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
            <p className="text-gray-600 dark:text-gray-400">
              Simple envelope budgeting for your household
            </p>
          </div>
        </div>

        {/* Auth Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          {showForgotPassword ? (
            <form onSubmit={handlePasswordReset} className="space-y-6">
              <div className="text-center mb-2">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Reset Password
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Enter your email and we'll send you a link to reset your password.
                </p>
              </div>

              <div>
                <label
                  htmlFor="reset-email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter your email"
                    required
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
              </div>

              {resetEmailSent ? (
                <div className="text-center py-4">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30">
                    <Mail className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="mt-3 text-lg font-medium text-gray-900 dark:text-white">
                    Check your email
                  </h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    We've sent a password reset link to <span className="font-medium">{email}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <ArrowLeft className="-ml-1 mr-2 h-4 w-4" />
                    Back to login
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="submit"
                    disabled={isLoading || !email.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>

                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(false)}
                      className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                      disabled={isLoading}
                    >
                      <ArrowLeft className="inline-block h-4 w-4 -ml-1 mr-1" />
                      Back to login
                    </button>
                  </div>
                </>
              )}
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {isRegistering ? 'Create Account' : 'Sign In'}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  {isRegistering
                    ? 'Create a new account to get started'
                    : 'Sign in to your account'}
                </p>
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter your email"
                  required
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>

              {isRegistering && (
                <div>
                  <label
                    htmlFor="displayName"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Display Name
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter your display name"
                    required
                    disabled={isLoading}
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Password
                  </label>
                  {!isRegistering && (
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                      disabled={isLoading}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={isPasswordVisible ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                      isRegistering && password && !passwordValidation.isValid
                        ? 'border-red-500 dark:border-red-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Enter your password"
                    required
                    disabled={isLoading}
                    autoComplete={isRegistering ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                    disabled={isLoading}
                  >
                    {isPasswordVisible ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>

                {/* Password Strength Indicator - only show during registration */}
                {isRegistering && password && (
                  <div className="mt-2">
                    <PasswordStrengthIndicator password={password} />
                  </div>
                )}

                {/* Password Requirements Checklist - only show during registration */}
                {isRegistering && password && (
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                    <PasswordRequirementsChecklist password={password} />
                  </div>
                )}
              </div>

              {loginError && (
                <div className="text-red-600 dark:text-red-400 text-sm text-center bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                  {loginError}
                  {loginError.includes('verify your email') && (
                    <div className="mt-3">
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        Please check your email and click the verification link to continue.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  isLoading ||
                  !email.trim() ||
                  !password.trim() ||
                  (isRegistering && !displayName.trim()) ||
                  (isRegistering && !passwordValidation.isValid)
                }
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed"
              >
                {isLoading
                  ? isRegistering
                    ? 'Creating Account...'
                    : 'Signing in...'
                  : isRegistering
                  ? 'Create Account'
                  : 'Sign In'}
              </button>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setShowForgotPassword(false);
                  }}
                  className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium flex items-center justify-center gap-2 mx-auto"
                  disabled={isLoading}
                >
                  <UserPlus className="h-4 w-4" />
                  {isRegistering
                    ? 'Already have an account? Sign In'
                    : "Don't have an account? Sign Up"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};