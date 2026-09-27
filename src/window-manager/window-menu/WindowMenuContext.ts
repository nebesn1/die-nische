import { createContext } from "react";
import type { WindowMenuContextValue } from "./types";

export const WindowMenuContext = createContext<WindowMenuContextValue | null>(null);
