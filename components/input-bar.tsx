"use client";

import { useState } from "react";
import { ArrowUp, LayoutGrid, Search, X } from "lucide-react";
import CategoryPicker from "./category-picker";
import EntityChip from "./entity-chip";

interface InputBarProps {
  onSubmit: (text: string) => void;
  isLoading?: boolean;
  forceSearchMode?: boolean;
}

export default function InputBar({
  onSubmit,
  isLoading,
  forceSearchMode = false,
}: InputBarProps) {
  const [text, setText] = useState("");
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(forceSearchMode);

  const showEntityChip =
    !isSearchMode && text.toLowerCase().includes("spent");

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text);
      setText("");
      setIsSearchMode(forceSearchMode);
    }
  };

  return (
    <div className="relative">
      {showEntityChip && (
        <div className="absolute -top-11 left-0">
          <EntityChip label="Food" />
        </div>
      )}

      <div className="flex w-full items-center rounded-full border border-[#f1f5f9] bg-white px-2 py-1.5 shadow-md shadow-black/5">
        <button
          onClick={() =>
            isSearchMode ? setIsSearchMode(false) : setIsPickerVisible(true)
          }
          className="grid h-10 w-10 shrink-0 place-items-center"
          aria-label="Toggle mode"
        >
          {isSearchMode ? (
            <X size={22} className="text-[#64748b]" />
          ) : (
            <LayoutGrid size={22} className="text-[#64748b]" />
          )}
        </button>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmit()}
          placeholder={
            isSearchMode ? "Ask your mind anything..." : "What's on your mind?"
          }
          className="h-10 min-w-0 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-[#94a3b8]"
        />

        {!isSearchMode && text.length === 0 && (
          <button
            onClick={() => setIsSearchMode(true)}
            className="grid h-10 w-10 shrink-0 place-items-center"
            aria-label="Switch to search"
          >
            <Search size={22} className="text-[#64748b]" />
          </button>
        )}

        <button
          onClick={handleSubmit}
          disabled={!text.trim() || isLoading}
          className={`ml-2 grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors ${
            isSearchMode
              ? "bg-indigo-500"
              : text.trim()
                ? "bg-[#0f172a]"
                : "bg-[#f1f5f9]"
          } disabled:opacity-70`}
          aria-label={isSearchMode ? "Search" : "Log"}
        >
          {isSearchMode ? (
            <Search size={18} className="text-white" />
          ) : (
            <ArrowUp
              size={18}
              className={text.trim() ? "text-white" : "text-[#94a3b8]"}
            />
          )}
        </button>
      </div>

      <CategoryPicker
        visible={isPickerVisible}
        onClose={() => setIsPickerVisible(false)}
      />
    </div>
  );
}
