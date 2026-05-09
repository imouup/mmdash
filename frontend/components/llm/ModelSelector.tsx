import React, { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { llmApi } from "@/lib/api";
import { AlertCircle, Check, Loader2, Pencil } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LLMModel {
  id: string;
  description?: string;
}

interface ModelSelectorProps {
  teamId?: string;
  onModelSelected?: (bindingId: string, modelName: string) => void;
}

interface CurrentBinding {
  id: string;
  provider_type: string;
  team_id?: string | null;
  selected_model?: string | null;
  has_api_key: boolean;
}

export function ModelSelector({ teamId, onModelSelected }: ModelSelectorProps) {
  const [providers, setProviders] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("openai");
  const [apiKey, setApiKey] = useState<string>("");
  const [models, setModels] = useState<LLMModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [bindingId, setBindingId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [configured, setConfigured] = useState(false);
  const [editing, setEditing] = useState(false);
  const [currentBinding, setCurrentBinding] = useState<CurrentBinding | null>(null);

  // Load providers on mount
  useEffect(() => {
    void initialize();
  }, [teamId]);

  async function initialize() {
    setLoading(true);
    setError("");
    try {
      const provs: string[] = await llmApi.getProviders();
      setProviders(provs);

      // 默认先尝试 openai，如果没有再按列表回退
      const tryProviders = provs.includes("openai") ? ["openai", ...provs.filter((p: string) => p !== "openai")] : provs;
      let foundBinding: CurrentBinding | null = null;
      for (const p of tryProviders) {
        const binding = await llmApi.getCurrentBinding(p, teamId);
        if (binding) {
          foundBinding = binding;
          break;
        }
      }

      if (foundBinding) {
        setCurrentBinding(foundBinding);
        setBindingId(foundBinding.id);
        setSelectedProvider(foundBinding.provider_type);
        setSelectedModel(foundBinding.selected_model || "");
        setConfigured(true);
        setEditing(false);
        const modelsList = await llmApi.getModels(foundBinding.id, foundBinding.provider_type, teamId);
        setModels(modelsList);
      } else {
        setConfigured(false);
        setEditing(true);
      }
    } catch (err: any) {
      setError("初始化失败: " + (err.response?.data?.detail || err.message || "未知错误"));
      setConfigured(false);
      setEditing(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleTestAndList() {
    if (!apiKey.trim()) {
      setError("请输入 API Key");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Create binding
      const bindingRes = await llmApi.createBinding(
        selectedProvider,
        { api_key: apiKey },
        teamId
      );
      setBindingId(bindingRes.binding_id);

      // Load models
      const modelsList = await llmApi.getModels(bindingRes.binding_id, selectedProvider, teamId);
      setModels(modelsList);
      setConfigured(true);
      setEditing(false);
      setCurrentBinding({
        id: bindingRes.binding_id,
        provider_type: selectedProvider,
        team_id: teamId || null,
        selected_model: "",
        has_api_key: true,
      });
      setSuccess(`已获取 ${modelsList.length} 个 ${selectedProvider} 模型，请选择一个。`);
    } catch (err: any) {
      setError(
        "获取模型列表失败: " +
          (err.response?.data?.detail || err.message || "未知错误")
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectModel() {
    if (!bindingId || !selectedModel) {
      setError("请先完成提供商配置并选择模型");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await llmApi.selectModel(bindingId, selectedModel);
      setCurrentBinding((prev) =>
        prev
          ? {
              ...prev,
              selected_model: selectedModel,
            }
          : prev
      );
      setSuccess(`已切换到模型「${selectedModel}」`);
      onModelSelected?.(bindingId, selectedModel);
    } catch (err: any) {
      setError(
        "保存模型选择失败: " +
          (err.response?.data?.detail || err.message || "未知错误")
      );
    } finally {
      setLoading(false);
    }
  }

  function handleEditConfig() {
    setEditing(true);
    setConfigured(false);
    setModels([]);
    setSelectedModel("");
    setBindingId("");
    setCurrentBinding(null);
    setApiKey("");
    setError("");
    setSuccess("");
  }

  const activeModel = currentBinding?.selected_model || selectedModel;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>LLM 模型配置</CardTitle>
        <CardDescription>
          配置并选择你要使用的 LLM 模型{teamId ? "（团队共享）" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="text-sm text-muted-foreground flex items-center">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        )}

        {!loading && configured && !editing && (
          <>
            <div className="rounded-md border p-3 space-y-1">
              <div className="text-sm text-muted-foreground">当前提供商</div>
              <div className="font-medium">{currentBinding?.provider_type}</div>
              <div className="text-sm text-muted-foreground">当前模型</div>
              <div className="font-medium">{activeModel || "未选择"}</div>
            </div>

            {models.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">可用模型列表</div>
                <div className="max-h-64 overflow-auto rounded-md border">
                  {models.map((model) => {
                    const isActive = activeModel === model.id;
                    return (
                      <button
                        type="button"
                        key={model.id}
                        className="w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-muted/40"
                        onClick={() => setSelectedModel(model.id)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate">
                            <div className="font-medium">{model.id}</div>
                            {model.description && (
                              <div className="text-xs text-muted-foreground truncate">{model.description}</div>
                            )}
                          </div>
                          {isActive && <Check className="h-4 w-4 text-green-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Button
                  onClick={handleSelectModel}
                  disabled={loading || !selectedModel || selectedModel === activeModel}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    "切换到所选模型"
                  )}
                </Button>
              </div>
            )}

            <Button variant="outline" onClick={handleEditConfig} className="w-full">
              <Pencil className="mr-2 h-4 w-4" />
              编辑并重新配置提供商
            </Button>
          </>
        )}

        {(!configured || editing) && (
          <>
        {/* Provider Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">提供商</label>
          <Select value={selectedProvider} onValueChange={setSelectedProvider}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* API Key Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">API Key</label>
          <Input
            type="password"
            placeholder="请输入 API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        {/* List Models Button */}
        <Button
          onClick={handleTestAndList}
          disabled={loading || !apiKey.trim()}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在获取模型...
            </>
          ) : (
            "获取可用模型"
          )}
        </Button>

        {/* Model Selection */}
        {models.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">选择模型</label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue placeholder="请选择模型..." />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.id}
                    {model.description && ` - ${model.description}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Confirm Selection Button */}
        {models.length > 0 && (
          <Button
            onClick={handleSelectModel}
            disabled={loading || !selectedModel}
            variant="default"
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              "确认使用该模型"
            )}
          </Button>
        )}
          </>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Alert */}
        {success && (
          <Alert className="border-green-600 bg-green-50">
            <AlertCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
