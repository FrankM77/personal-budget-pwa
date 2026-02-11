🎯 Medium Priority - Quick Wins (30-60 min total)
1. Replace alert() with Toast Notifications (15 min)
Impact: Better UX consistency
Files: App.tsx lines 64, 68
Why: App has a toast system but uses browser alerts for email verification
2. Fix useSiriQuery Dependency Array (10 min)
Impact: React best practices, prevent strict mode issues
File: src/hooks/useSiriQuery.ts
Why: Empty dependency array but uses searchParams and envelopes
3. Add Input Sanitization for Siri (15 min)
Impact: Security improvement
File: src/services/SiriService.ts
Why: Prevent prompt injection attacks
4. Pin Gemini Model Version (10 min)
Impact: Prevent unexpected AI behavior
File: functions/src/index.ts
Why: Model updates could change parsing behavior
🟡 Low Priority - Polish (20-30 min total)
5. Fix PWA Icon Purpose (5 min)
Impact: Better device compatibility
File: vite.config.ts PWA config
Why: Current 'any maskable' should be separate entries
6. Remove Hardcoded Deploy Timestamp (5 min)
Impact: Clean up stale comment
File: index.html line 25
Why: Manual maintenance overhead
7. Add PWA Shortcuts (10 min)
Impact: Better home screen experience
File: vite.config.ts
Why: Quick "Add Transaction" shortcut from home screen