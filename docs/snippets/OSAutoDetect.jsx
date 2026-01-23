// Auto-selects the Windows tab if the user is on Windows
// Import with: import { OSAutoDetect } from '/snippets/OSAutoDetect.jsx'
// Usage: <OSAutoDetect /> at the top of a page with OS-specific tabs

export const OSAutoDetect = () => {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if (typeof window !== 'undefined') {
            window.addEventListener('load', function() {
              const ua = navigator.userAgent.toLowerCase();
              const isWindows = ua.includes('win');
              const tabIndex = isWindows ? 1 : 0;
              const tabButtons = document.querySelectorAll('[role="tablist"] button');
              if (tabButtons && tabButtons[tabIndex]) {
                tabButtons[tabIndex].click();
              }
            });
          }
        `,
      }}
    />
  );
};
