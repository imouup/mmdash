"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  connectLocalAgent,
  disconnectLocalAgent,
  sendAction,
} from "@/lib/local_agent";
import api from "@/lib/api";

interface EnvInfo {
  python_version: string;
  conda_available: boolean;
  conda_envs: string[];
  gcc_available: boolean;
  git_available: boolean;
  cpu_count: number;
  memory_gb: number;
}

export default function ExperimentPage() {
  const [connected, setConnected] = useState(false);
  const [envInfo, setEnvInfo] = useState<EnvInfo | null>(null);
  const [command, setCommand] = useState("");
  const [shellOutput, setShellOutput] = useState("");
  const [solverPath, setSolverPath] = useState("");
  const [repoPath, setRepoPath] = useState("");
  const [paramName, setParamName] = useState("");
  const [paramValues, setParamValues] = useState("");
  const [params, setParams] = useState<Record<string, string[]>>({});

  // Range input states
  const [rangeName, setRangeName] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeStep, setRangeStep] = useState("");
  const [experimentResult, setExperimentResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Git integration states
  const [projectId, setProjectId] = useState("");
  const [solvers, setSolvers] = useState<any[]>([]);
  const [gitCommits, setGitCommits] = useState<string[]>([]);
  const [selectedSolver, setSelectedSolver] = useState<string>("");
  const [extractedParams, setExtractedParams] = useState<any[]>([]);

  // Sandbox / sync states
  const [analysisContent, setAnalysisContent] = useState("");
  const [resultFiles, setResultFiles] = useState<string[]>([]);

  // Experiment history states
  const [experiments, setExperiments] = useState<any[]>([]);
  const [selectedExperiment, setSelectedExperiment] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"run" | "history">("run");

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    checkConnection();
    return () => {
      disconnectLocalAgent();
    };
  }, []);

  const [projects, setProjects] = useState<any[]>([]);

  const fetchProjects = async () => {
    try {
      const res = await api.get("/teams");
      if (res.data.length > 0) {
        const projectsRes = await api.get("/projects", {
          params: { team_id: res.data[0].id },
        });
        setProjects(projectsRes.data);
        if (projectsRes.data.length > 0) {
          setProjectId(projectsRes.data[0].id);
        }
      }
    } catch {}
  };

  const scanSolvers = async () => {
    if (!projectId || !repoPath) {
      setMessage("请选择项目并指定仓库路径");
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/git/${projectId}/scan`, {
        params: { repo_path: repoPath },
      });
      setSolvers(res.data.solvers || []);
      setMessage("扫描完成");
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "扫描失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchGitLog = async () => {
    if (!projectId || !repoPath) {
      setMessage("请选择项目并指定仓库路径");
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/git/${projectId}/log`, {
        params: { repo_path: repoPath },
      });
      setGitCommits(res.data.commits || []);
      setMessage("Git日志加载完成");
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "加载Git日志失败");
    } finally {
      setLoading(false);
    }
  };

  const extractSolverParams = async (path: string) => {
    if (!projectId) return;
    setSelectedSolver(path);
    try {
      const res = await api.get(`/git/${projectId}/params`, {
        params: { solver_path: path },
      });
      setExtractedParams(res.data.params || []);
      // Auto-populate param grid
      const newParams: Record<string, string[]> = {};
      res.data.params.forEach((p: any) => {
        if (p.type === "number") {
          newParams[p.name] = [p.default, String(Number(p.default) * 2)];
        } else {
          newParams[p.name] = [p.default];
        }
      });
      setParams(newParams);
    } catch {}
  };

  const checkConnection = async () => {
    try {
      await connectLocalAgent();
      setConnected(true);
      detectEnv();
    } catch {
      setConnected(false);
    }
  };

  const detectEnv = async () => {
    try {
      const data = await sendAction("detect_env");
      setEnvInfo(data);
    } catch (err: any) {
      setMessage("环境检测失败: " + err.message);
    }
  };

  const runShell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command) return;
    setLoading(true);
    try {
      const data = await sendAction("shell", {
        command,
        cwd: repoPath || undefined,
      });
      setShellOutput(
        `Exit code: ${data.returncode}\n\nSTDOUT:\n${data.stdout}\n\nSTDERR:\n${data.stderr}`
      );
    } catch (err: any) {
      setMessage("命令执行失败: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const addParam = () => {
    if (!paramName || !paramValues) return;
    const vals = paramValues.split(",").map((v) => v.trim());
    setParams((prev) => ({ ...prev, [paramName]: vals }));
    setParamName("");
    setParamValues("");
  };

  const addRangeParam = () => {
    if (!rangeName || !rangeStart || !rangeEnd || !rangeStep) return;
    const start = parseFloat(rangeStart);
    const end = parseFloat(rangeEnd);
    const step = parseFloat(rangeStep);
    if (isNaN(start) || isNaN(end) || isNaN(step) || step === 0) {
      setMessage("参数范围设置无效");
      return;
    }
    const vals: string[] = [];
    for (let v = start; v <= end + 1e-9; v += step) {
      vals.push(String(Number(v.toFixed(6))));
    }
    setParams((prev) => ({ ...prev, [rangeName]: vals }));
    setRangeName("");
    setRangeStart("");
    setRangeEnd("");
    setRangeStep("");
  };

  const removeParam = (name: string) => {
    setParams((prev) => {
      const copy = { ...prev };
      delete copy[name];
      return copy;
    });
  };

  const runExperiment = async () => {
    if (!solverPath) {
      setMessage("请指定Solver文件路径");
      return;
    }
    setLoading(true);
    try {
      const data = await sendAction("run_experiment", {
        solver_path: solverPath,
        param_grid: params,
        git_repo_path: repoPath || ".",
      });
      setExperimentResult(data);
      // Scan result files
      if (data.result_dir) {
        scanResultFiles(data.result_dir);
      }
      setMessage("实验执行完成");
    } catch (err: any) {
      setMessage("实验执行失败: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const scanResultFiles = async (dir: string) => {
    try {
      const data = await sendAction("shell", {
        command: `find "${dir}" -type f | head -20`,
      });
      const files = data.stdout.split("\n").filter((f: string) => f.trim());
      setResultFiles(files);
      // Load analysis.md if exists
      const analysisPath = files.find((f: string) => f.endsWith("analysis.md"));
      if (analysisPath) {
        const catData = await sendAction("shell", { command: `cat "${analysisPath}"` });
        setAnalysisContent(catData.stdout);
      }
    } catch {}
  };

  const saveAnalysis = async () => {
    if (!experimentResult?.result_dir) return;
    const analysisPath = `${experimentResult.result_dir}/analysis.md`;
    try {
      // Escape content for shell
      const escaped = analysisContent.replace(/"/g, '\\"').replace(/\n/g, "\\n");
      await sendAction("shell", {
        command: `printf "${escaped}" > "${analysisPath}"`,
      });
      setMessage("analysis.md 已保存");
    } catch (err: any) {
      setMessage("保存失败: " + err.message);
    }
  };

  const gitAddCommitPush = async () => {
    if (!repoPath) {
      setMessage("请指定Git仓库路径");
      return;
    }
    setLoading(true);
    try {
      const addRes = await sendAction("shell", {
        command: `cd "${repoPath}" && git add .`,
      });
      if (addRes.returncode !== 0) {
        setMessage("git add 失败: " + addRes.stderr);
        return;
      }
      const commitRes = await sendAction("shell", {
        command: `cd "${repoPath}" && git commit -m "experiment results"`,
      });
      if (commitRes.returncode !== 0 && !commitRes.stderr.includes("nothing to commit")) {
        setMessage("git commit 失败: " + commitRes.stderr);
        return;
      }
      const pushRes = await sendAction("shell", {
        command: `cd "${repoPath}" && git push`,
      });
      if (pushRes.returncode !== 0) {
        setMessage("git push 失败: " + pushRes.stderr);
        return;
      }
      setMessage("Git同步完成: add → commit → push");
    } catch (err: any) {
      setMessage("Git操作失败: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchExperiments = async () => {
    if (!projectId || !repoPath) {
      setMessage("请选择项目并指定仓库路径");
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/git/${projectId}/experiments`, {
        params: { repo_path: repoPath },
      });
      setExperiments(res.data.experiments || []);
      setMessage("实验记录加载完成");
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "加载实验记录失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchExperimentDetail = async (dirPath: string) => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await api.get(`/git/${projectId}/experiment`, {
        params: { experiment_dir: dirPath },
      });
      setSelectedExperiment(res.data);
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "加载实验详情失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6">实验和求解</h1>
      {message && (
        <div className="bg-blue-100 text-blue-700 p-3 rounded mb-4">{message}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Local Agent 状态</h2>
            <div className="flex items-center gap-2 mb-4">
              <div
                className={`w-3 h-3 rounded-full ${
                  connected ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span>{connected ? "已连接" : "未连接"}</span>
            </div>
            {!connected && (
              <button
                onClick={checkConnection}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                重新连接
              </button>
            )}
          </div>

          {envInfo && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">本地环境</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">Python:</span>{" "}
                  {envInfo.python_version.split(" ")[0]}
                </div>
                <div>
                  <span className="text-gray-500">CPU:</span>{" "}
                  {envInfo.cpu_count} 核
                </div>
                <div>
                  <span className="text-gray-500">内存:</span>{" "}
                  {envInfo.memory_gb} GB
                </div>
                <div>
                  <span className="text-gray-500">Conda:</span>{" "}
                  {envInfo.conda_available ? "✅" : "❌"}
                </div>
                <div>
                  <span className="text-gray-500">GCC:</span>{" "}
                  {envInfo.gcc_available ? "✅" : "❌"}
                </div>
                <div>
                  <span className="text-gray-500">Git:</span>{" "}
                  {envInfo.git_available ? "✅" : "❌"}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Shell 执行</h2>
            <form onSubmit={runShell} className="space-y-3">
              <input
                type="text"
                placeholder="命令"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
              <input
                type="text"
                placeholder="工作目录（可选）"
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
              <button
                type="submit"
                disabled={!connected || loading}
                className="w-full bg-gray-800 text-white py-2 rounded hover:bg-gray-900 disabled:bg-gray-400"
              >
                执行
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setActiveTab("run")}
              className={`px-4 py-2 rounded font-medium ${
                activeTab === "run"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              运行实验
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 rounded font-medium ${
                activeTab === "history"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              实验记录
            </button>
          </div>

          {activeTab === "run" && (
            <>
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Git 集成</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Git 仓库路径"
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
              <div className="flex gap-2">
                <button
                  onClick={scanSolvers}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  扫描 Solver 文件
                </button>
                <button
                  onClick={fetchGitLog}
                  disabled={loading}
                  className="flex-1 bg-gray-700 text-white py-2 rounded hover:bg-gray-800 disabled:bg-gray-400"
                >
                  Git 日志
                </button>
              </div>
            </div>

            {solvers.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium mb-2">扫描到的 Solver 文件</h3>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {solvers.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSolverPath(s.path);
                        extractSolverParams(s.path);
                      }}
                      className={`w-full text-left text-sm p-2 rounded border ${
                        selectedSolver === s.path ? "border-blue-500 bg-blue-50" : ""
                      }`}
                    >
                      {s.rel_path}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {extractedParams.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium mb-2">提取到的参数</h3>
                <div className="space-y-1">
                  {extractedParams.map((p, i) => (
                    <div key={i} className="text-sm bg-gray-100 p-2 rounded">
                      {p.name}: {p.default} ({p.type})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {gitCommits.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium mb-2">最近提交</h3>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {gitCommits.map((c, i) => (
                    <div key={i} className="text-sm text-gray-600 font-mono">
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">自动化实验</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Solver 文件路径
                </label>
                <input
                  type="text"
                  placeholder="/path/to/solver.py"
                  value={solverPath}
                  onChange={(e) => setSolverPath(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Git 仓库路径
                </label>
                <input
                  type="text"
                  placeholder="/path/to/repo"
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="border rounded p-4">
                <h3 className="font-medium mb-2">参数网格</h3>
                <div className="mb-4 border-b pb-4">
                  <div className="text-sm text-gray-500 mb-2">范围模式（起始、结束、步长）</div>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="参数名"
                      value={rangeName}
                      onChange={(e) => setRangeName(e.target.value)}
                      className="border rounded px-3 py-2"
                    />
                    <input
                      type="number"
                      placeholder="起始"
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                      className="border rounded px-3 py-2"
                    />
                    <input
                      type="number"
                      placeholder="结束"
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value)}
                      className="border rounded px-3 py-2"
                    />
                    <input
                      type="number"
                      placeholder="步长"
                      value={rangeStep}
                      onChange={(e) => setRangeStep(e.target.value)}
                      className="border rounded px-3 py-2"
                    />
                  </div>
                  <button
                    onClick={addRangeParam}
                    className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                  >
                    添加范围参数
                  </button>
                </div>
                <div className="text-sm text-gray-500 mb-2">手动模式</div>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="参数名"
                    value={paramName}
                    onChange={(e) => setParamName(e.target.value)}
                    className="flex-1 border rounded px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="值，逗号分隔"
                    value={paramValues}
                    onChange={(e) => setParamValues(e.target.value)}
                    className="flex-1 border rounded px-3 py-2"
                  />
                  <button
                    onClick={addParam}
                    className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                  >
                    添加
                  </button>
                </div>
                {Object.entries(params).length > 0 && (
                  <div className="space-y-1">
                    {Object.entries(params).map(([name, vals]) => (
                      <div
                        key={name}
                        className="flex justify-between items-center bg-gray-100 p-2 rounded text-sm"
                      >
                        <span>
                          {name}: [{vals.join(", ")}]
                        </span>
                        <button
                          onClick={() => removeParam(name)}
                          className="text-red-500 hover:text-red-700"
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={runExperiment}
                disabled={!connected || loading}
                className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                {loading ? "执行中..." : "开始实验"}
              </button>
            </div>
          </div>

          {experimentResult && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">实验结果与同步</h2>
              <div className="space-y-2 text-sm mb-4">
                <div>
                  <span className="text-gray-500">状态:</span>{" "}
                  {experimentResult.status}
                </div>
                <div>
                  <span className="text-gray-500">结果目录:</span>{" "}
                  {experimentResult.result_dir}
                </div>
                <div>
                  <span className="text-gray-500">运行次数:</span>{" "}
                  {experimentResult.results?.length}
                </div>
              </div>
              <div className="mb-4">
                <h3 className="font-medium mb-2">结果文件</h3>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {resultFiles.map((f, i) => (
                    <div key={i} className="text-sm font-mono bg-gray-100 p-2 rounded">
                      {f}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <h3 className="font-medium mb-2">分析草稿 (analysis.md)</h3>
                <textarea
                  value={analysisContent}
                  onChange={(e) => setAnalysisContent(e.target.value)}
                  className="w-full border rounded px-3 py-2 h-40"
                  placeholder="在此撰写实验分析结论..."
                />
                <button
                  onClick={saveAnalysis}
                  className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  保存分析
                </button>
              </div>
              <button
                onClick={gitAddCommitPush}
                disabled={!connected || loading}
                className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 disabled:bg-gray-400"
              >
                Git Add → Commit → Push
              </button>
              <p className="text-xs text-gray-500 mt-2">
                未Push的实验结果仅本地可见，Push后团队成员可查看
              </p>
            </div>
          )}

          {shellOutput && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">Shell 输出</h2>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded overflow-x-auto text-sm">
                {shellOutput}
              </pre>
            </div>
          )}

          {experimentResult && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">实验结果</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">状态:</span>{" "}
                  {experimentResult.status}
                </div>
                <div>
                  <span className="text-gray-500">结果目录:</span>{" "}
                  {experimentResult.result_dir}
                </div>
                <div>
                  <span className="text-gray-500">运行次数:</span>{" "}
                  {experimentResult.results?.length}
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {experimentResult.results?.map((r: any, i: number) => (
                  <div
                    key={i}
                    className={`border p-3 rounded text-sm ${
                      r.returncode === 0
                        ? "border-green-300 bg-green-50"
                        : "border-red-300 bg-red-50"
                    }`}
                  >
                    <div className="font-medium">
                      运行 {i + 1}{" "}
                      {r.params && `(${JSON.stringify(r.params)})`}
                    </div>
                    <div>返回码: {r.returncode}</div>
                    {r.stdout && (
                      <pre className="mt-1 text-xs bg-white p-2 rounded overflow-x-auto">
                        {r.stdout}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
            </>
          )}

          {activeTab === "history" && (
            <>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">实验记录</h2>
                  <button
                    onClick={fetchExperiments}
                    disabled={loading}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    刷新记录
                  </button>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  展示本地 Git 仓库 results/ 目录下的所有实验记录。团队成员 Push 后 Pull 即可同步查看。
                </p>

                {experiments.length === 0 && (
                  <div className="text-gray-500 text-center py-8">
                    暂无实验记录。请先运行实验或确认 results/ 目录存在。
                  </div>
                )}

                <div className="space-y-3">
                  {experiments.map((exp, i) => (
                    <div key={i} className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() =>
                          selectedExperiment?.dir_path === exp.dir_path
                            ? setSelectedExperiment(null)
                            : fetchExperimentDetail(exp.dir_path)
                        }
                        className="w-full text-left p-4 hover:bg-gray-50 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              exp.structure?.is_complete
                                ? "bg-green-500"
                                : "bg-yellow-500"
                            }`}
                          />
                          <div>
                            <div className="font-medium">{exp.solver_name}</div>
                            <div className="text-sm text-gray-500">
                              {exp.timestamp}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!exp.structure?.is_complete && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                              结构异常
                            </span>
                          )}
                          <span className="text-gray-400">
                            {selectedExperiment?.dir_path === exp.dir_path
                              ? "▲"
                              : "▼"}
                          </span>
                        </div>
                      </button>

                      {selectedExperiment?.dir_path === exp.dir_path && (
                        <div className="border-t p-4 space-y-4">
                          {!selectedExperiment.structure?.is_complete && (
                            <div className="bg-yellow-50 border border-yellow-300 rounded p-3 text-sm text-yellow-800">
                              <span className="font-medium">目录结构异常：</span>
                              缺少 {selectedExperiment.structure?.missing?.join(", ")}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">目录：</span>
                              {selectedExperiment.dir_name}
                            </div>
                            <div>
                              <span className="text-gray-500">Solver：</span>
                              {selectedExperiment.solver_name}
                            </div>
                          </div>

                          {Object.keys(selectedExperiment.params_snapshot || {}).length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">参数快照</h4>
                              <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                                {JSON.stringify(selectedExperiment.params_snapshot, null, 2)}
                              </pre>
                            </div>
                          )}

                          {selectedExperiment.fig_files?.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">图表文件</h4>
                              <div className="space-y-1">
                                {selectedExperiment.fig_files.map((fig: string, fi: number) => (
                                  <div key={fi} className="text-sm font-mono bg-gray-100 p-2 rounded">
                                    fig/{fig}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {selectedExperiment.log && (
                            <div>
                              <h4 className="font-medium mb-2">运行日志</h4>
                              <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto max-h-48">
                                {selectedExperiment.log}
                              </pre>
                            </div>
                          )}

                          {selectedExperiment.analysis && (
                            <div>
                              <h4 className="font-medium mb-2">分析草稿</h4>
                              <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">
                                {selectedExperiment.analysis}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
