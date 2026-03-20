"use client";

import { useEffect } from "react";

export function OSAutoDetect() {
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isWindows = ua.includes("win");
    const isMac = ua.includes("mac");
    const isLinux = ua.includes("linux");

    let tabIndex = 2; // default: npm
    if (isMac || isLinux) tabIndex = 0;
    else if (isWindows) tabIndex = 1;

    const tabButtons = document.querySelectorAll('[role="tablist"] button');
    if (tabButtons[tabIndex]) {
      (tabButtons[tabIndex] as HTMLButtonElement).click();
    }
  }, []);

  return null;
}
