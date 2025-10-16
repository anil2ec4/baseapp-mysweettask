"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { Poppins } from "next/font/google";

const poppins = Poppins({
  weight: ["400","500","600","700","800"],
  subsets: ["latin"],
  display: "swap",
});

type Priority = "low" | "medium" | "high";

type Task = {
  id: number;
  text: string;
  completed: boolean;
  isEditing: boolean;
  priority: Priority;
  dueDate: string | null;
  tags: string[];
  pomodoros: number;
  completedAt?: number | null;
  pomodoroPausedAt?: number;
};

type User = {
  address: string;
  displayName: string;
  avatarUrl: string;
};

const priorityMap: Record<Priority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function classNames(...v: Array<string | false | undefined | null>) {
  return v.filter(Boolean).join(" ");
}

export default function Page() {
  // Wallet - kullanıcı
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Görevler ve UI state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentFilter, setCurrentFilter] = useState<"active" | "completed" | "all">("active");
  const [currentSort, setCurrentSort] = useState<"creation" | "dueDate" | "priority">("creation");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Form state
  const [taskText, setTaskText] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState<string>("");

  // Pomodoro ve Silme modalları
  const [isPomodoroOpen, setPomodoroOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number>(-1);
  const [pomodoroTaskIndex, setPomodoroTaskIndex] = useState<number>(-1);
  const [timerRunning, setTimerRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const endTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Tarih - üst başlık
  const todayText = useMemo(() => {
    try {
      return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    } catch {
      return "";
    }
  }, []);

  // localStorage anahtarları
  const tasksKey = useMemo(() => {
    return currentUser ? `miniapp_tasks_${currentUser.address}` : null;
  }, [currentUser]);

  const prefsKey = useMemo(() => {
    return currentUser ? `miniapp_prefs_${currentUser.address}` : null;
  }, [currentUser]);

  // İlk yüklemede mevcut bağlantı kontrolü
  useEffect(() => {
    const savedAddress = localStorage.getItem("baseapp_connected_user_address");
    if (!savedAddress) return;

    // window.ethereum yalnızca client tarafında mevcut
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;

    ethereum
      .request({ method: "eth_accounts" })
      .then(async (accounts: string[]) => {
        if (accounts?.length && accounts[0]?.toLowerCase() === savedAddress.toLowerCase()) {
          const user = await buildUserProfile(accounts[0]);
          setCurrentUser(user);
        } else {
          handleDisconnect(); // izin bitmiş olabilir
        }
      })
      .catch(() => {});
  }, []);

  // Hesap değişimini yakala
  useEffect(() => {
    const ethereum = (window as any).ethereum;
    if (!ethereum || !ethereum.on) return;

    const onAccountsChanged = (accounts: string[]) => {
      if (!accounts?.length) {
        handleDisconnect();
        return;
      }
      const addr = accounts[0];
      if (currentUser && addr.toLowerCase() !== currentUser.address.toLowerCase()) {
        handleDisconnect();
      }
    };

    ethereum.on("accountsChanged", onAccountsChanged);
    return () => {
      try { ethereum.removeListener("accountsChanged", onAccountsChanged); } catch {}
    };
  }, [currentUser]);

  // Kullanıcı değiştiğinde görevleri ve tercihleri yükle
  useEffect(() => {
    if (!currentUser) return;

    // prefs
    try {
      const s = localStorage.getItem(prefsKey!);
      if (s) {
        const { filter, sort } = JSON.parse(s);
        setCurrentFilter(filter ?? "active");
        setCurrentSort(sort ?? "creation");
      }
    } catch {}

    // tasks
    try {
      const s = localStorage.getItem(tasksKey!);
      setTasks(s ? JSON.parse(s) : []);
    } catch {
      setTasks([]);
    }
  }, [currentUser, prefsKey, tasksKey]);

// --- Base Build Preview: MiniApp "ready" sinyali (actions.ready desteği) ---
useEffect(() => {
  const tryReady = () => {
    const m = (window as any)?.miniapp;
    if (!m) return false;

    try {
      // Yeni SDK: sdk.actions.ready()
      if (m.actions?.ready) {
        m.actions.ready();
        m.logger?.info?.("ready_sent(actions.ready)");
        return true;
      }
      // Eski/alternatif: sdk.ready()
      if (m.ready) {
        m.ready();
        m.logger?.info?.("ready_sent(ready)");
        return true;
      }
    } catch {
      // no-op
    }
    return false;
  };

  if (tryReady()) return;

  // miniapp objesi geç gelebilir -> 10 sn boyunca dene
  let tries = 0;
  const id = setInterval(() => {
    tries++;
    if (tryReady() || tries > 20) clearInterval(id);
  }, 500);

  return () => clearInterval(id);
}, []);
// --- /MiniApp "ready" sinyali ---

  // Görevleri ve tercihleri kaydet
  const saveTasks = useCallback(
    (next: Task[]) => {
      setTasks(next);
      if (tasksKey) {
        try {
          localStorage.setItem(tasksKey, JSON.stringify(next));
        } catch {}
      }
    },
    [tasksKey]
  );

  const savePrefs = useCallback(
    (filter: typeof currentFilter, sort: typeof currentSort) => {
      if (prefsKey) {
        try {
          localStorage.setItem(prefsKey, JSON.stringify({ filter, sort }));
        } catch {}
      }
    },
    [prefsKey]
  );

  // Wallet bağlan
  const handleConnect = useCallback(async () => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      alert("Lütfen bir cüzdan eklentisi kur. Örneğin MetaMask.");
      return;
    }
    try {
      const accounts: string[] = await ethereum.request({ method: "eth_requestAccounts" });
      if (!accounts?.length) return;
      const addr = accounts[0];
      const user = await buildUserProfile(addr);
      localStorage.setItem("baseapp_connected_user_address", addr);
      setCurrentUser(user);
    } catch {
      // kullanıcı reddetti
    }
  }, []);

  // Wallet bağlantısını kes
