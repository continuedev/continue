import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const openGUITypes = [
  "highlightedCode",
  "newSessionWithPrompt",
  "focusContinueInput",
  "focusContinueInputWithoutClear",
  "newSession",
];

export const useNavigationListener = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const listener = (e) => {
      if(openGUITypes.includes(e.data.type)) {
        
        navigate("/");
        setTimeout(() => {
          window.postMessage(e.data, "*");
        }, 200);
      }

      if(e.data.type === "viewHistory") {
        // Toggle the history page / main page
        if (location.pathname === "/history") {
          navigate("/");
        } else {
          navigate("/history");
        }
      }
    };

    window.addEventListener("message", listener);

    return () => {
      window.removeEventListener("message", listener);
    };
  }, [navigate]);
}
