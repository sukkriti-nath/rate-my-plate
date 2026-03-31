"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { UserSession } from "@/lib/types";

export default function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserSession | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user));
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

  return (
    <nav className="bg-kikoff-dark sticky top-0 z-50 shadow-lg">
      <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-1.5 shrink-0">
          <span className="font-display text-base text-white tracking-tight">
            Rate<span className="text-kikoff">My</span>Plate
          </span>
        </Link>

        <div className="flex items-center bg-white/10 rounded-full p-0.5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                pathname === link.href
                  ? "bg-kikoff text-kikoff-dark shadow-sm"
                  : "text-gray-400 hover:text-white"
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
              <div className="w-6 h-6 rounded-full bg-kikoff flex items-center justify-center text-kikoff-dark text-[10px] font-bold">
                {user.displayName.charAt(0)}
              </div>
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
              className="text-xs font-medium bg-kikoff text-kikoff-dark px-3 py-1 rounded-full hover:bg-kikoff-hover transition-all"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
