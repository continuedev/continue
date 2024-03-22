import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';

function useUIConfig() {
  return useSelector((store: RootState) => store.state.config.ui);
}

export default useUIConfig;
