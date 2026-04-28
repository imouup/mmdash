"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import api from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface Team {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  model_data_page_id: string | null;
}

export default function ModelPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [pageId, setPageId] = useState("");
  const [markdown, setMarkdown] = useState<string>("");
  const [loading, setLoading] = useState(false);
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
      const proj = projects.find((p) => p.id === selectedProject);
      if (proj?.model_data_page_id) {
        fetchModelContent(selectedProject);
      } else {
        setMarkdown("");
      }
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
        setMarkdown("");
      }
    } catch {
      setProjects([]);
      setSelectedProject("");
      setMarkdown("");
    }
  };

  const fetchModelContent = async (projectId: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/model/${projectId}/content`);
      setMarkdown(res.data.markdown || "");
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "获取模型内容失败");
    } finally {
      setLoading(false);
    }
  };

  const linkPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !pageId) return;
    try {
      await api.post(`/model/${selectedProject}/link`, null, {
        params: { page_id: pageId },
      });
      fetchProjects(selectedTeam);
      setPageId("");
      setMessage("Notion页面已绑定");
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "绑定失败");
    }
  };

  const exportMarkdown = async () => {
    if (!selectedProject) return;
    try {
      const res = await api.get(`/model/${selectedProject}/export/md`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `model_${selectedProject}.md`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setMessage("导出失败");
    }
  };

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6">模型</h1>
      {message && (
        <div className="bg-blue-100 text-blue-700 p-3 rounded mb-4">{message}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">选择项目</h2>
            <div className="space-y-2 mb-4">
              {teams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTeam(t.id)}
                  className={`w-full text-left border p-3 rounded transition-colors ${
                    selectedTeam === t.id ? "border-blue-500 bg-blue-50" : ""
                  }`}
                >
                  <div className="font-medium">{t.name}</div>
                </button>
              ))}
            </div>
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
                  {p.model_data_page_id && (
                    <div className="text-xs text-green-600">已绑定Notion</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">绑定Notion页面</h2>
            <form onSubmit={linkPage} className="space-y-3">
              <input
                type="text"
                placeholder="Notion Page ID"
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                绑定
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">导出</h2>
            <button
              onClick={exportMarkdown}
              disabled={!selectedProject}
              className="w-full bg-gray-800 text-white py-2 rounded hover:bg-gray-900 disabled:bg-gray-400"
            >
              导出 Markdown
            </button>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white p-6 rounded-lg shadow min-h-[600px]">
            {loading ? (
              <p className="text-gray-500">加载中...</p>
            ) : markdown ? (
              <div className="prose max-w-none">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {markdown}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-gray-500">
                {selectedProject
                  ? "请先绑定Notion模型页面"
                  : "请选择一个项目"}
              </p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
