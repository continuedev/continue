import React, { useState } from "react";

const AdvancedPage = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [counter, setCounter] = useState(0);

  const toggleDarkMode = () => {
    setIsDarkMode((prevMode) => !prevMode);
  };

  return (
    <div
      className={`${isDarkMode ? "bg-gray-800 text-white" : "bg-white text-black"} min-h-screen p-4`}
    >
      <header className="mb-4 flex items-center justify-between border-b-2 pb-4">
        {" "}
        <button
          className="rounded bg-blue-500 px-4 py-2 text-white"
          onClick={toggleDarkMode}
        >
          Toggle Dark Mode
        </button>
      </header>

      <main className="flex flex-col items-center">
        <div className="mb-4">
          <p className="text-xl">
            Counter: <span className="font-bold">{counter}</span>
          </p>

          <button
            className="mt-2 rounded bg-green-500 px-4 py-2 text-white"
            onClick={() => setCounter(counter + 1)}
          >
            Increment
          </button>
        </div>

        <div>
          <p className="mb-2">Some other interactive elements:</p>
          <input
            type="text"
            placeholder="Type something here..."
            className="mb-2 rounded border p-2"
          />
          <div>
            <select className="rounded border p-2">
              <option value="option1">Option 1</option>
              <option value="option2">Option 2</option>
              <option value="option3">Option 3</option>
            </select>
          </div>
        </div>
      </main>

      <footer className="mt-4 border-t-2 pt-4">
        <p className="text-center">
          &copy; 2023 Advanced Page. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default AdvancedPage;
