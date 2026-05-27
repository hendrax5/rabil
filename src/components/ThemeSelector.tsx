'use client';

import { useState, useEffect, useRef } from 'react';
import { Paintbrush, Check, Sliders, Sparkles, LayoutGrid, CheckSquare } from 'lucide-react';

interface ThemeOption {
  id: string;
  name: string;
  colors: string[]; // Gradient circles representation
  isDark: boolean;
}

const THEME_OPTIONS: ThemeOption[] = [
  { id: 'light', name: 'Slate Light', colors: ['#ffffff', '#0891b2'], isDark: false },
  { id: 'dark', name: 'Midnight Navy', colors: ['#0B132B', '#3A86FF'], isDark: true },
  { id: 'cyberpunk', name: 'Cyberpunk Neon', colors: ['#0f0728', '#bc13fe', '#00f7ff'], isDark: true },
  { id: 'emerald', name: 'Emerald Forest', colors: ['#06140f', '#10b981'], isDark: true },
  { id: 'retro-amber', name: 'Retro Terminal', colors: ['#0c0a09', '#f59e0b'], isDark: true },
];

export default function ThemeSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [density, setDensity] = useState('spacious');
  const [glassmorphic, setGlassmorphic] = useState('disabled');
  const [sidebar, setSidebar] = useState('solid');
  const containerRef = useRef<HTMLDivElement>(null);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') || 'dark';
    const storedDensity = localStorage.getItem('theme-density') || 'spacious';
    const storedGlass = localStorage.getItem('theme-glassmorphic') || 'disabled';
    const storedSidebar = localStorage.getItem('theme-sidebar') || 'solid';

    setTheme(storedTheme);
    setDensity(storedDensity);
    setGlassmorphic(storedGlass);
    setSidebar(storedSidebar);

    applyTheme(storedTheme);
    applyDensity(storedDensity);
    applyGlassmorphic(storedGlass);
    applySidebar(storedSidebar);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const applyTheme = (t: string) => {
    const opt = THEME_OPTIONS.find(o => o.id === t) || THEME_OPTIONS[1];
    document.documentElement.classList.toggle('dark', opt.isDark);
    document.documentElement.dataset.theme = t;
    localStorage.setItem('theme', t);
  };

  const applyDensity = (d: string) => {
    document.documentElement.dataset.density = d;
    localStorage.setItem('theme-density', d);
  };

  const applyGlassmorphic = (g: string) => {
    document.documentElement.dataset.glassmorphic = g;
    localStorage.setItem('theme-glassmorphic', g);
  };

  const applySidebar = (s: string) => {
    document.documentElement.dataset.sidebar = s;
    localStorage.setItem('theme-sidebar', s);
  };

  const handleSelectTheme = (themeId: string) => {
    // Prevent styling transition flashes temporarily
    document.documentElement.classList.add('theme-transitioning');
    setTheme(themeId);
    applyTheme(themeId);
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 150);
  };

  const handleToggleDensity = () => {
    const next = density === 'spacious' ? 'compact' : 'spacious';
    setDensity(next);
    applyDensity(next);
  };

  const handleToggleGlass = () => {
    const next = glassmorphic === 'enabled' ? 'disabled' : 'enabled';
    setGlassmorphic(next);
    applyGlassmorphic(next);
  };

  const handleToggleSidebar = () => {
    const next = sidebar === 'solid' ? 'floating' : 'solid';
    setSidebar(next);
    applySidebar(next);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center justify-center outline-none"
        title="Sesuaikan Tampilan"
      >
        <Paintbrush className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-900 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] border border-zinc-200 dark:border-zinc-800 p-4 z-50 animate-in zoom-in-95 slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-1.5 pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              Kustomisasi Tampilan
            </h4>
          </div>

          {/* Color Themes Grid */}
          <div className="space-y-2.5">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Pilihan Tema</span>
            <div className="grid grid-cols-1 gap-1.5">
              {THEME_OPTIONS.map((opt) => {
                const isSelected = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectTheme(opt.id)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl transition-all text-left outline-none ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-primary font-semibold border'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-100 dark:border-zinc-800/40 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {/* Color dots preview */}
                      <div className="flex -space-x-1">
                        {opt.colors.map((c, i) => (
                          <div
                            key={i}
                            className="w-3.5 h-3.5 rounded-full border border-white dark:border-zinc-900"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <span className="text-xs">{opt.name}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-3.5" />

          {/* Spacing density toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  Spacing Padat (Compact)
                </span>
              </div>
              <button
                onClick={handleToggleDensity}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  density === 'compact' ? 'bg-primary' : 'bg-zinc-200 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    density === 'compact' ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Glassmorphic toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  Efek Transparansi Kaca
                </span>
              </div>
              <button
                onClick={handleToggleGlass}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  glassmorphic === 'enabled' ? 'bg-primary' : 'bg-zinc-200 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    glassmorphic === 'enabled' ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Sidebar Floating toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  Sidebar Mengambang
                </span>
              </div>
              <button
                onClick={handleToggleSidebar}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  sidebar === 'floating' ? 'bg-primary' : 'bg-zinc-200 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    sidebar === 'floating' ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
