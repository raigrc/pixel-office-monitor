"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { FloorDTO } from "@/lib/monitor-store";
import { formatProject, formatSince } from "@/lib/format";
import FloorPreview from "./FloorPreview";

const BREAKPOINT_DESKTOP = 1024;
const BREAKPOINT_TABLET = 768;

type FloorContextMenuProps = {
  contextMenu: { floor: FloorDTO | null; x: number; y: number } | null;
  pinnedFloors: Set<string>;
  onPin: (sessionID: string) => void;
  onClose: (sessionID: string) => void;
  onCopy: (sessionID: string) => void;
  onRename: (sessionID: string, title: string) => Promise<void>;
  onRenameAvailable: boolean;
  onCloseMenu: () => void;
};

function FloorContextMenu({
  contextMenu,
  pinnedFloors,
  onPin,
  onClose,
  onCopy,
  onRename,
  onRenameAvailable,
  onCloseMenu,
}: FloorContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusedMenuIndex, setFocusedMenuIndex] = useState(0);

  // Focus first item on mount
  useEffect(() => {
    menuRef.current?.focus();
  }, []);

  if (!contextMenu || !contextMenu.floor) return null;
  const { floor, x, y } = contextMenu;
  const isPinned = pinnedFloors.has(floor.sessionID);

  // Auto-flip logic
  const menuWidth = 200;
  const menuHeight = 180;
  const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x;
  const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y;

  const menuItems = [
    {
      label: isPinned ? "Unpin" : "Pin",
      onClick: () => { onPin(floor.sessionID); onCloseMenu(); },
      icon: (
        <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 17v5" />
          <path d="M19 14v-3.54a4 4 0 0 0-1.07-2.82 4 4 0 0 1-6.86 0A4 4 0 0 0 5 10.46V14" />
          <path d="M3 14h18" />
        </svg>
      ),
      className: "text-[#F1F5F9] hover:bg-[#24324D]",
    },
    {
      label: "Close",
      onClick: () => { onClose(floor.sessionID); onCloseMenu(); },
      icon: (
        <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      ),
      className: "text-[#EF4444] hover:bg-[#EF4444]/10",
    },
    {
      label: "Copy Session ID",
      onClick: () => { onCopy(floor.sessionID); onCloseMenu(); },
      icon: (
        <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      ),
      className: "text-[#F1F5F9] hover:bg-[#24324D]",
    },
  ];

  if (onRenameAvailable) {
    menuItems.push({
      label: "Rename",
      onClick: async () => {
        const newTitle = prompt("Rename floor:", floor.title || "");
        if (newTitle && newTitle.trim() && newTitle !== floor.title) {
          await onRename(floor.sessionID, newTitle.trim().slice(0, 50));
        }
        onCloseMenu();
      },
      icon: (
        <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
      className: "text-[#F1F5F9] hover:bg-[#24324D]",
    });
  }

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    const maxIndex = menuItems.length - 1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedMenuIndex((prev) => Math.min(maxIndex, prev + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedMenuIndex((prev) => Math.max(0, prev - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      menuItems[focusedMenuIndex].onClick();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCloseMenu();
    } else if (e.key === "Tab") {
      e.preventDefault();
      setFocusedMenuIndex((prev) => (e.shiftKey ? Math.max(0, prev - 1) : Math.min(maxIndex, prev + 1)));
    }
  };

  return (
    <div
      ref={menuRef}
      tabIndex={-1}
      onKeyDown={handleMenuKeyDown}
      className="fixed z-[100] min-w-[200px] rounded-[6px] border-2 border-[#334155] bg-[#1E293B] shadow-[0_8px_24px_rgba(0,0,0,0.4)] py-1.5 outline-none"
      style={{
        left: adjustedX,
        top: adjustedY,
      }}
      role="menu"
      aria-label="Floor actions"
    >
      {menuItems.map((item, idx) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={item.onClick}
          className={`flex w-full items-center gap-2 px-3 py-2 text-[13px] ${item.className} transition-colors ${idx === focusedMenuIndex ? "bg-[#3B82F6]/20 ring-1 ring-inset ring-[#3B82F6]" : ""}`}
          style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
          tabIndex={idx === focusedMenuIndex ? 0 : -1}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

type FloorSwitcherProps = {
  floors: FloorDTO[];
  activeId: string | null;
  onSelect: (id: string) => void;
  pinnedFloors: Set<string>;
  onPin: (sessionID: string) => void;
  onClose: (sessionID: string) => void;
  onRename?: (sessionID: string, title: string) => Promise<void>;
  sseStatus?: "connecting" | "live" | "reconnecting" | "offline";
  isBottomSheetOpen?: boolean;
  onBottomSheetChange?: (open: boolean) => void;
  followActivity?: boolean;
  onFollowActivityChange?: (enabled: boolean) => void;
  desktopOpen?: boolean;
  onDesktopClose?: () => void;
};

export default function FloorSwitcher({
  floors,
  activeId,
  onSelect,
  pinnedFloors,
  onPin,
  onClose,
  onRename,
  sseStatus = "connecting",
  isBottomSheetOpen: controlledIsOpen,
  onBottomSheetChange,
  followActivity = false,
  onFollowActivityChange,
  desktopOpen = true,
  onDesktopClose,
}: FloorSwitcherProps) {
  const [layout, setLayout] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [previewFloor, setPreviewFloor] = useState<FloorDTO | null>(null);
  const [previewPosition, setPreviewPosition] = useState<{ x: number; y: number } | null>(null);
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search/filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearchRef = useRef<NodeJS.Timeout | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    floor: FloorDTO | null;
    x: number;
    y: number;
  } | null>(null);

  // Drag-to-reorder state (desktop only)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // Lazy initializer reads from localStorage on client-side only
  const [floorOrder, setFloorOrder] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("pixel:floorOrder");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {
        // ignore parse errors
      }
    }
    return [];
  });

  // Inline title editing state
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Bottom sheet swipe gesture state
  const [sheetDragOffset, setSheetDragOffset] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const sheetContentRef = useRef<HTMLDivElement>(null);
  const bottomSheetHeightRef = useRef(0);

  // Filter floors based on search query
  const filteredFloors = useCallback(() => {
    if (!searchQuery.trim()) return floors;
    const query = searchQuery.toLowerCase().trim();
    return floors.filter(
      (floor) =>
        floor.project.toLowerCase().includes(query) ||
        floor.sessionID.toLowerCase().includes(query) ||
        floor.title?.toLowerCase().includes(query)
    );
  }, [floors, searchQuery]);

  // Persist floor order to localStorage
  useEffect(() => {
    if (floorOrder.length > 0) {
      localStorage.setItem("pixel:floorOrder", JSON.stringify(floorOrder));
    }
  }, [floorOrder]);

  // Apply custom floor order to filtered floors
  const orderedFloors = useCallback(() => {
    const filtered = filteredFloors();
    if (floorOrder.length === 0) return filtered;
    const orderMap = new Map(floorOrder.map((id, idx) => [id, idx]));
    return [...filtered].sort((a, b) => {
      const aIdx = orderMap.get(a.sessionID) ?? Infinity;
      const bIdx = orderMap.get(b.sessionID) ?? Infinity;
      return aIdx - bIdx;
    });
  }, [filteredFloors, floorOrder]);

  // Handle search input with debounce
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debouncedSearchRef.current) clearTimeout(debouncedSearchRef.current);
    debouncedSearchRef.current = setTimeout(() => {
      // Reset focused index when search changes
      setFocusedIndex(0);
    }, 150);
  }, []);

  // Handle keyboard shortcuts (Cmd/Ctrl+K for search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (modifier && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (contextMenu) setContextMenu(null);
        if (searchFocused) searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [contextMenu, searchFocused]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debouncedSearchRef.current) clearTimeout(debouncedSearchRef.current);
    };
  }, []);

  // Support both controlled and uncontrolled modes
  const isBottomSheetOpen = controlledIsOpen ?? uncontrolledIsOpen;
  const setIsBottomSheetOpen = useCallback(
    (open: boolean) => {
      if (controlledIsOpen === undefined) {
        setUncontrolledIsOpen(open);
      }
      onBottomSheetChange?.(open);
    },
    [controlledIsOpen, onBottomSheetChange]
  );

  // Update layout on resize
  useEffect(() => {
    const updateLayout = () => {
      const width = window.innerWidth;
      if (width >= BREAKPOINT_DESKTOP) setLayout("desktop");
      else if (width >= BREAKPOINT_TABLET) setLayout("tablet");
      else setLayout("mobile");
    };
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  // Swipe from bottom edge to open bottom sheet (mobile only)
  useEffect(() => {
    if (layout !== "mobile") return;
    const touchStartRef = { current: null as number | null };

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      // Detect swipe from bottom edge (last 20px)
      if (touch.clientY > window.innerHeight - 20) {
        touchStartRef.current = touch.clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartRef.current === null) return;
      const touch = e.touches[0];
      // Swipe up from bottom edge
      if (touch.clientY < touchStartRef.current - 50) {
        setIsBottomSheetOpen(true);
        touchStartRef.current = null;
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [layout, setIsBottomSheetOpen]);

  // Sync focusedIndex with activeId
  useEffect(() => {
    // Intentional sync: keep focused index in sync with active floor
    if (activeId) {
      const idx = floors.findIndex((f) => f.sessionID === activeId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (idx >= 0) setFocusedIndex(idx);
    }
  }, [activeId, floors]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const maxIndex = floors.length - 1;
      let newIndex = focusedIndex;

      if (layout === "desktop") {
        // Vertical: Up/Down
        if (e.key === "ArrowUp") {
          e.preventDefault();
          newIndex = Math.max(0, focusedIndex - 1);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          newIndex = Math.min(maxIndex, focusedIndex + 1);
        }
      } else {
        // Horizontal: Left/Right
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          newIndex = Math.max(0, focusedIndex - 1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          newIndex = Math.min(maxIndex, focusedIndex + 1);
        }
      }

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(floors[focusedIndex].sessionID);
      } else if (e.key === "Escape" && layout === "mobile") {
        setIsBottomSheetOpen(false);
      }

      if (newIndex !== focusedIndex) {
        setFocusedIndex(newIndex);
        tabRefs.current[newIndex]?.focus();
      }
    },
    [floors, focusedIndex, layout, onSelect, setIsBottomSheetOpen]
  );

  // Handle hover for preview
  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, floor: FloorDTO) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const isMobile = layout === "mobile";
      setPreviewFloor(floor);
      setPreviewPosition({
        x: rect.left + rect.width / 2,
        y: isMobile ? rect.bottom : rect.top,
      });
    },
    [layout]
  );

  const handleMouseLeave = useCallback(() => {
    setPreviewFloor(null);
    setPreviewPosition(null);
  }, []);

  const handlePinClick = useCallback(
    (e: React.MouseEvent, sessionID: string) => {
      e.stopPropagation();
      onPin(sessionID);
    },
    [onPin]
  );

  const handleCloseClick = useCallback(
    (e: React.MouseEvent, sessionID: string) => {
      e.stopPropagation();
      onClose(sessionID);
    },
    [onClose]
  );

  // Context menu handlers
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, floor: FloorDTO) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        floor,
        x: e.clientX,
        y: e.clientY,
      });
    },
    []
  );

  const handlePinFromMenu = useCallback(() => {
    if (contextMenu?.floor) {
      onPin(contextMenu.floor.sessionID);
      setContextMenu(null);
    }
  }, [contextMenu, onPin]);

  const handleCloseFromMenu = useCallback(() => {
    if (contextMenu?.floor) {
      onClose(contextMenu.floor.sessionID);
      setContextMenu(null);
    }
  }, [contextMenu, onClose]);

  const handleCopySessionID = useCallback(() => {
    if (contextMenu?.floor) {
      navigator.clipboard.writeText(contextMenu.floor.sessionID);
      // Could add toast here - for now just close menu
      setContextMenu(null);
    }
  }, [contextMenu]);

  const handleRenameFromMenu = useCallback(async () => {
    if (contextMenu?.floor && onRename) {
      const newTitle = prompt("Rename floor:", contextMenu.floor.title || "");
      if (newTitle && newTitle.trim() && newTitle !== contextMenu.floor.title) {
        await onRename(contextMenu.floor.sessionID, newTitle.trim().slice(0, 50));
      }
      setContextMenu(null);
    }
  }, [contextMenu, onRename]);

  // Keyboard handler for context menu (Shift+F10 or Menu key)
  const handleKeyDownTab = useCallback(
    (e: React.KeyboardEvent, floor: FloorDTO, _index: number) => {
      // Open context menu with Shift+F10 or Menu key
      if (e.key === "F10" && e.shiftKey) {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        setContextMenu({
          floor,
          x: rect.left,
          y: rect.bottom,
        });
      } else if (e.key === "ContextMenu") {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        setContextMenu({
          floor,
          x: rect.left,
          y: rect.bottom,
        });
      }
      // Delegate to main keyboard handler for navigation
      handleKeyDown(e);
      void _index;
    },
    [handleKeyDown]
  );

  // Drag-and-drop handlers (desktop only)
  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      if (layout !== "desktop") return;
      setDraggedIndex(index);
      e.dataTransfer.effectAllowed = "move";
      // Create a ghost image (optional - browser default works)
      (e.currentTarget as HTMLElement).style.opacity = "0.5";
    },
    [layout]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      if (layout !== "desktop" || draggedIndex === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (index !== draggedIndex) {
        setDragOverIndex(index);
      }
    },
    [layout, draggedIndex]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (layout !== "desktop") return;
      // Only clear if leaving the same element (not entering a child)
      if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) {
        setDragOverIndex(null);
      }
    },
    [layout]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      if (layout !== "desktop" || draggedIndex === null || draggedIndex === targetIndex) {
        setDraggedIndex(null);
        setDragOverIndex(null);
        return;
      }
      e.preventDefault();

      const ordered = orderedFloors();
      const draggedFloor = ordered[draggedIndex];
      const newOrder = [...ordered];
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedFloor);

      // Update floorOrder state with sessionIDs in new order
      const newFloorOrder = newOrder.map((f) => f.sessionID);
      setFloorOrder(newFloorOrder);

      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [layout, draggedIndex, orderedFloors]
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      if (layout !== "desktop") return;
      (e.currentTarget as HTMLElement).style.opacity = "1";
      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [layout]
  );

  // Inline title editing handlers
  const startEditing = useCallback((floor: FloorDTO) => {
    setEditingFloorId(floor.sessionID);
    setEditValue(floor.title?.trim() || "");
    // Focus the input on next tick
    setTimeout(() => editInputRef.current?.focus(), 0);
  }, []);

  const saveEditing = useCallback(async () => {
    if (!editingFloorId || !onRename) {
      setEditingFloorId(null);
      return;
    }
    const trimmed = editValue.trim().slice(0, 50);
    if (trimmed) {
      await onRename(editingFloorId, trimmed);
    }
    setEditingFloorId(null);
    setEditValue("");
  }, [editingFloorId, editValue, onRename]);

  const cancelEditing = useCallback(() => {
    setEditingFloorId(null);
    setEditValue("");
  }, []);

  const renderTab = (floor: FloorDTO, index: number) => {
    const isActive = floor.sessionID === activeId;
    const isPinned = pinnedFloors.has(floor.sessionID);
    const isWorking = floor.status === "working";
    const label = floor.title?.trim() ? floor.title.trim().slice(0, 32) : formatProject(floor.project);
    const shortId = floor.sessionID.slice(0, 6);
    const agentCount = floor.cubicles.length;
    const lastActivity = formatSince(floor.updatedAt);
    const isEditing = editingFloorId === floor.sessionID;

    const isDragging = draggedIndex === index;
    const isDragOver = dragOverIndex === index && draggedIndex !== null && draggedIndex !== index;

    const baseClasses = [
      "group relative flex min-h-[64px] w-full items-center gap-3 rounded-[6px] border-2 px-3 py-2.5 text-left transition-all duration-200 cursor-pointer",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]",
      layout === "desktop"
        ? "justify-start"
        : "justify-between min-w-[200px] shrink-0",
      isDragging ? "opacity-50" : "",
      isDragOver ? "ring-2 ring-[#3B82F6] ring-offset-2 ring-offset-[#0F172A] -translate-y-0.5" : "",
    ];

    const stateClasses = isActive
      ? "bg-[#24324D] ring-1 ring-[#3B82F6]/30 shadow-[0_0_8px_rgba(59,130,246,0.15)]"
      : "bg-[#1E293B] hover:bg-[#24324D] hover:border-[#475569] hover:shadow-[0_0_8px_rgba(59,130,246,0.08)]";

    const dragProps = layout === "desktop" ? {
      draggable: true,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, index),
      onDragOver: (e: React.DragEvent) => handleDragOver(e, index),
      onDragLeave: (e: React.DragEvent) => handleDragLeave(e),
      onDrop: (e: React.DragEvent) => handleDrop(e, index),
      onDragEnd: handleDragEnd,
      onContextMenu: (e: React.MouseEvent) => handleContextMenu(e, floor),
      onKeyDown: (e: React.KeyboardEvent) => handleKeyDownTab(e, floor, index),
    } : {
      onContextMenu: (e: React.MouseEvent) => handleContextMenu(e, floor),
      onKeyDown: (e: React.KeyboardEvent) => handleKeyDownTab(e, floor, index),
    };

    const handleTitleDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (onRename) startEditing(floor);
    };

    const handleEditKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveEditing();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEditing();
      }
    };

    const handleEditBlur = () => {
      // Small delay to allow click on save button if we add one later
      setTimeout(saveEditing, 100);
    };

    return (
      <button
        key={floor.sessionID}
        ref={(el) => { tabRefs.current[index] = el; }}
        role={layout === "desktop" ? "menuitem" : "tab"}
        aria-selected={isActive}
        aria-label={`Floor ${label} ${shortId}, ${floor.status}, ${agentCount} agents${isPinned ? ", pinned" : ""}`}
        onClick={() => !isEditing && onSelect(floor.sessionID)}
        onMouseEnter={(e) => handleMouseEnter(e, floor)}
        onMouseLeave={handleMouseLeave}
        className={ [...baseClasses, stateClasses].filter(Boolean).join(" ") }
        style={{ borderColor: isActive ? "#3B82F6" : isPinned ? "#FBBF24" : "#334155" }}
        tabIndex={index === focusedIndex ? 0 : -1}
        {...dragProps}
      >
        {/* Status dot with pulse if working */}
        <span
          aria-hidden="true"
          className={[
            "inline-block shrink-0 h-2.5 w-2.5 rounded-full border",
            isWorking
              ? "bg-[#22C55E] border-[#22C55E] shadow-[0_0_6px_rgba(34,197,94,0.6)] animate-working"
              : "bg-[#64748B] border-[#475569]",
          ].join(" ")}
        />

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-1 leading-none">
          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleEditKeyDown}
              onBlur={handleEditBlur}
              className="w-full h-6 rounded-[3px] bg-[#0B1220] border border-[#3B82F6] px-2 text-[14px] text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#3B82F6] focus:border-transparent"
              style={{ fontFamily: "var(--font-vt), VT323, monospace", lineHeight: "14px" }}
              maxLength={50}
              placeholder="Floor title"
              aria-label="Edit floor title"
            />
          ) : (
            <span
              className="truncate text-[14px] font-normal tracking-wide text-[#F1F5F9] cursor-text"
              style={{ fontFamily: "var(--font-vt), VT323, monospace", lineHeight: "14px" }}
              title={label}
              onDoubleClick={handleTitleDoubleClick}
            >
              {label}
            </span>
          )}
          <div className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
            <span style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
              {shortId}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full border border-[#334155] bg-[#0B1220]/50 px-1.5 py-0.5"
              style={{ fontFamily: "var(--font-pixel), monospace", fontSize: "7px" }}
            >
              {agentCount} agents
            </span>
            <span
              className="hidden sm:inline-flex tracking-widest"
              style={{ fontFamily: "var(--font-pixel), monospace", fontSize: "7px" }}
            >
              {lastActivity}
            </span>
          </div>
        </div>

        {/* Actions: Pin + Close */}
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => handlePinClick(e, floor.sessionID)}
            className={[
              "inline-flex items-center justify-center h-7 w-7 rounded-[4px] transition-colors duration-200",
              "hover:bg-[#24324D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]",
              isPinned
                ? "text-[#FBBF24] bg-[#FBBF24]/10"
                : "text-[#64748B] hover:text-[#F1F5F9]",
            ].join(" ")}
            aria-label={isPinned ? "Unpin floor" : "Pin floor"}
            aria-pressed={isPinned}
          >
            <svg
              className={`h-4 w-4 ${isPinned ? "fill-current" : ""}`}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 17v5" />
              <path d="M19 14v-3.54a4 4 0 0 0-1.07-2.82 4 4 0 0 1-6.86 0A4 4 0 0 0 5 10.46V14" />
              <path d="M3 14h18" />
            </svg>
          </span>

          {/* Close button moved outside nested structure - use span with role button */}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => handleCloseClick(e, floor.sessionID)}
            className="inline-flex items-center justify-center h-7 w-7 rounded-[4px] text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF4444]"
            aria-label="Close floor"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </span>
        </div>

        {/* Active indicator for desktop */}
        {layout === "desktop" && isActive && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 h-8 w-[3px] rounded-r-[3px] bg-[#3B82F6] opacity-80"
          />
        )}
      </button>
    );
  };
  const floorsToRender = orderedFloors();
  const hasSearchResults = searchQuery.trim() ? floorsToRender.length > 0 : true;

  // Empty/loading skeleton
  if (!floors || floors.length === 0) {
    return (
      <div
        className={[
          "flex gap-2",
          layout === "desktop"
            ? "fixed left-0 top-14 z-30 h-[calc(100dvh-3.5rem)] w-64 flex-col overflow-y-auto border-r-2 border-[#334155] bg-[#0F172A]/95 px-2 py-3"
            : "flex-row overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory",
        ].join(" ")}
        role="tablist"
        aria-label="Office floors"
        style={{ scrollbarWidth: "thin" }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={[
              "animate-pulse rounded-[6px] border-2 bg-[#1E293B]",
              layout === "desktop"
                ? "min-h-[64px] w-full"
                : "min-h-[64px] min-w-[200px] shrink-0 snap-start",
            ].join(" ")}
            style={{ borderColor: "#334155" }}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  // Desktop: Vertical sidebar (collapsible overlay — scene fills viewport underneath)
  if (layout === "desktop" && desktopOpen === false) {
    return null;
  }

  if (layout === "desktop") {
    return (
      <>
        <div
          ref={containerRef}
          className="fixed left-0 top-14 z-30 flex h-[calc(100dvh-3.5rem)] w-64 flex-col gap-2 overflow-y-auto border-r-2 border-[#334155] bg-[#0F172A]/95 px-2 py-3"
          style={{
            boxShadow: "2px 0 0 #334155",
            backgroundImage: "url('/sprites/wall-tile.png')",
            backgroundRepeat: "repeat-y",
            backgroundSize: "32px 32px",
            imageRendering: "pixelated",
          }}
          role="navigation"
          aria-label="Office floors"
        >
          <div className="flex items-center gap-2 px-2 py-1 text-[10px] font-bold tracking-widest text-[#475569]" style={{ fontFamily: "var(--font-pixel), monospace" }}>
            FLOORS
            <button
              type="button"
              onClick={() => onDesktopClose?.()}
              className="ml-auto rounded px-1.5 py-0.5 text-[#94A3B8] hover:text-[#F1F5F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] cursor-pointer"
              aria-label="Hide floor panel"
            >
              ✕
            </button>
          </div>

          {/* Search input */}
          <div className="relative px-2 pb-2">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475569] pointer-events-none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search floors..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full h-8 rounded-[4px] border bg-[#0B1220] px-8 py-1 text-[12px] text-[#F1F5F9] placeholder:text-[#475569] focus:outline-none focus:ring-1 focus:ring-[#3B82F6] focus:border-transparent transition-all"
              style={{
                fontFamily: "var(--font-inter), Inter, sans-serif",
                borderColor: searchFocused ? "#3B82F6" : "#334155",
              }}
              aria-label="Search floors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-[3px] text-[#64748B] hover:text-[#F1F5F9] hover:bg-[#24324D] transition-colors"
                aria-label="Clear search"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-1.5" role="menu">
            {!hasSearchResults ? (
              <div className="flex items-center justify-center h-24 text-[#64748B] text-[12px]" style={{ fontFamily: "var(--font-pixel), monospace" }}>
                No floors match
              </div>
            ) : (
              floorsToRender.map((floor, i) => renderTab(floor, i))
            )}
          </div>

          {/* Connection indicator at bottom */}
          <div className="mt-auto flex flex-col gap-2 border-t border-[#334155]/30 pt-3">
            <div className="flex items-center gap-2 px-2 text-[10px] tracking-widest" style={{ fontFamily: "var(--font-pixel), monospace" }}>
              <span
                className={[
                  "inline-block h-2 w-2 rounded-full",
                  sseStatus === "live" ? "bg-[#22C55E] animate-working" :
                  sseStatus === "reconnecting" ? "bg-[#F59E0B] animate-pulse" :
                  sseStatus === "offline" ? "bg-[#EF4444]" :
                  "bg-[#64748B] animate-pulse",
                ].join(" ")}
                aria-hidden="true"
              />
              <span className="text-[#94A3B8] capitalize">{sseStatus.replace("-", " ")}</span>
            </div>
            <div className="px-2 text-[9px] text-[#475569]" style={{ fontFamily: "var(--font-pixel), monospace" }}>
              {floorsToRender.length} floor{floorsToRender.length !== 1 ? "s" : ""} •{" "}
              {floorsToRender.reduce((acc, f) => acc + f.cubicles.length, 0)} agents
            </div>
          </div>
        </div>

        {/* Preview tooltip */}
        <AnimatePresence mode="wait">
          {previewFloor && previewPosition && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 4 }}
              transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
              className="fixed z-50 pointer-events-none"
              style={{
                left: previewPosition.x,
                top: previewPosition.y,
                transform: "translateX(-50%) translateY(calc(-100% - 8px))",
              }}
              role="tooltip"
            >
              <FloorPreview floor={previewFloor} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Context Menu */}
        <FloorContextMenu
          contextMenu={contextMenu}
          pinnedFloors={pinnedFloors}
          onPin={handlePinFromMenu}
          onClose={handleCloseFromMenu}
          onCopy={handleCopySessionID}
          onRename={handleRenameFromMenu}
          onRenameAvailable={!!onRename}
          onCloseMenu={() => setContextMenu(null)}
        />
      </>
    );
  }

  // Tablet: Horizontal tabs at top
  if (layout === "tablet") {
    return (
      <div
        className="sticky top-14 z-30 flex w-full gap-2 overflow-x-auto border-b-2 border-[#334155] bg-[#0F172A]/95 px-4 py-2"
        style={{
          boxShadow: "0 2px 0 #334155",
          backgroundImage: "url('/sprites/wall-tile.png')",
          backgroundRepeat: "repeat-x",
          backgroundSize: "32px 32px",
          imageRendering: "pixelated",
        }}
        role="tablist"
        aria-label="Office floors"
      >
        {floorsToRender.map((floor, i) => renderTab(floor, i))}
        <FloorContextMenu
          contextMenu={contextMenu}
          pinnedFloors={pinnedFloors}
          onPin={handlePinFromMenu}
          onClose={handleCloseFromMenu}
          onCopy={handleCopySessionID}
          onRename={handleRenameFromMenu}
          onRenameAvailable={!!onRename}
          onCloseMenu={() => setContextMenu(null)}
        />
      </div>
    );
  }

  // Mobile: Bottom sheet
  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isBottomSheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-[#0F172A]/80 backdrop-blur-sm"
            onClick={() => setIsBottomSheetOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Bottom Sheet with Drag Gestures */}
      <AnimatePresence>
        {isBottomSheetOpen && (
          <motion.div
            ref={sheetContentRef}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            dragMomentum={false}
            initial={{ y: "100%" }}
            animate={{ y: isDraggingSheet ? sheetDragOffset : 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onDragStart={() => {
              setIsDraggingSheet(true);
              // Measure sheet height for constraints
              if (sheetContentRef.current) {
                bottomSheetHeightRef.current = sheetContentRef.current.offsetHeight;
              }
            }}
            onDrag={(event, info) => {
              const delta = info.offset.y;
              // Only allow dragging down (positive delta = pulling down to dismiss)
              setSheetDragOffset(Math.max(0, delta));
            }}
            onDragEnd={(event, info) => {
              setIsDraggingSheet(false);
              const velocity = info.velocity.y;
              const offset = info.offset.y;
              // Dismiss if dragged down > 100px or velocity > 500px/s
              if (offset > 100 || velocity > 500) {
                setIsBottomSheetOpen(false);
              }
              setSheetDragOffset(0);
            }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] bg-[#0F172A] border-t-2 border-[#334155] rounded-t-[12px] overflow-hidden"
            style={{
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
            role="dialog"
            aria-label="Select floor"
            aria-modal="true"
          >
            {/* Sheet handle + title */}
            <div className="flex flex-col items-center gap-2 border-b border-[#334155]/30 px-4 py-3">
              <div className="h-1 w-10 rounded-full bg-[#334155]" aria-hidden="true" />
              <div className="flex items-center justify-between w-full">
                <span className="text-[12px] font-bold tracking-widest text-[#F1F5F9]" style={{ fontFamily: "var(--font-pixel), monospace" }}>
                  FLOORS ({floorsToRender.length})
                </span>
                <div className="flex items-center gap-3">
                  {onFollowActivityChange && (() => {
                    const followBtnClass = [
                      "inline-flex items-center gap-1.5 rounded-[4px] border-2 px-2 py-1 text-[7px] tracking-widest shrink-0 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]",
                      followActivity
                        ? "border-[#3B82F6] bg-[#3B82F6]/10 text-[#3B82F6] hover:bg-[#3B82F6]/20"
                        : "border-[#64748B] bg-[#1E293B] text-[#64748B] hover:bg-[#24324D] hover:border-[#475569]",
                    ].join(" ");
                    return (
                      <button
                        type="button"
                        onClick={() => onFollowActivityChange(!followActivity)}
                        className={followBtnClass}
                        style={{ fontFamily: "var(--font-pixel), monospace" }}
                        aria-label={followActivity ? "Disable follow activity" : "Enable follow activity"}
                        aria-pressed={followActivity}
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: followActivity ? "#3B82F6" : "#64748B" }} aria-hidden="true" />
                        FOLLOW
                      </button>
                    );
                  })()}
                  <button
                    type="button"
                    onClick={() => setIsBottomSheetOpen(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-[4px] text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1E293B] transition-colors"
                    aria-label="Close"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Search input in bottom sheet */}
            <div className="relative px-4 pb-3">
              <svg
                className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475569] pointer-events-none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                ref={searchInputRef}
                type="search"
                placeholder="Search floors..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="w-full h-10 rounded-[6px] border bg-[#1E293B] px-10 py-2 text-[14px] text-[#F1F5F9] placeholder:text-[#475569] focus:outline-none focus:ring-1 focus:ring-[#3B82F6] focus:border-transparent transition-all"
                style={{
                  fontFamily: "var(--font-inter), Inter, sans-serif",
                  borderColor: searchFocused ? "#3B82F6" : "#334155",
                }}
                aria-label="Search floors"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => handleSearchChange("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-[4px] text-[#64748B] hover:text-[#F1F5F9] hover:bg-[#24324D] transition-colors"
                  aria-label="Clear search"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Floor list */}
            <div className="flex max-h-[calc(85vh-140px)] flex-col gap-1.5 overflow-y-auto p-3 pb-[calc(3rem+env(safe-area-inset-bottom))]" role="menu">
              {!hasSearchResults ? (
                <div className="flex items-center justify-center h-24 text-[#64748B] text-[12px]" style={{ fontFamily: "var(--font-pixel), monospace" }}>
                  No floors match
                </div>
              ) : (
                floorsToRender.map((floor, i) => renderTab(floor, i))
              )}
            </div>

            <FloorContextMenu
              contextMenu={contextMenu}
              pinnedFloors={pinnedFloors}
              onPin={handlePinFromMenu}
              onClose={handleCloseFromMenu}
              onCopy={handleCopySessionID}
              onRename={handleRenameFromMenu}
              onRenameAvailable={!!onRename}
              onCloseMenu={() => setContextMenu(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
