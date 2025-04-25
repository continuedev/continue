import { useAppSelector } from "../../../../../redux/hooks";
import { selectActiveTools } from "../../../../../redux/selectors/selectActiveTools";

export const ToolsSectionTooltip = () => {
  const tools = useAppSelector((store) => store.config.config.tools);
  const activeTools = useAppSelector(selectActiveTools);

  const numTools = tools.length;
  const numActiveTools = activeTools.length;

  return (
    <div>
      <span>{`Tools (${numActiveTools}/${numTools} active)`}</span>
    </div>
  );
};
