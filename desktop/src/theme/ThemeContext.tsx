import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ theme: "dark", toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("cc-theme") as Theme) ?? "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("cc-theme", theme);
  }, [theme]);

  const toggle = () => setTheme(t => t === "dark" ? "light" : "dark");

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
