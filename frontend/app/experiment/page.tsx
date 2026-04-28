"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  connectLocalAgent,
  disconnectLocalAgent,
  isConnected,
  sendAction,
} from "@/lib/local_agent";

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
  const [experimentResult, setExperimentResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    checkConnection();
    return () => {
      disconnectLocalAgent();
    };
  }, []);

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
      setMessage("实验执行完成");
    } catch (err: any) {
      setMessage("实验执行失败: " + err.message);
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
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
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
        </div>
      </div>
    </DashboardLayout>
  );
}
