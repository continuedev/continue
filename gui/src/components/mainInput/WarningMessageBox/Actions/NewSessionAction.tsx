import { useAppDispatch } from "../../../../redux/hooks";
import { newSession } from "../../../../redux/slices/sessionSlice";
export default function NewSessionAction() {
  const dispatch = useAppDispatch();
  return (
    <span onClick={() => dispatch(newSession())} className="hover:underline">
      Start a new session
    </span>
  );
}
