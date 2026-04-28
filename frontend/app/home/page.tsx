"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import api from "@/lib/api";
import { useRouter } from "next/navigation";

interface Team {
  id: string;
  name: string;
  invite_code: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  git_remote_url: string | null;
}

export default function HomePage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      fetchProjects(selectedTeam);
    }
  }, [selectedTeam]);

  const fetchTeams = async () => {
    try {
      const res = await api.get("/teams");
      setTeams(res.data);
      if (res.data.length > 0 && !selectedTeam) {
        setSelectedTeam(res.data[0].id);
      }
    } catch {
      setTeams([]);
    }
  };

  const fetchProjects = async (teamId: string) => {
    try {
      const res = await api.get("/projects", { params: { team_id: teamId } });
      setProjects(res.data);
    } catch {
      setProjects([]);
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

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) {
      setMessage("请先选择团队");
      return;
    }
    try {
      await api.post("/projects", {
        name: projectName,
        description: projectDesc || undefined,
        git_remote_url: gitUrl || undefined,
      }, { params: { team_id: selectedTeam } });
      setProjectName("");
      setProjectDesc("");
      setGitUrl("");
      fetchProjects(selectedTeam);
      setMessage("项目创建成功");
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "创建项目失败");
    }
  };

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6">主页</h1>
      {message && (
        <div className="bg-blue-100 text-blue-700 p-3 rounded mb-4">{message}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">我的团队</h2>
            {teams.length === 0 ? (
              <p className="text-gray-500">暂无团队</p>
            ) : (
              <div className="space-y-2">
                {teams.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTeam(t.id)}
                    className={`w-full text-left border p-3 rounded transition-colors ${
                      selectedTeam === t.id ? "border-blue-500 bg-blue-50" : ""
                    }`}
                  >
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      邀请码: {t.invite_code}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

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

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">
              项目列表 {selectedTeam && teams.find((t) => t.id === selectedTeam)?.name ? `- ${teams.find((t) => t.id === selectedTeam)?.name}` : ""}
            </h2>
            {projects.length === 0 ? (
              <p className="text-gray-500">该团队暂无项目</p>
            ) : (
              <div className="space-y-3">
                {projects.map((p) => (
                  <div key={p.id} className="border p-4 rounded hover:shadow-md transition-shadow">
                    <div className="font-medium text-lg">{p.name}</div>
                    {p.description && <div className="text-gray-600 text-sm mt-1">{p.description}</div>}
                    {p.git_remote_url && (
                      <div className="text-xs text-gray-500 mt-2">
                        Git: {p.git_remote_url}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">创建项目</h2>
            <form onSubmit={createProject} className="space-y-3">
              <input
                type="text"
                placeholder="项目名称"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
              <input
                type="text"
                placeholder="项目描述（可选）"
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
              <input
                type="text"
                placeholder="Git远程仓库地址（可选）"
                value={gitUrl}
                onChange={(e) => setGitUrl(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                创建项目
              </button>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
