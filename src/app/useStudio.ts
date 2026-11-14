import { useEffect, useReducer, useState } from "react";
import { createStudio, type Studio } from "./studio";
export function useStudio() {
  const [, render] = useReducer((n) => n + 1, 0);
  const [studio, setStudio] = useState<Studio | null>(null);
  useEffect(() => {
    const instance = createStudio(render);
    setStudio(instance);
    return () => instance.dispose();
  }, []);
  return studio;
}
