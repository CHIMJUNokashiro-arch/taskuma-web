"use client";

import { useRouter } from "next/navigation";

const TABS = [
  { key: "daily", label: "日別" },
  { key: "weekly", label: "週別" },
  { key: "monthly", label: "月別" },
  { key: "yearly", label: "年別" },
] as const;

export default function LogTabNav({ activeTab }: { activeTab: string }) {
  const router = useRouter();

  const handleTabChange = (tab: string) => {
    if (tab === "daily") {
      router.push("/log");
    } else {
      router.push(`/log?view=${tab}`);
    }
  };

  return (
    <div className="mb-6 flex gap-1 rounded-xl bg-navy-800 p-1">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => handleTabChange(tab.key)}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            activeTab === tab.key
              ? "bg-green-accent text-navy-950"
              : "text-gray-400 hover:text-white"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
