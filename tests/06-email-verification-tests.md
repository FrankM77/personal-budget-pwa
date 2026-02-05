# Test Case 06: Email Verification Flow

## Goal
Verify that users are required to verify their email before accessing the app, and that the verification state is correctly updated.

## Prerequisites
- A fresh test email account or use a "+" alias (e.g., `user+test@example.com`).

## Test Steps

### 1. Account Creation (Registration)
1. Navigate to the login page.
2. Click "Sign Up".
3. Enter a display name, a valid email, and a strong password.
4. Click "Create Account".
5. **Expected Result:**
   - The app should transition to the `EmailVerificationView`.
   - A verification email should be sent to the registered address.
   - The UI should display the "Check your email" message with the correct email address.

### 2. Unverified State & Auto-Check
1. While on the `EmailVerificationView`, do NOT click the link in your email yet.
2. Refresh the page.
3. **Expected Result:**
   - The app should remain on the `EmailVerificationView` (because the email is not yet verified in Firebase).

### 3. Resend Email Rate Limiting
1. Click "Resend verification email".
2. **Expected Result:** 
   - A success message should appear ("Verification email sent successfully!").
3. Immediately click "Resend verification email" again.
4. **Expected Result:**
   - An error message should appear: "Please wait X seconds before requesting another verification email." (Rate limiting working).

### 4. Automatic Refresh on Focus
1. Keep the app open on the `EmailVerificationView`.
2. Open your email in a DIFFERENT browser tab or window.
3. Click the verification link in the email from House Budget.
4. After seeing the Firebase success page, switch back to the tab with the app.
5. **Expected Result:**
   - The app should automatically detect the focus change and refresh the verification status.
   - The app should transition to the main `EnvelopeListView` (Dashboard) without requiring further action.

### 5. Login Blocking for Unverified Users
1. Log out of the app.
2. Create ANOTHER new account with a different email.
3. When redirected to `EmailVerificationView`, click "Back to sign in" (or refresh and go to login).
4. Attempt to sign in with the unverified email and password.
5. **Expected Result:**
   - Login should fail.
   - An error message should appear: "Please verify your email address before signing in. Check your email for a verification link."
   - The app should NOT allow access to the dashboard.

### 6. Offline Persistence (Grace Period)
1. Verify an account and log in.
2. Go offline (e.g., DevTools -> Network -> Offline).
3. Refresh the app.
4. **Expected Result:**
   - The app should still allow access to the dashboard using the cached authentication (offline grace period).
