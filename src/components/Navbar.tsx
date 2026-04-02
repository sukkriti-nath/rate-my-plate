"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import type { UserSession } from "@/lib/types";

export default function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserSession | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const appMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user));
  }, []);

  // Close app menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (appMenuRef.current && !appMenuRef.current.contains(event.target as Node)) {
        setAppMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isSnacksApp = pathname.startsWith("/snacks");

  const links = isSnacksApp
    ? [
        { href: "/snacks", label: "Dashboard" },
        { href: "/snacks/profile", label: "Profile" },
      ]
    : [
        { href: "/", label: "Vote" },
        { href: "/reports", label: "Rankings" },
        { href: "/leaderboard", label: "Leaderboard" },
      ];

  async function handleLogout() {
    await fetch("/api/auth/me", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <nav className="bg-kikoff sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo + App Switcher */}
          <div className="flex items-center gap-1 shrink-0" ref={appMenuRef}>
            <Link href={isSnacksApp ? "/snacks" : "/"} className="flex items-center gap-2.5">
              {isSnacksApp ? (
                <span className="text-2xl">🍿</span>
              ) : (
                <Image
                  src="/logo.png"
                  alt="RateMyPlate"
                  width={30}
                  height={30}
                  className="rounded-full border-2 border-kikoff-dark/20"
                />
              )}
              <span className="font-display text-lg sm:text-xl text-kikoff-dark font-extrabold">
                {isSnacksApp ? (
                  <>Snack<span className="bg-amber-500 text-white px-1.5 py-0.5 rounded-xl mx-0.5">Over</span>flow</>
                ) : (
                  <>Rate<span className="bg-kikoff-dark text-kikoff px-1.5 py-0.5 rounded-xl mx-0.5">My</span>Plate</>
                )}
              </span>
            </Link>

            {/* App Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setAppMenuOpen(!appMenuOpen)}
                className="p-1 rounded-lg hover:bg-kikoff-dark/10 transition-colors"
                aria-label="Switch app"
              >
                <svg className={`w-4 h-4 text-kikoff-dark/50 transition-transform ${appMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {appMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl border-2 border-kikoff-dark/10 shadow-lg overflow-hidden z-50">
                  <Link href="/" onClick={() => setAppMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${!isSnacksApp ? "bg-kikoff/30" : ""}`}>
                    <Image src="/logo.png" alt="" width={24} height={24} className="rounded" />
                    <div className="text-sm font-semibold text-kikoff-dark">RateMyPlate</div>
                  </Link>
                  <Link href="/snacks" onClick={() => setAppMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${isSnacksApp ? "bg-amber-50" : ""}`}>
                    <span className="text-xl">🍿</span>
                    <div className="text-sm font-semibold text-kikoff-dark">SnackOverflow</div>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Desktop nav links — centered */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  pathname === link.href
                    ? "bg-kikoff-dark text-kikoff"
                    : "text-kikoff-dark/70 hover:text-kikoff-dark hover:bg-kikoff-dark/5"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right section */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <>
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="w-8 h-8 rounded-full border-2 border-kikoff-dark/20 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-kikoff-dark flex items-center justify-center text-kikoff text-xs font-bold">
                    {user.displayName.charAt(0)}
                  </div>
                )}
                <div className="hidden sm:flex flex-col leading-tight">
                  <span className="text-xs text-kikoff-dark/60 font-medium">
                    Hello, {user.displayName.split(" ")[0]}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="text-xs text-kikoff-dark font-bold hover:text-kikoff-dark/70 transition-colors text-left"
                  >
                    Log out
                  </button>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="text-xs sm:text-sm font-bold bg-kikoff-dark text-kikoff px-4 sm:px-5 py-2 rounded-full hover:bg-kikoff-dark/90 transition-all whitespace-nowrap"
              >
                Start Rating
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex flex-col gap-1 p-1.5"
              aria-label="Toggle menu"
            >
              <span className={`block w-5 h-0.5 bg-kikoff-dark transition-all ${mobileMenuOpen ? "rotate-45 translate-y-1.5" : ""}`} />
              <span className={`block w-5 h-0.5 bg-kikoff-dark transition-all ${mobileMenuOpen ? "opacity-0" : ""}`} />
              <span className={`block w-5 h-0.5 bg-kikoff-dark transition-all ${mobileMenuOpen ? "-rotate-45 -translate-y-1.5" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Subtle bottom border */}
      <div className="h-[2px] bg-kikoff-dark/10" />

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-kikoff border-t border-kikoff-dark/10">
          <div className="max-w-6xl mx-auto px-4 py-3 space-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  pathname === link.href
                    ? "bg-kikoff-dark text-kikoff"
                    : "text-kikoff-dark/70 hover:bg-kikoff-dark/5"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {user && (
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold text-kikoff-dark/50 hover:bg-kikoff-dark/5 transition-all sm:hidden"
              >
                Log out
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
