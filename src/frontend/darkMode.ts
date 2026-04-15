/**
 * Dark mode toggle functionality
 * Ported from js/dark_mode.js to TypeScript
 */

/**
 * Check if dark mode should be active based on time of day
 * Active between 7 PM and 6 AM
 */
function shouldDarkModeBeActive(): boolean {
  const hour = new Date().getHours();
  return hour >= 19 || hour < 6;
}

/**
 * Initialize dark mode toggle
 */
export function initDarkMode(): void {
  const checkbox = document.getElementById('dark-mode-checkbox') as HTMLInputElement | null;
  
  if (!checkbox) {
    console.warn('Dark mode checkbox not found');
    return;
  }

  // Auto-detect based on time of day
  if (shouldDarkModeBeActive()) {
    checkbox.checked = true;
    document.body.classList.add('dark-mode');
  }

  // Toggle dark mode on checkbox change
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  });
}
