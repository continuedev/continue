import { useAppSelector } from "../../redux/hooks";

const StreamError = () => {
  const streamError = useAppSelector((state) => state.session.streamError);

  if (streamError) {
    return null;
  }
  return <div className="flex flex-col px-3">Hello</div>;
};

export default StreamError;
