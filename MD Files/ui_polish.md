# UI/UX Polish Roadmap

This document outlines the specific refinements needed to elevate the application's "native app feel" and ensure a premium user experience.

## 1. Transitions & Animations
*   **View Transitions:** Implement slide-in/slide-out animations when navigating between the main list and detail views (e.g., `EnvelopeDetail`, `AddTransactionView`).
*   **Micro-interactions:** Add subtle spring animations to modal entries and exits.
*   **Gesture-based Back:** Ensure the transition feels natural when using the "Swipe to go back" gesture on iOS.

## 2. Enhanced Touch Feedback
*   **Active States:** Add `active:scale-95` or `active:bg-gray-100/dark:bg-zinc-800` to all interactive cards, buttons, and list items.
*   **Haptic Vibe:** Simulate haptic feedback through micro-animations for destructive actions (like swiping to delete).
*   **Navigation Feedback:** Ensure the Bottom Navigation icons have a clear, animated "selected" state.

## 3. Skeleton Loading States
*   **Placeholders:** Replace the full-screen "Loading your budget" spinner with skeleton UI blocks that mirror the structure of the `EnvelopeListView`.
*   **Atomic Loading:** Show skeleton cards for envelopes while they are being calculated/fetched to reduce perceived wait time.

## 4. Dark Mode Consistency & Polish
*   **Color Audits:** Identify and fix any "jarring" colors (e.g., pure white borders in dark mode or low-contrast text).
*   **Zinc Palette:** Standardize on the Tailwind `zinc` palette for dark mode to match the premium "Apple-style" aesthetic.
*   **System Integration:** Ensure the theme transition is seamless when the OS changes from light to dark.

## 5. Typography & Visual Hierarchy
*   **Font Weights:** Refine font weights (e.g., using `font-semibold` vs `font-bold`) to create a clearer distinction between titles and metadata.
*   **Tabular Figures:** Use `font-variant-numeric: tabular-nums` for all currency displays to prevent layout shifting when numbers change.
*   **Spacing:** Tighten up vertical rhythm in list items to show more data without feeling cluttered.

## 6. Main View Header Cleanup
*   **Title Alignment:** Ensure the "Budget" or "Month" title is perfectly centered or aligned according to iOS guidelines.
*   **Contextual Actions:** Move the "User Menu" or "Month Selector" into a more cohesive layout that feels integrated with the system's safe areas.
*   **Visual Noise:** Remove unnecessary borders or shadows to create a "flat" but layered modern look.
