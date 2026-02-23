// Auto-selects the appropriate tab based on the user's OS
// Import with: import { OSAutoDetect } from '/snippets/OSAutoDetect.jsx'
// Usage: <OSAutoDetect /> at the top of a page with OS-specific tabs
// Tab order: 0 = macOS/Linux, 1 = Windows, 2 = npm (default)

export const OSAutoDetect = () => {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if (typeof window !== 'undefined') {
            window.addEventListener('load', function() {
              const ua = navigator.userAgent.toLowerCase();
              const isWindows = ua.includes('win');
              const isMac = ua.includes('mac');
              const isLinux = ua.includes('linux');
              // macOS/Linux (0), Windows (1), npm (2 - default)
              let tabIndex = 2;
              if (isMac || isLinux) {
                tabIndex = 0;
              } else if (isWindows) {
                tabIndex = 1;
              }

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
