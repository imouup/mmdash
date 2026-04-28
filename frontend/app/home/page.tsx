"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import api from "@/lib/api";

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

interface Todo {
  id: string;
  content: string;
  completed: boolean;
  is_team_todo: boolean;
}

interface Progress {
  total_todos: number;
  completed_todos: number;
  completion_rate: number;
  team: { total: number; completed: number; rate: number };
  personal: { total: number; completed: number; rate: number };
}

export default function HomePage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [todos, setTodos] = useState<Todo[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const [todoContent, setTodoContent] = useState("");
  const [isTeamTodo, setIsTeamTodo] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      fetchProjects(selectedTeam);
    }
  }, [selectedTeam]);

  useEffect(() => {
    if (selectedProject) {
      fetchTodos(selectedProject);
      fetchProgress(selectedProject);
    }
  }, [selectedProject]);

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
      if (res.data.length > 0) {
        setSelectedProject(res.data[0].id);
      } else {
        setSelectedProject("");
      }
    } catch {
      setProjects([]);
      setSelectedProject("");
    }
  };

  const fetchTodos = async (projectId: string) => {
    try {
      const res = await api.get(`/home/${projectId}/todos`);
      setTodos(res.data);
    } catch {
      setTodos([]);
    }
  };

  const fetchProgress = async (projectId: string) => {
    try {
      const res = await api.get(`/home/${projectId}/progress`);
      setProgress(res.data);
    } catch {
      setProgress(null);
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
      await api.post(
        "/projects",
        {
          name: projectName,
          description: projectDesc || undefined,
          git_remote_url: gitUrl || undefined,
        },
        { params: { team_id: selectedTeam } }
      );
      setProjectName("");
      setProjectDesc("");
      setGitUrl("");
      fetchProjects(selectedTeam);
      setMessage("项目创建成功");
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "创建项目失败");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedProject || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api.post(`/home/${selectedProject}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage("题目上传成功");
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "上传失败");
    }
  };

  const createTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    try {
      await api.post(`/home/${selectedProject}/todos`, null, {
        params: { content: todoContent, is_team_todo: isTeamTodo },
      });
      setTodoContent("");
      setIsTeamTodo(false);
      fetchTodos(selectedProject);
      fetchProgress(selectedProject);
      setMessage("TODO添加成功");
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "添加失败");
    }
  };

  const toggleTodo = async (todoId: string) => {
    if (!selectedProject) return;
    try {
      await api.put(`/home/${selectedProject}/todos/${todoId}`);
      fetchTodos(selectedProject);
      fetchProgress(selectedProject);
    } catch {}
  };

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6">主页</h1>
      {message && (
        <div className="bg-blue-100 text-blue-700 p-3 rounded mb-4">{message}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 左侧：团队和项目 */}
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
            <h2 className="text-lg font-semibold mb-4">项目</h2>
            {projects.length === 0 ? (
              <p className="text-gray-500">暂无项目</p>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProject(p.id)}
                    className={`w-full text-left border p-3 rounded transition-colors ${
                      selectedProject === p.id ? "border-green-500 bg-green-50" : ""
                    }`}
                  >
                    <div className="font-medium">{p.name}</div>
                  </button>
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

        {/* 中间：题目和TODO */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">题目上传</h2>
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileUpload}
              disabled={!selectedProject}
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-2">
              支持 PDF 和纯文本文件
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">TODO 列表</h2>
            <form onSubmit={createTodo} className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="添加 TODO..."
                value={todoContent}
                onChange={(e) => setTodoContent(e.target.value)}
                className="flex-1 border rounded px-3 py-2"
                required
              />
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={isTeamTodo}
                  onChange={(e) => setIsTeamTodo(e.target.checked)}
                />
                团队
              </label>
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                添加
              </button>
            </form>
            {todos.length === 0 ? (
              <p className="text-gray-500">暂无 TODO</p>
            ) : (
              <div className="space-y-2">
                {todos.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 p-3 border rounded"
                  >
                    <input
                      type="checkbox"
                      checked={t.completed}
                      onChange={() => toggleTodo(t.id)}
                      className="w-5 h-5"
                    />
                    <span
                      className={`flex-1 ${
                        t.completed ? "line-through text-gray-400" : ""
                      }`}
                    >
                      {t.content}
                    </span>
                    {t.is_team_todo && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        团队
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右侧：进度和团队操作 */}
        <div className="space-y-6">
          {progress && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">整体进度</h2>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>总完成度</span>
                    <span>{progress.completion_rate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded h-2 mt-1">
                    <div
                      className="bg-blue-600 h-2 rounded"
                      style={{ width: `${progress.completion_rate}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span>团队 TODO</span>
                    <span>
                      {progress.team.completed}/{progress.team.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded h-2 mt-1">
                    <div
                      className="bg-green-600 h-2 rounded"
                      style={{ width: `${progress.team.rate}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span>个人 TODO</span>
                    <span>
                      {progress.personal.completed}/{progress.personal.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded h-2 mt-1">
                    <div
                      className="bg-purple-600 h-2 rounded"
                      style={{ width: `${progress.personal.rate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

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
