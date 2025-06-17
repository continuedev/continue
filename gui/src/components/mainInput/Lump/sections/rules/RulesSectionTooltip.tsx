// gui/src/components/mainInput/Lump/sections/rules/RulesSectionTooltip.tsx
export const RulesSectionTooltip = () => (
  <div className="max-w-xs">
    <p className="m-0 p-0">
      <span className="font-bold">Rules</span> allow you to control how coding
      standards and preferences are applied.
    </p>
    <ul className="mb-0 mt-1 pl-4">
      <li>
        <strong>Always</strong>: Rule will always be applied, regardless of
        context
      </li>
      <li>
        <strong>Auto</strong>: Rule will be applied based on file matching
      </li>
      <li>
        <strong>Never</strong>: Rule will never be applied
      </li>
    </ul>
  </div>
);
