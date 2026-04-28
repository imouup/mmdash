"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import api from "@/lib/api";

interface Team {
  id: string;
  name: string;
  invite_code: string;
}

export default function HomePage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const res = await api.get("/teams");
      setTeams(res.data);
    } catch {
      setTeams([]);
    }
  };

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/teams", { name: teamName });
      setTeamName("");
      fetchTeams();
      setMessage("团队创建成功");
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "创建失败");
    }
  };

  const joinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/teams/join", { invite_code: inviteCode });
      setInviteCode("");
      fetchTeams();
      setMessage("加入团队成功");
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "加入失败");
    }
  };

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6">主页</h1>
      {message && (
        <div className="bg-blue-100 text-blue-700 p-3 rounded mb-4">{message}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">我的团队</h2>
          {teams.length === 0 ? (
            <p className="text-gray-500">暂无团队</p>
          ) : (
            <ul className="space-y-2">
              {teams.map((t) => (
                <li key={t.id} className="border p-3 rounded">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    邀请码: {t.invite_code}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">创建团队</h2>
            <form onSubmit={createTeam} className="space-y-3">
              <input
                type="text"
                placeholder="团队名称"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                创建
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">加入团队</h2>
            <form onSubmit={joinTeam} className="space-y-3">
              <input
                type="text"
                placeholder="邀请码"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
              <button
                type="submit"
                className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
              >
                加入
              </button>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
