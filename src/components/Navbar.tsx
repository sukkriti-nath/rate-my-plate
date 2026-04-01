"use client";

import Link from "next/link";
import Image from "next/image";
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
    { href: "/reports", label: "Rankings", emoji: "🏆" },
    { href: "/leaderboard", label: "Reviewers", emoji: "⭐" },
  ];

  async function handleLogout() {
    await fetch("/api/auth/me", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <nav className="bg-kikoff-dark sticky top-0 z-50 border-b-2 border-black">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Logo — hide text on small screens */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image
            src="/logo.png"
            alt="RateMyPlate"
            width={28}
            height={28}
            className="rounded-lg sm:w-8 sm:h-8"
          />
          <span className="font-display text-base text-white tracking-tight font-extrabold uppercase hidden sm:inline">
            Rate<span className="text-kikoff">My</span>Plate
          </span>
        </Link>

        {/* Nav links — compact on mobile */}
        <div className="flex items-center gap-0.5 sm:gap-1 p-0.5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-2 sm:px-3 py-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${
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

        {/* User section */}
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
                className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors hidden sm:block"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-[11px] sm:text-xs font-bold bg-black text-white px-3 sm:px-4 py-1.5 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all whitespace-nowrap"
            >
              Start Rating
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
