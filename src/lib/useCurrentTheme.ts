"use client";

import { useState, useEffect } from "react";

export function useCurrentTheme(): "dark" | "light" {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const update = () => {
      const docTheme = document.documentElement.dataset.theme;
      if (docTheme === "dark") {
        setTheme("dark");
      } else if (docTheme === "light") {
        setTheme("light");
      } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        setTheme(prefersDark ? "dark" : "light");
      }
    };

    update();

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "data-theme") {
          update();
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  return theme;
}
