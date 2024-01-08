import { useEffect, useRef } from "react";

function useUpdatingRef(value: any, deps: any[] = []) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value, ...deps]);

  return ref;
}

export default useUpdatingRef;
