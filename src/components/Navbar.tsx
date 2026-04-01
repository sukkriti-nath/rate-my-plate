"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import type { UserSession } from "@/lib/types";

export default function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserSession | null>(null);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user));
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setAppMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const links = [
    { href: "/", label: "Vote", emoji: "🗳️" },
    { href: "/dashboard", label: "Dashboard", emoji: "📊" },
    { href: "/rankings", label: "Rankings", emoji: "🏆" },
    { href: "/reports", label: "Reports", emoji: "📋" },
  ];

  async function handleLogout() {
    await fetch("/api/auth/me", { method: "DELETE" });
    window.location.href = "/login";
  }

  const isSnacksApp = pathname.startsWith("/snacks");

  return (
    <nav className="bg-kikoff-dark sticky top-0 z-50 border-b-2 border-black">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo + App Switcher */}
        <div className="flex items-center gap-2 shrink-0" ref={menuRef}>
          <Link
            href={isSnacksApp ? "/snacks" : "/"}
            className="flex items-center gap-2"
          >
            {isSnacksApp ? (
              <span className="text-2xl leading-none" aria-hidden>
                🍿
              </span>
            ) : (
              <Image
                src="/logo.png"
                alt="RateMyPlate"
                width={32}
                height={32}
                className="rounded-lg"
              />
            )}
            <span className="font-display text-base text-white tracking-tight font-extrabold uppercase">
              {isSnacksApp ? (
                <>
                  Snack<span className="text-amber-500">Overflow</span>
                </>
              ) : (
                <>
                  Rate<span className="text-kikoff">My</span>Plate
                </>
              )}
            </span>
          </Link>

          {/* App Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setAppMenuOpen(!appMenuOpen)}
              className="ml-1 p-1 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Switch app"
            >
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${appMenuOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {appMenuOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] overflow-hidden z-50">
                <Link
                  href="/"
                  onClick={() => setAppMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <Image src="/logo.png" alt="RateMyPlate" width={24} height={24} className="rounded" />
                  <div>
                    <div className="font-bold text-sm text-gray-900">RateMyPlate</div>
                    <div className="text-xs text-gray-500">Lunch ratings</div>
                  </div>
                </Link>
                <div className="border-t border-gray-200" />
                <Link
                  href="/snacks"
                  onClick={() => setAppMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-2xl">🍿</span>
                  <div>
                    <div className="font-bold text-sm text-gray-900">SnackOverflow</div>
                    <div className="text-xs text-gray-500">Snack preferences</div>
                  </div>
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 p-0.5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                pathname === link.href
                  ? "bg-kikoff text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]"
                  : "text-gray-400 hover:text-white border-2 border-transparent"
              }`}
            >
              <span className="mr-0.5">{link.emoji}</span>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <>
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="w-6 h-6 rounded-xl border-2 border-black object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-xl bg-kikoff flex items-center justify-center text-kikoff-dark text-[10px] font-bold border-2 border-black">
                  {user.displayName.charAt(0)}
                </div>
              )}
              <button
                onClick={handleLogout}
                className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-xs font-bold bg-black text-white px-4 py-1.5 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
            >
              Start Rating
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
