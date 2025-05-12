import { useAppSelector } from "../../../../../redux/hooks";

export const ErrorsSectionTooltip = () => {
  const configError = useAppSelector((store) => store.config.configError);

  const numErrors = configError?.length ?? 0;
  const plural = numErrors === 1 ? "" : "s";

  return (
    <div>
      <span>{`${numErrors} Config Error${plural}`}</span>
    </div>
  );
};
