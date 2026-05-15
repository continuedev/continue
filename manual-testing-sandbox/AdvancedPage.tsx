import React, { useState, useCallback } from "react";

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Sun icon SVG component for light mode.
 */
const SunIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

/**
 * Moon icon SVG component for dark mode.
 */
const MoonIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

/**
 * Theme toggle button component with persistence to localStorage.
 */
const ThemeToggle = ({
  isDarkMode,
  onToggle,
}: {
  isDarkMode: boolean;
  onToggle: () => void;
}) => (
  <button
    className="rounded bg-blue-500 px-4 py-2 text-white"
    onClick={onToggle}
    aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
    aria-pressed={isDarkMode}
  >
    <span className="flex items-center gap-2">
      {isDarkMode ? <SunIcon /> : <MoonIcon />}
      {isDarkMode ? "Light Mode" : "Dark Mode"}
    </span>
  </button>
);

/**
 * Load dark mode preference from localStorage on initial render.
 */
const useLocalStorageDarkMode = (): [boolean, () => void] => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      const stored = localStorage.getItem("darkMode");
      return stored === "true";
    } catch {
      return false;
    }
  });

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("darkMode", String(next));
      } catch {
        // localStorage not available
      }
      return next;
    });
  }, []);

  return [isDarkMode, toggleDarkMode];
};

/**
 * Counter display and increment button component.
 */
const CounterDisplay = ({
  counter,
  onIncrement,
}: {
  counter: number;
  onIncrement: () => void;
}) => (
  <div>
    <p className="mb-2 font-medium">Counter</p>
    <p className="text-xl">
      Count:{" "}
      <span className="font-bold" aria-live="polite">
        {counter}
      </span>
    </p>
    <button
      className="mt-2 rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
      onClick={onIncrement}
      aria-label={`Increment counter. Current value: ${counter}`}
    >
      Increment
    </button>
  </div>
);

/**
 * Search input component.
 */
const SearchInput = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="w-full">
    <label htmlFor="search-input" className="mb-1 block text-sm font-medium">
      Search
    </label>
    <input
      id="search-input"
      type="text"
      placeholder="Type something here..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-describedby="search-help"
    />
    <span id="search-help" className="text-sm text-gray-500">
      Enter text to search
    </span>
  </div>
);

/**
 * Select dropdown component.
 */
const SelectDropdown = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="w-full">
    <label htmlFor="select-dropdown" className="mb-1 block text-sm font-medium">
      Select an option
    </label>
    <select
      id="select-dropdown"
      className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Select an option"
    >
      <option value="option1">Option 1</option>
      <option value="option2">Option 2</option>
      <option value="option3">Option 3</option>
    </select>
  </div>
);

/**
 * Advanced Page component with dark mode and interactive elements.
 */
const AdvancedPage = () => {
  const [isDarkMode, toggleDarkMode] = useLocalStorageDarkMode();
  const [counter, setCounter] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOption, setSelectedOption] = useState("option1");

  const incrementCounter = useCallback(() => {
    setCounter((prevCounter) => prevCounter + 1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleSelectChange = useCallback((value: string) => {
    setSelectedOption(value);
  }, []);

  return (
    <div
      className={`${isDarkMode ? "bg-gray-800 text-white" : "bg-white text-gray-900"} flex min-h-screen flex-col`}
      role="main"
    >
      <header className="mb-4 flex items-center justify-between border-b-2 pb-4">
        <h1 className="text-2xl font-bold">Advanced Page</h1>
        <ThemeToggle isDarkMode={isDarkMode} onToggle={toggleDarkMode} />
      </header>

      <main className="flex flex-grow flex-col items-center gap-8 p-4">
        <CounterDisplay counter={counter} onIncrement={incrementCounter} />

        <section aria-labelledby="interactive-heading">
          <h2 id="interactive-heading" className="mb-4 text-xl font-semibold">
            Interactive Elements
          </h2>
          <div className="flex w-full max-w-md flex-col gap-4">
            <SearchInput value={searchQuery} onChange={handleSearchChange} />
            <SelectDropdown
              value={selectedOption}
              onChange={handleSelectChange}
            />
          </div>
        </section>
      </main>

      <footer className="mt-auto border-t-2 pt-4">
        <p className="text-center">
          &copy; {CURRENT_YEAR} Advanced Page. All rights reserved.
        </p>
        <div className="mt-2 text-sm text-gray-400">
          <p>Search: {searchQuery || "(empty)"}</p>
          <p>Selected: {selectedOption}</p>
        </div>
      </footer>
    </div>
  );
};

export default AdvancedPage;
