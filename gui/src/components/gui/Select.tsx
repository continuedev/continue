// export const Select = styled.select`
//   padding: 8px 12px;
//   border-radius: ${defaultBorderRadius};
//   border: 1px solid ${vscInputBorder};
//   background-color: ${vscBackground};
//   color: ${vscForeground};

import {
  vscCommandCenterInactiveBorder,
  vscForeground,
  vscInputBackground,
} from "..";
import { cn } from "../../util/cn";

//   appearance: none;
//   -webkit-appearance: none;
//   -moz-appearance: none;
//   padding-right: 30px;
//   background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 6"><path fill="currentColor" d="M0 0l5 5 5-5Z"/></svg>')
//     no-repeat right 10px center;
//   background-size: 10px 10px;
// `;

// // gui/src/components/gui/Select.tsx
// import React from 'react';

export const Select: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement>
> = ({ className, ...props }) => (
  <div
    style={{
      color: vscForeground,
    }}
  >
    <select
      {...props}
      className={cn("rounded-default border px-3 py-1.5", className)}
      style={{
        borderColor: vscCommandCenterInactiveBorder,
        backgroundColor: vscInputBackground,
        color: vscForeground,
        appearance: "none",
        WebkitAppearance: "none",
        MozAppearance: "none",
        paddingRight: "30px",
        background: `url('data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 6"><path fill="${encodeURIComponent(vscForeground)}" d="M0 0l5 5 5-5Z"/></svg>') no-repeat right 10px center`,
        backgroundSize: "10px 10px",
      }}
    >
      {props.children}
    </select>
  </div>
);
