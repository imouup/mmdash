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

interface Symbol {
  symbol: string;
  meaning: string;
  source: string;
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

  // LLM analysis states
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [structure, setStructure] = useState<any>(null);
  const [formulaInput, setFormulaInput] = useState("");
  const [formulaExplanation, setFormulaExplanation] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"content" | "symbols" | "structure" | "formula">("content");

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

  const fetchSymbols = async () => {
    if (!selectedProject) return;
    setAnalysisLoading(true);
    try {
      const res = await api.get(`/model/${selectedProject}/analyze/symbols`);
      setSymbols(res.data.symbols || []);
      setActiveTab("symbols");
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "符号分析失败");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const fetchStructure = async () => {
    if (!selectedProject) return;
    setAnalysisLoading(true);
    try {
      const res = await api.get(`/model/${selectedProject}/analyze/structure`);
      setStructure(res.data.structure || {});
      setActiveTab("structure");
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "结构分析失败");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const explainFormula = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !formulaInput) return;
    setAnalysisLoading(true);
    try {
      const res = await api.post(`/model/${selectedProject}/analyze/formula`, null, {
        params: { formula: formulaInput },
      });
      setFormulaExplanation(res.data.explanation || "");
      setActiveTab("formula");
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "公式解释失败");
    } finally {
      setAnalysisLoading(false);
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
            <h2 className="text-lg font-semibold mb-4">AI 分析</h2>
            <div className="space-y-2">
              <button
                onClick={fetchSymbols}
                disabled={!selectedProject || analysisLoading}
                className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 disabled:bg-gray-400"
              >
                符号表
              </button>
              <button
                onClick={fetchStructure}
                disabled={!selectedProject || analysisLoading}
                className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 disabled:bg-gray-400"
              >
                结构解析
              </button>
            </div>
            <form onSubmit={explainFormula} className="mt-3 space-y-2">
              <input
                type="text"
                placeholder="输入公式..."
                value={formulaInput}
                onChange={(e) => setFormulaInput(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={!selectedProject || analysisLoading}
                className="w-full bg-teal-600 text-white py-2 rounded hover:bg-teal-700 disabled:bg-gray-400"
              >
                公式解释
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
          {/* Tabs */}
          <div className="bg-white rounded-t-lg shadow border-b flex">
            {[
              { key: "content", label: "内容" },
              { key: "symbols", label: "符号表" },
              { key: "structure", label: "结构解析" },
              { key: "formula", label: "公式解释" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex-1 py-3 text-center font-medium transition-colors ${
                  activeTab === tab.key
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-b-lg shadow p-6 min-h-[600px]">
            {analysisLoading && (
              <div className="text-center py-10">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-gray-500 mt-2">AI分析中...</p>
              </div>
            )}

            {!analysisLoading && activeTab === "content" && (
              <>
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
              </>
            )}

            {!analysisLoading && activeTab === "symbols" && (
              <div>
                <div className="bg-yellow-100 text-yellow-800 p-3 rounded mb-4 text-sm font-medium">
                  ⚠️ 仅供参考 - 请人工审核符号含义
                </div>
                {symbols.length === 0 ? (
                  <p className="text-gray-500">暂无符号分析结果，点击"符号表"按钮开始分析</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border p-3 text-left">符号</th>
                          <th className="border p-3 text-left">含义</th>
                          <th className="border p-3 text-left">来源</th>
                        </tr>
                      </thead>
                      <tbody>
                        {symbols.map((s, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="border p-3 font-mono text-lg">{s.symbol}</td>
                            <td className="border p-3">{s.meaning}</td>
                            <td className="border p-3">
                              <span
                                className={`text-xs px-2 py-1 rounded ${
                                  s.source === "user"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {s.source === "user" ? "手工定义" : "上下文推断"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {!analysisLoading && activeTab === "structure" && (
              <div>
                <div className="bg-yellow-100 text-yellow-800 p-3 rounded mb-4 text-sm font-medium">
                  ⚠️ 仅供参考 - 请人工审核结构分析
                </div>
                {!structure ? (
                  <p className="text-gray-500">暂无结构分析结果，点击"结构解析"按钮开始分析</p>
                ) : (
                  <div className="space-y-4">
                    {structure.summary && (
                      <div>
                        <h3 className="font-semibold text-lg mb-2">总体概述</h3>
                        <p className="text-gray-700">{structure.summary}</p>
                      </div>
                    )}
                    {structure.sections && structure.sections.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-lg mb-2">关键章节</h3>
                        <ul className="list-disc pl-5 space-y-1">
                          {structure.sections.map((s: string, i: number) => (
                            <li key={i} className="text-gray-700">{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {structure.problem_relationship && (
                      <div>
                        <h3 className="font-semibold text-lg mb-2">与题目对应关系</h3>
                        <p className="text-gray-700">{structure.problem_relationship}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!analysisLoading && activeTab === "formula" && (
              <div>
                <div className="bg-yellow-100 text-yellow-800 p-3 rounded mb-4 text-sm font-medium">
                  ⚠️ 仅供参考 - 请人工审核公式解释
                </div>
                {!formulaExplanation ? (
                  <p className="text-gray-500">
                    输入公式并点击"公式解释"按钮获取AI解释
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-gray-100 p-4 rounded">
                      <div className="text-sm text-gray-500 mb-1">原始公式</div>
                      <div className="font-mono text-lg">{formulaInput}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">解释</div>
                      <div className="prose max-w-none">
                        <ReactMarkdown>{formulaExplanation}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
