import { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { usePasswordValidation } from '../utils/passwordValidation';
import { PasswordRequirementsChecklist } from '../components/ui/PasswordRequirementsChecklist';
import { PasswordStrengthIndicator } from '../components/ui/PasswordStrengthIndicator';

interface ResetPasswordViewProps {
  oobCode: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const ResetPasswordView = ({ oobCode, onSuccess, onCancel }: ResetPasswordViewProps) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const { confirmPasswordReset, isLoading, loginError, clearError } = useAuthStore();
  const passwordValidation = usePasswordValidation(newPassword);

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      return;
    }
    
    if (!passwordValidation.isValid) {
      return;
    }

    const success = await confirmPasswordReset(oobCode, newPassword);
    if (success) {
      setIsSuccess(true);
      // Wait a bit before redirecting or let user click button
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Password Reset Complete
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Your password has been successfully updated. You can now log in with your new password.
          </p>
          <button
            onClick={onSuccess}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex flex-col items-center gap-3 mb-2">
            <div className="flex items-center gap-3">
              <img
                src={`${import.meta.env.BASE_URL}icon-192.png`}
                alt="Personal Budget Logo"
                className="w-10 h-10"
              />
              <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                Reset Password
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Create a new password for your account
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* New Password */}
            <div>
              <label 
                htmlFor="new-password" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="new-password"
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-colors"
                  placeholder="Enter new password"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                >
                  {isPasswordVisible ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              
              {/* Password Strength Meter */}
              <div className="mt-2">
                <PasswordStrengthIndicator password={newPassword} />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label 
                htmlFor="confirm-password" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirm-password"
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full pl-10 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-colors ${
                    confirmPassword && newPassword !== confirmPassword
                      ? 'border-red-500 dark:border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Confirm new password"
                  required
                />
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="mt-1 text-sm text-red-500">
                  Passwords do not match
                </p>
              )}
            </div>

            {/* Requirements Checklist */}
            <PasswordRequirementsChecklist password={newPassword} />

            {/* Error Message */}
            {loginError && (
              <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
                {loginError}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !newPassword || !confirmPassword || newPassword !== confirmPassword || !passwordValidation.isValid}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Updating Password...' : 'Reset Password'}
            </button>

            {/* Back to Login */}
            <div className="text-center">
              <button
                type="button"
                onClick={onCancel}
                className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium inline-flex items-center"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Login
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
