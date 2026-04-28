"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";

const navItems = [
  { href: "/home", label: "主页" },
  { href: "/timeline", label: "时间线" },
  { href: "/model", label: "模型" },
  { href: "/experiment", label: "实验和求解" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold">数模Dashboard</h1>
      </div>
      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-4 py-2 rounded transition-colors ${
              pathname === item.href
                ? "bg-blue-600"
                : "hover:bg-gray-800"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:text-white"
        >
          退出登录
        </button>
      </div>
    </aside>
  );
}
