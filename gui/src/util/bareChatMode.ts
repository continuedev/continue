import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { defaultModelSelector } from '../redux/selectors/modelSelectors'; // Adjust this import path as needed

export function isBareChatMode() {
  const defaultModel = useSelector(defaultModelSelector);

  return useMemo(
    () => defaultModel?.title?.toLowerCase().includes("aider"),
    [defaultModel]
  );
}