const handleDisconnect = useCallback(async () => {
  const ethereum = (window as any).ethereum;
  try {
    await ethereum?.request?.({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    }).catch(() => {});
  } catch {}

  // ÖNEMLİ: cüzdana bağlı localStorage verilerini ARTIK silmiyoruz.
  // Sadece "kim bağlıydı" bilgisini temizle.
  localStorage.removeItem("baseapp_connected_user_address");

  // Bellek state'ini sıfırla (UI temizlensin)
  setCurrentUser(null);
  setTasks([]);
  setActiveTag(null);
  setSelectedTag(null);
  setTaskText("");
  setDueDate("");
  setPriority("medium");
}, []);

  // Kullanıcı profili - Coinbase varsa kullan, yoksa fallback
  async function buildUserProfile(address: string): Promise<User> {
    try {
      const w = window as any;
      if (w.ethereum?.isCoinbaseWallet && w.ethereum?.coinbase?.getUser) {
        const user = await w.ethereum.coinbase.getUser();
        const display = user?.data?.profile?.displayName;
        const image = user?.data?.profile?.profileImageUrl;
        const initials = (display || address.substring(2, 4)).substring(0, 2).toUpperCase();
        return {
          address,
          displayName: display || `${address.substring(0, 6)}...${address.substring(address.length - 4)}`,
          avatarUrl: image || `https://placehold.co/40x40/fbcfe8/db2777?text=${initials}`,
        };
      }
    } catch {}
    const initials = address.substring(2, 4).toUpperCase();
    return {
      address,
      displayName: `${address.substring(0, 6)}...${address.substring(address.length - 4)}`,
      avatarUrl: `https://placehold.co/40x40/fbcfe8/db2777?text=${initials}`,
    };
  }

  // Görev ekle
  const addTask = useCallback(() => {
    const text = taskText.trim();
    if (!text) return;

    const next: Task = {
      id: Date.now(),
      text,
      completed: false,
      isEditing: false,
      priority,
      dueDate: dueDate || null,
      tags: selectedTag ? [selectedTag] : [],
      pomodoros: 0,
    };
    saveTasks([next, ...tasks]);

    // form reset
    setTaskText("");
    setPriority("medium");
    setDueDate("");
    setSelectedTag(null);
  }, [taskText, priority, dueDate, selectedTag, tasks, saveTasks]);

  const toggleTask = useCallback(
    (index: number) => {
      const next = [...tasks];
      const t = next[index];
      t.completed = !t.completed;
      t.completedAt = t.completed ? Date.now() : null;
      saveTasks(next);
    },
    [tasks, saveTasks]
  );

  const startEditing = useCallback(
    (index: number) => {
      const next = [...tasks];
      next[index].isEditing = true;
      saveTasks(next);
    },
    [tasks, saveTasks]
  );

  const cancelEdit = useCallback(
    (index: number) => {
      const next = [...tasks];
      next[index].isEditing = false;
      saveTasks(next);
    },
    [tasks, saveTasks]
  );

  const saveEdit = useCallback(
    (index: number, text: string) => {
      const v = text.trim();
      const next = [...tasks];
      if (v) next[index].text = v;
      next[index].isEditing = false;
      saveTasks(next);
    },
    [tasks, saveTasks]
  );

  const openDeleteConfirmation = useCallback((index: number) => {
    setDeleteIndex(index);
    setDeleteOpen(true);
  }, []);

  const closeDeleteConfirmation = useCallback(() => {
    setDeleteIndex(-1);
    setDeleteOpen(false);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteIndex < 0) return;
    const next = [...tasks];
    next.splice(deleteIndex, 1);
    saveTasks(next);
    closeDeleteConfirmation();
  }, [deleteIndex, tasks, saveTasks, closeDeleteConfirmation]);

  // Filtre ve sıralama
  const processedTasks = useMemo(() => {
    let list = tasks.filter((t) => {
      if (currentFilter === "completed") return t.completed;
      if (currentFilter === "active") return !t.completed;
      return true;
    });
    if (activeTag) list = list.filter((t) => t.tags?.includes(activeTag));

    list.sort((a, b) => {
      if (currentSort === "priority") {
        return (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0);
      }
      if (currentSort === "dueDate") {
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      }
      // creation
      return b.id - a.id;
    });

    return list;
  }, [tasks, currentFilter, currentSort, activeTag]);

  // Günlük ilerleme
  const dailyCompletedCount = useMemo(() => {
    const today = new Date().toDateString();
    return tasks.filter((t) => t.completed && t.completedAt && new Date(t.completedAt).toDateString() === today).length;
  }, [tasks]);

  const dashOffset = useMemo(() => {
    const total = tasks.length || 0;
    const progress = total > 0 ? (dailyCompletedCount / total) * 100 : 0;
    const circumference = 100;
    return circumference - progress;
  }, [dailyCompletedCount, tasks.length]);

  const activeCount = useMemo(() => tasks.filter((t) => !t.completed).length, [tasks]);

  // Pomodoro
  const requestNotificationPermission = useCallback(() => {
    if (typeof window === "undefined") return;
    if ("Notification" in window && (window as any).Notification?.permission !== "denied") {
      (window as any).Notification.requestPermission();
    }
  }, []);

  const openPomodoro = useCallback(
    (index: number) => {
      requestNotificationPermission();
      setPomodoroTaskIndex(index);

      // farklı task'a geçerken saat sıfırla
      const paused = tasks[index].pomodoroPausedAt;
      setRemainingSeconds(paused !== undefined ? paused : 25 * 60);
      setTimerRunning(false);
      setPomodoroOpen(true);
      // küçük açılış animasyonu class'ı CSS module tarafında verilmiş durumda
    },
    [tasks, requestNotificationPermission]
  );

  const closePomodoro = useCallback(() => {
    setPomodoroOpen(false);
  }, []);

  const pausePomodoro = useCallback(() => {
    if (!timerRunning) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimerRunning(false);

    const left = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
    setRemainingSeconds(left);

    if (pomodoroTaskIndex > -1) {
      const next = [...tasks];
      next[pomodoroTaskIndex].pomodoroPausedAt = left;
      saveTasks(next);
    }
  }, [timerRunning, pomodoroTaskIndex, tasks, saveTasks]);

  const resetPomodoro = useCallback(
    (updateDisplay = true) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setTimerRunning(false);
      if (pomodoroTaskIndex > -1) {
        const next = [...tasks];
        delete next[pomodoroTaskIndex].pomodoroPausedAt;
        saveTasks(next);
      }
      if (updateDisplay) setRemainingSeconds(25 * 60);
    },
    [pomodoroTaskIndex, tasks, saveTasks]
  );

  const startPausePomodoro = useCallback(() => {
    if (timerRunning) {
      pausePomodoro();
      return;
    }
    setTimerRunning(true);
    endTimeRef.current = Date.now() + remainingSeconds * 1000;

    intervalRef.current = setInterval(() => {
      const left = Math.round((endTimeRef.current - Date.now()) / 1000);
      if (left <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        // bitti
        setTimerRunning(false);
        setRemainingSeconds(25 * 60);
        if (pomodoroTaskIndex > -1) {
          const next = [...tasks];
          next[pomodoroTaskIndex].pomodoros = (next[pomodoroTaskIndex].pomodoros || 0) + 1;
          delete next[pomodoroTaskIndex].pomodoroPausedAt;
          saveTasks(next);

          // bildirim
          try {
            if (typeof window !== "undefined" && "Notification" in window) {
              if ((window as any).Notification.permission === "granted" && document.hidden) {
                new (window as any).Notification("Time's up!", {
                  body: `Focus session for "${next[pomodoroTaskIndex].text}" is complete! Time for a break.`,
                  icon: "https://placehold.co/192x192/fbcfe8/db2777?text=💖",
                });
              }
            }
          } catch {}
        }
        return;
      }
      setRemainingSeconds(left);
    }, 1000);
  }, [timerRunning, remainingSeconds, pomodoroTaskIndex, tasks, saveTasks, pausePomodoro]);

  // Yardımcı UI fonksiyonları
  const tagButtonClass = useCallback(
    (tag: string) =>
      classNames(
        "font-semibold py-2 px-4 rounded-full flex items-center gap-2",
        styles.tagBtn,
        selectedTag === tag ? styles.tagBtnActive : "text-rose-900",
        !selectedTag || selectedTag !== tag ? styles.tagBtnBase : ""
      ),
    [selectedTag]
  );

  const filterBtnClass = useCallback(
    (key: "active" | "completed" | "all") =>
      classNames(
        "filter-btn font-semibold py-1 px-4 rounded-md text-slate-600",
        styles.filterBtn,
        currentFilter === key ? styles.filterBtnActive : ""
      ),
    [currentFilter]
  );

  const priorityClass = useCallback(
    (p: Priority) =>
      classNames(
        p === "high" && styles.priorityHigh,
        p === "medium" && styles.priorityMedium,
        p === "low" && styles.priorityLow
      ),
    []
  );

  const formatDue = (d?: string | null) => {
    if (!d) return "";
    try {
      return new Date(d).toLocaleDateString();
    } catch {
      return d;
    }
  };

  const isOverdue = (d?: string | null, completed?: boolean) => {
    if (!d || completed) return false;
    try {
      const due = new Date(d);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return due.getTime() < today.getTime();
    } catch {
      return false;
    }
  };

  // Filtre ve sıralama tercihlerini kaydet
  useEffect(() => {
    savePrefs(currentFilter, currentSort);
  }, [currentFilter, currentSort, savePrefs]);

  return (
    <main className={classNames(poppins.className, "bg-rose-50 min-h-screen flex items-center justify-center p-4")}>
      <div id="app-wrapper" className="w-full max-w-lg mx-auto">
        {!currentUser && (
          <div className="text-center p-8 bg-white/80 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl shadow-rose-200/50">
            <span className="text-6xl mb-4 inline-block">💖</span>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">My Sweet Tasks</h1>
            <p className="text-slate-500 mb-6">Please connect your wallet to manage your tasks.</p>
            <button
              onClick={handleConnect}
              className={classNames(
                "bg-pink-600 text-white font-bold py-3 px-8 rounded-full hover:bg-pink-700 transition-transform hover:scale-105 text-lg",
                styles.pinkGlowFocusBtn
              )}
            >
              Connect Wallet
            </button>
          </div>
        )}

        {currentUser && (
          <div className="w-full bg-white/80 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl shadow-rose-200/50 p-6 md:p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={currentUser.avatarUrl}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full border-2 border-pink-200 flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-bold text-slate-700 truncate">{currentUser.displayName}</p>
                  <p className="text-xs text-slate-500 font-mono">
                    {`${currentUser.address.substring(0, 6)}...${currentUser.address.substring(currentUser.address.length - 4)}`}
                  </p>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                className="bg-rose-100 text-slate-600 font-semibold py-2 px-4 rounded-lg hover:bg-rose-200 transition flex-shrink-0"
              >
                Disconnect
              </button>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800">My Sweet Tasks</h1>
                <p className="text-rose-400">{todayText}</p>
              </div>
              <div className="relative w-16 h-16 cursor-pointer flex-shrink-0" title="Today's Progress">
                <svg className="w-full h-full" viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
                  <circle
                    className="text-rose-100"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="transparent"
                    r="15.9155"
                    cx="18"
                    cy="18"
                  />
                  <circle
                    className="text-pink-500 transition-all duration-500"
                    strokeWidth="3.5"
                    strokeDasharray="100, 100"
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="15.9155"
                    cx="18"
                    cy="18"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-lg font-extrabold text-pink-600">{dailyCompletedCount}</span>
                  <span className="text-xs text-slate-500 font-medium">Done</span>
                </div>
              </div>
            </div>

            {/* Add Task */}
            <div className="space-y-4 mb-4">
              <div className={classNames("rounded-lg border border-rose-200 p-3", styles.pinkGlowFocus)}>
                <input
                  type="text"
                  placeholder="Plan a fabulous day..."
                  className="w-full bg-transparent text-slate-700 focus:outline-none placeholder-rose-400"
                  value={taskText}
                  onChange={(e) => setTaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTask();
                    }
                  }}
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTag((t) => (t === "Work" ? null : "Work"))}
                  className={tagButtonClass("Work")}
                >
                  {/* Work icon */}
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M6 3.75A2.75 2.75 0 018.75 1h2.5A2.75 2.75 0 0114 3.75v.443c.572.055 1.14.122 1.706.2C17.053 4.582 18 5.75 18 7.07v3.863c0 1.32-0.947 2.488-2.294 2.667-0.566.078-1.134.145-1.706.2v.443c0 2.071-1.679 3.75-3.75 3.75h-2.5A2.75 2.75 0 016 14.25v-.443a8.024 8.024 0 01-1.706-.2C2.947 13.418 2 12.25 2 10.933V7.07c0-1.32 0.947-2.488 2.294-2.667A8.024 8.024 0 016 4.193v-.443zM7.5 7.5a1 1 0 011-1h3a1 1 0 110 2h-3a1 1 0 01-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Work</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTag((t) => (t === "Personal" ? null : "Personal"))}
                  className={tagButtonClass("Personal")}
                >
                  {/* Personal icon */}
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM10 11a6 6 0 00-6 6v1.5a.5.5 0 00.5.5h11a.5.5 0 00.5-.5V17a6 6 0 00-6-6z" />
                  </svg>
                  <span>Personal</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTag((t) => (t === "Study" ? null : "Study"))}
                  className={tagButtonClass("Study")}
                >
                  {/* Study icon */}
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3.5a1 1 0 00.028 1.846l7.307 2.923c.246.1.53.1.776 0l7.307-2.923a1 1 0 00.028-1.846l-7-3.5zM3 9.735v5.526c0 .414.336.75.75.75h12.5a.75.75 0 00.75-.75V9.735l-7.307 2.923a.998.998 0 01-.776 0L3 9.735z" />
                  </svg>
                  <span>Study</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className={classNames(
                    "flex-1 p-3 border border-rose-200 rounded-lg bg-transparent text-slate-700 focus:outline-none",
                    styles.pinkGlowFocus
                  )}
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>

                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={classNames(
                    "flex-1 w-full p-3 border border-rose-200 rounded-lg bg-transparent focus:outline-none",
                    styles.pinkGlowFocus,
                    styles.datePicker,
                    styles.dateInput,
                    dueDate ? styles.dateInputHasValue : ""
                  )}
                />

                <button
                  type="button"
                  onClick={addTask}
                  className={classNames(
                    "bg-pink-600 text-white font-semibold px-5 py-3 rounded-lg hover:bg-pink-700 transition-transform hover:scale-105",
                    styles.pinkGlowFocusBtn
                  )}
                >
                  Add Task
                </button>
              </div>
            </div>

            {/* Filter - Sort */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 border-t pt-4">
              <div className="flex justify-center gap-2 bg-rose-100 p-1 rounded-lg">
                <button className={filterBtnClass("active")} onClick={() => setCurrentFilter("active")} data-filter="active">
                  Active
                </button>
                <button className={filterBtnClass("completed")} onClick={() => setCurrentFilter("completed")} data-filter="completed">
                  Completed
                </button>
                <button className={filterBtnClass("all")} onClick={() => setCurrentFilter("all")} data-filter="all">
                  All
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-600">Sort by:</label>
                <select
                  value={currentSort}
                  onChange={(e) => setCurrentSort(e.target.value as any)}
                  className={classNames("p-2 border border-rose-200 rounded-lg bg-transparent text-slate-700 text-sm focus:outline-none", styles.pinkGlowFocus)}
                >
                  <option value="creation">Creation Date</option>
                  <option value="dueDate">Due Date</option>
                  <option value="priority">Priority</option>
                </select>
              </div>
            </div>

            {/* Liste */}
            <div id="list-container" className="relative min-h-[150px]">
              <div id="task-list" className="space-y-3">
                {processedTasks.map((task) => {
                  const index = tasks.findIndex((t) => t.id === task.id);
                  if (index < 0) return null;

                  if (task.isEditing) {
                    return (
                      <div key={task.id} className={classNames(styles.taskEnterActive)}>
                        <div className="p-4 bg-rose-100 rounded-lg border-2 border-pink-400">
                          <input
                            defaultValue={task.text}
                            className="w-full bg-transparent text-slate-700 focus:outline-none mb-2"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const v = (e.target as HTMLInputElement).value;
                                saveEdit(index, v);
                              }
                            }}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => cancelEdit(index)}
                              className="text-sm font-semibold text-slate-600 px-3 py-1 rounded-md hover:bg-rose-200"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                const input = (document.activeElement as HTMLInputElement) || null;
                                saveEdit(index, input?.value ?? task.text);
                              }}
                              className="text-sm font-semibold text-white bg-pink-500 px-3 py-1 rounded-md hover:bg-pink-600"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const overdue = isOverdue(task.dueDate, task.completed);
                  const completedClass = task.completed
                    ? "bg-green-100/60 text-slate-500 line-through opacity-70"
                    : "bg-rose-50";

                  return (
                    <div key={task.id} className={classNames("task-item", styles.taskEnterActive)}>
                      <div className={classNames("p-4 rounded-lg transition-all duration-300", completedClass, priorityClass(task.priority))}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-grow min-w-0">
                            <input
                              type="checkbox"
                              checked={task.completed}
                              onChange={() => toggleTask(index)}
                              className="mt-1 h-5 w-5 rounded border-rose-300 text-pink-500 focus:ring-pink-500 cursor-pointer bg-transparent"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-slate-700 break-words">{task.text}</span>
                                {task.pomodoros > 0 && (
                                  <span className="text-xs font-bold text-pink-500">
                                    {"✨".repeat(task.pomodoros)}
                                  </span>
                                )}
                              </div>
                              {task.dueDate && (
                                <p className={classNames("text-xs", overdue ? styles.overdueDate : "text-slate-400")}>
                                  {formatDue(task.dueDate)}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="actions flex items-center gap-1 opacity-0 transition-opacity flex-shrink-0 -mr-2">
                            {!task.completed && (
                              <>
                                <button
                                  title="Focus on this task"
                                  aria-label="Focus on this task"
                                  onClick={() => openPomodoro(index)}
                                  className="text-slate-500 hover:text-pink-600 p-2 rounded-md"
                                >
                                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                                <button
                                  title="Edit task"
                                  aria-label="Edit task"
                                  onClick={() => startEditing(index)}
                                  className="text-slate-500 hover:text-pink-600 p-2 rounded-md"
                                >
                                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                    <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </>
                            )}
                            <button
                              title="Delete task"
                              aria-label="Delete task"
                              onClick={() => openDeleteConfirmation(index)}
                              className="text-slate-500 hover:text-red-600 p-2 rounded-md"
                            >
                              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path
                                  fillRule="evenodd"
                                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {(task.tags?.length ?? 0) > 0 && (
                          <div className="mt-2 ml-8 flex flex-wrap gap-2">
                            {task.tags!.map((tg) => (
                              <span
                                key={tg}
                                className={classNames("text-xs font-semibold py-1 px-3 rounded-full", styles.renderedTag)}
                                onClick={() => setActiveTag((prev) => (prev === tg ? null : tg))}
                              >
                                {tg}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Boş durumlar ve kutlama */}
              {processedTasks.length === 0 && (
                <p className="text-rose-500 text-center py-4">
                  {tasks.length === 0
                    ? "Plan a fabulous day!"
                    : currentFilter === "completed"
                    ? "You haven't completed any tasks yet."
                    : activeTag
                    ? `No tasks with the tag "${activeTag}" found.`
                    : "No tasks here."}
                </p>
              )}

              {activeCount === 0 && tasks.length > 0 && currentFilter === "active" && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8 rounded-lg">
                  <span className="text-5xl mb-4">💖</span>
                  <h3 className="text-2xl font-bold text-pink-500">All active tasks done!</h3>
                  <p className="text-slate-600 mt-1">Great job, you're amazing!</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pomodoro Modal */}
      {isPomodoroOpen && (
        <div
          className={classNames("fixed inset-0 z-50 flex items-center justify-center", styles.modalBg)}
          onClick={(e) => {
            if (e.target === e.currentTarget) closePomodoro();
          }}
        >
          <div className={classNames("bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center relative", styles.modalBox, styles.modalBoxOpen)}>
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              {pomodoroTaskIndex > -1 ? `Focus on: ${tasks[pomodoroTaskIndex]?.text}` : "Focus on Task"}
            </h2>
            <p className="text-6xl font-bold tabular-nums text-slate-900 mb-4">
              {String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:
              {String(remainingSeconds % 60).padStart(2, "0")}
            </p>
            <div className="mb-6 text-lg font-medium text-pink-500">{timerRunning ? "Stay focused..." : "Time to focus!"}</div>
            <div className="flex justify-center gap-4">
              <button
                onClick={startPausePomodoro}
                className={classNames("w-24 bg-pink-600 text-white font-semibold px-5 py-3 rounded-lg hover:bg-pink-700", styles.pinkGlowFocusBtn)}
              >
                {timerRunning ? "Pause" : "Start"}
              </button>
              <button
                onClick={() => resetPomodoro(true)}
                className="w-24 bg-rose-100 text-slate-800 font-semibold px-5 py-3 rounded-lg hover:bg-rose-200"
              >
                Reset
              </button>
            </div>
            <button
              onClick={closePomodoro}
              aria-label="Close pomodoro timer"
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteOpen && (
        <div
          className={classNames("fixed inset-0 z-50 flex items-center justify-center", styles.modalBg)}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDeleteConfirmation();
          }}
        >
          <div className={classNames("bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center", styles.modalBox, styles.modalBoxOpen)}>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Are you sure?</h2>
            <p className="text-slate-500 mb-6">Do you really want to delete this task? This action cannot be undone.</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={closeDeleteConfirmation}
                className="w-24 bg-rose-100 text-slate-800 font-semibold px-5 py-3 rounded-lg hover:bg-rose-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className={classNames("w-24 bg-red-500 text-white font-semibold px-5 py-3 rounded-lg hover:bg-red-600", styles.pinkGlowFocusBtn)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
