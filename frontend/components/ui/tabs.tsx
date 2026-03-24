"use client";

import { ReactNode, useState } from "react";
import { motion } from "framer-motion";

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  children?: (activeTab: string) => ReactNode;
}

export function Tabs({ tabs, defaultTab, onChange, children }: TabsProps) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id || "");

  function handleChange(tabId: string) {
    setActive(tabId);
    onChange?.(tabId);
  }

  return (
    <div>
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-light)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleChange(tab.id)}
            className={`
              relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              transition-colors duration-200 cursor-pointer border-0
              ${active === tab.id
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }
            `}
            style={{ background: "transparent" }}
          >
            {active === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-[var(--bg-elevated)] rounded-lg shadow-[var(--shadow-sm)]"
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {tab.icon}
              {tab.label}
            </span>
          </button>
        ))}
      </div>
      {children && (
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-4"
        >
          {children(active)}
        </motion.div>
      )}
    </div>
  );
}
