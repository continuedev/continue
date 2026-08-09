// Cookie Banner Implementation for Continue Documentation
// This script implements a cookie consent banner in offline mode

(function () {
  "use strict";

  // Configuration
  const COOKIE_NAME = "continue_cookie_consent";
  const COOKIE_EXPIRY_DAYS = 365;

  // Default consent state
  const defaultConsent = {
    necessary: true,
    analytics: false,
    marketing: false,
  };

  // Wait for the page to fully load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeCookieBanner);
  } else {
    initializeCookieBanner();
  }

  function initializeCookieBanner() {
    // Check if banner is already initialized
    if (window.cookieBannerInitialized) {
      return;
    }
    window.cookieBannerInitialized = true;

    // Get stored consent
    const storedConsent = getStoredConsent();

    // Apply stored consent or show banner
    if (storedConsent) {
      applyConsent(storedConsent);
    } else {
      // Set default consent (deny all except necessary)
      applyConsent(defaultConsent);
      showCookieBanner();
    }
  }

  function getStoredConsent() {
    const cookie = document.cookie
      .split(";")
      .find((c) => c.trim().startsWith(COOKIE_NAME + "="));
    if (cookie) {
      try {
        return JSON.parse(decodeURIComponent(cookie.split("=")[1]));
      } catch (e) {
        console.error("Failed to parse consent cookie:", e);
      }
    }
    return null;
  }

  function setConsentCookie(consent) {
    const date = new Date();
    date.setTime(date.getTime() + COOKIE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const expires = "expires=" + date.toUTCString();
    document.cookie =
      COOKIE_NAME +
      "=" +
      encodeURIComponent(JSON.stringify(consent)) +
      ";" +
      expires +
      ";path=/;SameSite=Lax";
  }

  function applyConsent(consent) {
    // Apply Google Analytics consent
    if (window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: consent.analytics ? "granted" : "denied",
        ad_user_data: consent.marketing ? "granted" : "denied",
        ad_personalization: consent.marketing ? "granted" : "denied",
      });
    }

    // Apply PostHog consent
    if (window.posthog) {
      if (consent.analytics) {
        window.posthog.opt_in_capturing();
      } else {
        window.posthog.opt_out_capturing();
      }
    }

    // Store consent
    setConsentCookie(consent);
  }

  function showCookieBanner() {
    // Create banner (no overlay - users can continue browsing)
    const banner = document.createElement("div");
    banner.className = "cookie-banner";
    banner.innerHTML = `
      <div class="cookie-banner-content">
        <div class="cookie-banner-text">
          <p>We use cookies to enhance your experience on our documentation site. By continuing to browse, you agree to our use of cookies.</p>
        </div>
        <div class="cookie-banner-actions">
          <button class="cookie-btn cookie-btn-secondary" onclick="window.showPreferencesDialog()">Manage Preferences</button>
          <button class="cookie-btn cookie-btn-primary" onclick="window.acceptAllCookies()">Accept All</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    // Make functions globally available
    window.acceptAllCookies = function () {
      const consent = {
        necessary: true,
        analytics: true,
        marketing: true,
      };
      applyConsent(consent);
      hideCookieBanner();
    };

    window.showPreferencesDialog = showPreferencesDialog;
  }

  function hideCookieBanner() {
    const banner = document.querySelector(".cookie-banner");
    if (banner) banner.remove();
  }

  function showPreferencesDialog() {
    hideCookieBanner();

    const currentConsent = getStoredConsent() || defaultConsent;

    // Create dialog overlay
    const dialogOverlay = document.createElement("div");
    dialogOverlay.className = "cookie-dialog-overlay";
    dialogOverlay.onclick = function (e) {
      if (e.target === dialogOverlay) {
        hidePreferencesDialog();
      }
    };

    // Create dialog
    const dialog = document.createElement("div");
    dialog.className = "cookie-dialog";
    dialog.innerHTML = `
      <div class="cookie-dialog-header">
        <h2>Cookie Preferences</h2>
        <button class="cookie-dialog-close" onclick="window.hidePreferencesDialog()">×</button>
      </div>
      <div class="cookie-dialog-body">
        <p>We use cookies and similar technologies to help personalize content and offer a better experience. You can customize your preferences below:</p>
        
        <div class="cookie-category">
          <div class="cookie-category-header">
            <label class="cookie-switch">
              <input type="checkbox" id="cookie-necessary" checked disabled>
              <span class="cookie-slider"></span>
            </label>
            <div class="cookie-category-info">
              <h3>Necessary Cookies</h3>
              <p>These cookies are essential for the website to function properly and cannot be disabled.</p>
            </div>
          </div>
        </div>

        <div class="cookie-category">
          <div class="cookie-category-header">
            <label class="cookie-switch">
              <input type="checkbox" id="cookie-analytics" ${currentConsent.analytics ? "checked" : ""}>
              <span class="cookie-slider"></span>
            </label>
            <div class="cookie-category-info">
              <h3>Analytics Cookies</h3>
              <p>These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously.</p>
            </div>
          </div>
        </div>

        <div class="cookie-category">
          <div class="cookie-category-header">
            <label class="cookie-switch">
              <input type="checkbox" id="cookie-marketing" ${currentConsent.marketing ? "checked" : ""}>
              <span class="cookie-slider"></span>
            </label>
            <div class="cookie-category-info">
              <h3>Identification Cookies</h3>
              <p>These cookies help us understand how you use our documentation and allow us to recognize you across visits. We use this data to improve your experience and help you get the most value from our products.</p>
            </div>
          </div>
        </div>

      </div>
      <div class="cookie-dialog-footer">
        <button class="cookie-btn cookie-btn-secondary" onclick="window.rejectAllCookies()">Reject All</button>
        <button class="cookie-btn cookie-btn-primary" onclick="window.savePreferences()">Save Preferences</button>
      </div>
    `;

    dialogOverlay.appendChild(dialog);
    document.body.appendChild(dialogOverlay);

    // Make functions globally available
    window.hidePreferencesDialog = hidePreferencesDialog;

    window.rejectAllCookies = function () {
      const consent = {
        necessary: true,
        analytics: false,
        marketing: false,
      };
      applyConsent(consent);
      hidePreferencesDialog();
    };

    window.savePreferences = function () {
      const consent = {
        necessary: true,
        analytics: document.getElementById("cookie-analytics").checked,
        marketing: document.getElementById("cookie-marketing").checked,
      };
      applyConsent(consent);
      hidePreferencesDialog();
    };
  }

  function hidePreferencesDialog() {
    const dialogOverlay = document.querySelector(".cookie-dialog-overlay");
    if (dialogOverlay) dialogOverlay.remove();
  }

  // Add styles
  const style = document.createElement("style");
  style.textContent = `

    .cookie-banner {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #1a1a1a;
      color: #ffffff;
      padding: 1.5rem;
      z-index: 9999;
      box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
    }

    .cookie-banner-content {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 2rem;
      flex-wrap: wrap;
    }

    .cookie-banner-text {
      flex: 1;
      min-width: 300px;
    }

    .cookie-banner-text p {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
    }

    .cookie-banner-actions {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .cookie-btn {
      padding: 0.5rem 1.5rem;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .cookie-btn-primary {
      background: #6b7280;
      color: #ffffff;
    }

    .cookie-btn-primary:hover {
      background: #4b5563;
    }

    .cookie-btn-secondary {
      background: transparent;
      color: #ffffff;
      border: 1px solid #6b7280;
    }

    .cookie-btn-secondary:hover {
      background: #6b7280;
    }

    /* Dialog-specific button styles */
    .cookie-dialog-footer .cookie-btn-secondary {
      color: #6b7280;
      border-color: #6b7280;
    }

    .cookie-dialog-footer .cookie-btn-secondary:hover {
      color: #ffffff;
      background: #6b7280;
    }

    .cookie-dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .cookie-dialog {
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      max-width: 600px;
      width: 100%;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .cookie-dialog-header {
      padding: 1.5rem;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .cookie-dialog-header h2 {
      margin: 0;
      font-size: 1.5rem;
      color: #1a1a1a;
    }

    .cookie-dialog-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      color: #6b7280;
      cursor: pointer;
      padding: 0;
      width: 2rem;
      height: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .cookie-dialog-close:hover {
      background: #f3f4f6;
    }

    .cookie-dialog-body {
      padding: 1.5rem;
      overflow-y: auto;
      flex: 1;
    }

    .cookie-dialog-body > p {
      margin: 0 0 1.5rem 0;
      color: #6b7280;
      line-height: 1.5;
    }

    .cookie-category {
      margin-bottom: 1.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid #e5e7eb;
    }

    .cookie-category:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }

    .cookie-category-header {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
    }

    .cookie-category-info {
      flex: 1;
    }

    .cookie-category-info h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1.1rem;
      color: #1a1a1a;
    }

    .cookie-category-info p {
      margin: 0;
      color: #6b7280;
      font-size: 14px;
      line-height: 1.5;
    }

    .cookie-switch {
      position: relative;
      display: inline-block;
      width: 48px;
      height: 24px;
      flex-shrink: 0;
    }

    .cookie-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .cookie-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #e5e7eb;
      transition: .4s;
      border-radius: 24px;
    }

    .cookie-slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }

    .cookie-switch input:checked + .cookie-slider {
      background-color: #6b7280;
    }

    .cookie-switch input:checked + .cookie-slider:before {
      transform: translateX(24px);
    }

    .cookie-switch input:disabled + .cookie-slider {
      background-color: #9ca3af;
      cursor: not-allowed;
    }

    .cookie-dialog-footer {
      padding: 1.5rem;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
    }

    @media (max-width: 640px) {
      .cookie-banner-content {
        flex-direction: column;
        align-items: stretch;
      }

      .cookie-banner-actions {
        justify-content: stretch;
      }

      .cookie-btn {
        flex: 1;
      }

      .cookie-dialog {
        margin: 1rem;
      }
    }
  `;
  document.head.appendChild(style);
})();
