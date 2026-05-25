import { ClearOutlined, DeleteOutlined, EditOutlined, ImportOutlined, PlusOutlined, ReloadOutlined, SaveOutlined, SearchOutlined, UploadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Drawer, Form, Input, InputNumber, Popconfirm, Select, Space, Switch, Table, Tag, Upload, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { RcFile } from "antd/es/upload";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { getEnvFile, getEnvFileContent, importEnvFile, saveEnvFile, saveEnvFileContent } from "../../api/settings";
import { deleteAppContextSource, getAppContextOverview, getAppContextSource, saveAppContextSource } from "../../api/context";
import { EnvSelector } from "../../components/EnvSelector";
import { PageHeader } from "../../components/PageHeader";
import { useSettingStore } from "../../stores/useSettingStore";
import type { EnvFileConfig, EnvVariable, TestEnv, VideoMode } from "../../types/settings";
import type { AppAuthSourceOverview, AppContextOverview, AppContextSourceDetail } from "../../types/context";
import { CaseTypeSettingsCard } from "./case-type-settings";
import { filterEnvVariables, type EnvVariableSearchRow } from "./env-variable-search";
import { isSensitiveKey, parseRunPreferences, upsertVariableValue } from "./run-preferences";
import { envVariableRowKey } from "./settings-row-key";
import { envVariablePageSize, routeContextLoadDelayMs, sensitiveUsernameFormName, sensitiveValueFormName } from "./settings-rendering";

const contextBodyLimitMb = Number(import.meta.env.VITE_APP_CONTEXT_BODY_LIMIT_MB || 5);

export default function Settings() {
  const {
    env,
    headless,
    slowMo,
    trace,
    screenshot,
    video,
    flowLoginTimeoutMs,
    visualMode,
    apiBusinessCodeStrict,
    setEnv,
    setHeadless,
    setSlowMo,
    setTrace,
    setScreenshot,
    setVideo,
    setFlowLoginTimeoutMs,
    setVisualMode,
    setApiBusinessCodeStrict
  } = useSettingStore();
  const [config, setConfig] = useState<EnvFileConfig>();
  const [variables, setVariables] = useState<EnvVariable[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [variableSearchText, setVariableSearchText] = useState("");
  const [envEditorOpen, setEnvEditorOpen] = useState(false);
  const [envContent, setEnvContent] = useState("");
  const [envContentLoading, setEnvContentLoading] = useState(false);
  const [envContentSaving, setEnvContentSaving] = useState(false);
  const [routeContext, setRouteContext] = useState<AppContextOverview>();
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeSaving, setRouteSaving] = useState(false);
  const [routeImportingSource, setRouteImportingSource] = useState("");
  const [routeEditorOpen, setRouteEditorOpen] = useState(false);
  const [routeSourceKey, setRouteSourceKey] = useState("");
  const [routeFileName, setRouteFileName] = useState("");
  const [routeDraft, setRouteDraft] = useState("");
  const [routeDetail, setRouteDetail] = useState<AppContextSourceDetail>();
  const [messageApi, contextHolder] = message.useMessage();

  const sourceText = useMemo(
    () => ({
      file: "当前环境文件",
      base: "基础 .env",
      template: ".env.example"
    }),
    []
  );
  const visibleVariables = useMemo(() => filterEnvVariables(variables, variableSearchText), [variables, variableSearchText]);

  const syncRunPreferences = (nextVariables: EnvVariable[]) => {
    const next = parseRunPreferences(nextVariables);
    setHeadless(next.headless);
    setSlowMo(next.slowMo);
    setTrace(next.trace);
    setScreenshot(next.screenshot);
    setVideo(next.video);
    setFlowLoginTimeoutMs(next.flowLoginTimeoutMs);
    setVisualMode(next.visualMode);
    setApiBusinessCodeStrict(next.apiBusinessCodeStrict);
  };

  const loadConfig = async () => {
    setLoading(true);
    try {
      const next = await getEnvFile(env);
      setConfig(next);
      setVariables(next.variables);
      syncRunPreferences(next.variables);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "读取环境配置失败");
    } finally {
      setLoading(false);
    }
  };

  const loadRouteContext = async () => {
    setRouteLoading(true);
    try {
      setRouteContext(await getAppContextOverview());
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "读取路由上下文失败");
    } finally {
      setRouteLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
  }, [env]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRouteContext();
    }, routeContextLoadDelayMs);
    return () => window.clearTimeout(timer);
  }, []);

  const updateVariable = (index: number, patch: Partial<EnvVariable>) => {
    setVariables((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ...patch,
              source: "file",
              sensitive: patch.key ? isSensitiveKey(patch.key) : item.sensitive
            }
          : item
      )
    );
  };

  const addVariable = () => {
    setVariableSearchText("");
    setVariables((items) => [...items, { key: "", value: "", source: "file", sensitive: false }]);
  };

  const removeVariable = (index: number) => {
    setVariables((items) => items.filter((_, itemIndex) => itemIndex !== index));
  };

  const persistVariables = async (nextVariables: EnvVariable[], successMessage?: string) => {
    setSaving(true);
    try {
      const saved = await saveEnvFile(env, nextVariables);
      setConfig(saved);
      setVariables(saved.variables);
      syncRunPreferences(saved.variables);
      if (successMessage) {
        messageApi.success(successMessage);
      }
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "保存环境配置失败");
    } finally {
      setSaving(false);
    }
  };

  const setVariableValue = (key: string, value: string): EnvVariable[] => {
    const nextVariables = upsertVariableValue(variables, key, value);
    setVariables(nextVariables);
    return nextVariables;
  };

  const applyRunPreference = (key: string, value: string) => {
    const nextVariables = setVariableValue(key, value);
    void persistVariables(nextVariables);
  };

  const handleHeadlessChange = (checked: boolean) => {
    setHeadless(checked);
    applyRunPreference("HEADLESS", checked ? "true" : "false");
  };

  const handleSlowMoChange = (value: number | null) => {
    const next = Number(value ?? 0);
    setSlowMo(next);
    applyRunPreference("SLOW_MO", String(next));
  };

  const handleTraceChange = (checked: boolean) => {
    setTrace(checked);
    applyRunPreference("TRACE", checked ? "on" : "off");
  };

  const handleScreenshotChange = (checked: boolean) => {
    setScreenshot(checked);
    applyRunPreference("SCREENSHOT", checked ? "only-on-failure" : "off");
  };

  const handleVideoChange = (value: VideoMode) => {
    setVideo(value);
    applyRunPreference("VIDEO", value);
  };

  const handleFlowLoginTimeoutChange = (value: number | null) => {
    const next = Number(value ?? 0);
    setFlowLoginTimeoutMs(next);
    applyRunPreference("FLOW_LOGIN_TIMEOUT_MS", String(next));
  };

  const handleVisualModeChange = (checked: boolean) => {
    setVisualMode(checked);
    applyRunPreference("VISUAL_MODE", checked ? "true" : "false");
  };

  const handleApiBusinessCodeStrictChange = (checked: boolean) => {
    setApiBusinessCodeStrict(checked);
    applyRunPreference("API_BUSINESS_CODE_STRICT", checked ? "true" : "false");
  };

  const handleSave = async () => {
    await persistVariables(variables, `已保存 ${config?.fileName ?? "环境文件"}`);
  };

  const openEnvEditor = async () => {
    setEnvEditorOpen(true);
    setEnvContentLoading(true);
    try {
      const file = await getEnvFileContent(env);
      setEnvContent(file.content);
    } catch (error) {
      setEnvEditorOpen(false);
      messageApi.error(error instanceof Error ? error.message : "读取 env 文件失败");
    } finally {
      setEnvContentLoading(false);
    }
  };

  const closeEnvEditor = () => {
    setEnvEditorOpen(false);
    setEnvContent("");
  };

  const handleSaveEnvContent = async () => {
    setEnvContentSaving(true);
    try {
      const saved = await saveEnvFileContent(env, envContent);
      setConfig(saved);
      setVariables(saved.variables);
      syncRunPreferences(saved.variables);
      messageApi.success(`已保存 ${saved.fileName}`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "保存 env 文件失败");
    } finally {
      setEnvContentSaving(false);
    }
  };

  const handleImportEnvFile = async (file: RcFile) => {
    const maxSize = 1024 * 1024;
    if (file.size > maxSize) {
      messageApi.error("env 文件不能超过 1MB");
      return Upload.LIST_IGNORE;
    }

    setImporting(true);
    try {
      const content = await file.text();
      const targetEnv = extractTargetEnv(content) ?? env;
      const saved = await importEnvFile(targetEnv, content);
      const beforeKeys = new Set(variables.map((item) => item.key).filter(Boolean));
      const importedKeys = extractEnvKeys(content);
      const overwrittenCount = importedKeys.filter((key) => beforeKeys.has(key)).length;
      if (targetEnv !== env) {
        setEnv(targetEnv);
      }
      setConfig(saved);
      setVariables(saved.variables);
      syncRunPreferences(saved.variables);
      messageApi.success(`已导入 ${importedKeys.length} 个变量，覆盖 ${overwrittenCount} 个重复项`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "导入 env 文件失败");
    } finally {
      setImporting(false);
    }

    return Upload.LIST_IGNORE;
  };

  const handleClearVariables = async () => {
    await persistVariables([], `已清空 ${config?.fileName ?? "环境文件"} 中保存的变量`);
  };

  const openNewRouteSource = () => {
    const existing = new Set((routeContext?.sources ?? []).map((source) => source.source));
    let index = existing.size + 1;
    let source = `source${index}`;
    while (existing.has(source)) {
      index += 1;
      source = `source${index}`;
    }
    setRouteDetail(undefined);
    setRouteSourceKey(source);
    setRouteFileName(`${source}.json`);
    setRouteDraft("[]");
    setRouteEditorOpen(true);
  };

  const openRouteSource = async (source: string) => {
    setRouteSaving(true);
    setRouteEditorOpen(true);
    try {
      const detail = await getAppContextSource(source);
      setRouteDetail(detail);
      setRouteSourceKey(detail.source);
      setRouteFileName(detail.fileName);
      setRouteDraft(detail.content);
    } catch (error) {
      setRouteEditorOpen(false);
      messageApi.error(error instanceof Error ? error.message : "读取路由来源失败");
    } finally {
      setRouteSaving(false);
    }
  };

  const closeRouteSourceEditor = () => {
    setRouteEditorOpen(false);
    setRouteDetail(undefined);
    setRouteSourceKey("");
    setRouteFileName("");
    setRouteDraft("");
  };

  const handleSaveRouteSource = async () => {
    if (!isRouteSourceKey(routeSourceKey)) {
      messageApi.error("路由来源标识只能使用字母开头的英文、数字、下划线或中划线，最长 64 位");
      return;
    }
    if (!routeFileName.trim()) {
      messageApi.error("文件名不能为空");
      return;
    }
    setRouteSaving(true);
    try {
      const detail = await saveAppContextSource({
        source: routeSourceKey,
        fileName: routeFileName,
        content: routeDraft
      });
      setRouteDetail(detail);
      setRouteSourceKey(detail.source);
      setRouteFileName(detail.fileName);
      setRouteDraft(detail.content);
      await loadRouteContext();
      messageApi.success(`已保存并解析 ${detail.summary.routeCount} 条 ${detail.source} 路由`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "保存路由来源失败");
    } finally {
      setRouteSaving(false);
    }
  };

  const handleImportRouteSource = async (source: string, file: RcFile) => {
    const maxSize = contextBodyLimitMb * 1024 * 1024;
    if (file.size > maxSize) {
      messageApi.error(`路由文件不能超过 ${contextBodyLimitMb}MB`);
      return Upload.LIST_IGNORE;
    }

    setRouteImportingSource(source);
    try {
      const detail = await saveAppContextSource({
        source,
        fileName: file.name,
        content: await file.text()
      });
      await loadRouteContext();
      messageApi.success(`已导入并解析 ${detail.summary.routeCount} 条 ${source} 路由`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "导入路由来源失败");
    } finally {
      setRouteImportingSource("");
    }

    return Upload.LIST_IGNORE;
  };

  const handleDeleteRouteSource = async (source: string) => {
    setRouteLoading(true);
    try {
      setRouteContext(await deleteAppContextSource(source));
      messageApi.success(`已删除 ${source} 路由来源`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "删除路由来源失败");
    } finally {
      setRouteLoading(false);
    }
  };

  const columns: ColumnsType<EnvVariableSearchRow> = [
    {
      title: "变量名",
      dataIndex: "key",
      width: 260,
      render: (value: string, record) => (
        <Input value={value} placeholder="例如 USER_LOGIN_URL" onChange={(event) => updateVariable(record.originalIndex, { key: event.target.value })} />
      )
    },
    {
      title: "变量值",
      dataIndex: "value",
      render: (value: string, record) =>
        record.sensitive ? (
          <form autoComplete="off" onSubmit={(event) => event.preventDefault()}>
            <input
              aria-hidden="true"
              autoComplete="username"
              className="hidden"
              name={sensitiveUsernameFormName(record.originalIndex)}
              readOnly
              tabIndex={-1}
              type="text"
              value={record.key}
            />
            <Input.Password
              name={sensitiveValueFormName(record.originalIndex)}
              value={value}
              autoComplete="current-password"
              onChange={(event) => updateVariable(record.originalIndex, { value: event.target.value })}
            />
          </form>
        ) : (
          <Input value={value} onChange={(event) => updateVariable(record.originalIndex, { value: event.target.value })} />
        )
    },
    {
      title: "来源",
      dataIndex: "source",
      width: 130,
      render: (value: EnvVariable["source"]) => <Tag color={value === "file" ? "green" : value === "base" ? "blue" : "default"}>{sourceText[value]}</Tag>
    },
    {
      title: "说明",
      dataIndex: "comment",
      width: 220,
      render: (value: string | undefined, record) => (
        <Input value={value} placeholder="可选" onChange={(event) => updateVariable(record.originalIndex, { comment: event.target.value })} />
      )
    },
    {
      title: "操作",
      width: 80,
      render: (_value, record) => (
        <Popconfirm title="删除这个变量？" okText="删除" cancelText="取消" onConfirm={() => removeVariable(record.originalIndex)}>
          <Button danger type="text" icon={<DeleteOutlined />} />
        </Popconfirm>
      )
    }
  ];

  const routeColumns: ColumnsType<AppAuthSourceOverview> = [
    {
      title: "来源",
      dataIndex: "source",
      width: 140,
      render: (value: string) => <Tag className="mr-0">{value}</Tag>
    },
    {
      title: "文件",
      dataIndex: "authFile",
      width: 220,
      render: (value: string) => <span className="block truncate">{value || "-"}</span>
    },
    {
      title: "路由",
      dataIndex: "routeCount",
      width: 110,
      render: (value: number, record) => `${value} / ${record.visibleRouteCount}`
    },
    {
      title: "解析位置",
      dataIndex: "routeSourceKey",
      render: (value: string | undefined) => <span className="block truncate text-slate-500">{value || "-"}</span>
    },
    {
      title: "操作",
      width: 260,
      render: (_value, record) => (
        <Space size={6}>
          <Upload accept=".json,.js,.ts,.tsx" showUploadList={false} beforeUpload={(file) => handleImportRouteSource(record.source, file)}>
            <Button size="small" icon={<UploadOutlined />} loading={routeImportingSource === record.source}>
              导入
            </Button>
          </Upload>
          <Button size="small" icon={<EditOutlined />} onClick={() => void openRouteSource(record.source)}>
            查看修改
          </Button>
          <Popconfirm
            title={`删除 ${record.source} 路由来源？`}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => void handleDeleteRouteSource(record.source)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="flex min-h-full flex-col gap-2.5">
      {contextHolder}
      <PageHeader title="运行设置" description="维护不同测试环境的运行配置，并设置前端默认执行环境。" />
      <div className="grid grid-cols-[360px_minmax(0,1fr)] gap-2.5">
        <Card title="环境" className="h-full">
          <Form layout="vertical" className="[&_.ant-form-item]:mb-2.5">
            <Form.Item label="默认环境">
              <EnvSelector value={env} onChange={setEnv} />
            </Form.Item>
            {config ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-3 py-1">
                  <span className="text-slate-500">配置文件</span>
                  <span className="font-medium text-slate-900">{config.fileName}</span>
                </div>
                <div className="flex items-center justify-between gap-3 py-1">
                  <span className="text-slate-500">状态</span>
                  <Tag color={config.exists ? "green" : "orange"} className="mr-0">
                    {config.exists ? "已创建" : "未创建"}
                  </Tag>
                </div>
                {config.updatedAt ? (
                  <div className="flex items-center justify-between gap-3 py-1">
                    <span className="text-slate-500">更新时间</span>
                    <span className="text-right">{new Date(config.updatedAt).toLocaleString()}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Form>
        </Card>
        <Card title="运行偏好" className="h-full">
          <div className="grid grid-cols-4 gap-2.5">
            <PreferenceItem title="Headless" value={headless ? "true" : "false"}>
              <Switch checked={headless} onChange={handleHeadlessChange} />
            </PreferenceItem>
            <PreferenceItem title="SlowMo" value={`${slowMo} ms`}>
              <Space.Compact className="w-full">
                <InputNumber className="!w-full min-w-0" min={0} max={3000} step={50} value={slowMo} onChange={handleSlowMoChange} />
                <span className="inline-flex h-8 shrink-0 items-center rounded-r-md border border-l-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-600">
                  ms
                </span>
              </Space.Compact>
            </PreferenceItem>
            <PreferenceItem title="Trace" value={trace ? "on" : "off"}>
              <Switch checked={trace} onChange={handleTraceChange} />
            </PreferenceItem>
            <PreferenceItem title="Screenshot" value={screenshot ? "only-on-failure" : "off"}>
              <Switch checked={screenshot} onChange={handleScreenshotChange} />
            </PreferenceItem>
            <PreferenceItem title="Video" value={video}>
              <Select
                className="!w-full"
                value={video}
                onChange={handleVideoChange}
                options={[
                  { label: "失败保留", value: "retain-on-failure" },
                  { label: "开启", value: "on" },
                  { label: "关闭", value: "off" }
                ]}
              />
            </PreferenceItem>
            <PreferenceItem title="Login Timeout" value={`${flowLoginTimeoutMs} ms`}>
              <Space.Compact className="w-full">
                <InputNumber
                  className="!w-full min-w-0"
                  min={1000}
                  max={60000}
                  step={1000}
                  value={flowLoginTimeoutMs}
                  onChange={handleFlowLoginTimeoutChange}
                />
                <span className="inline-flex h-8 shrink-0 items-center rounded-r-md border border-l-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-600">
                  ms
                </span>
              </Space.Compact>
            </PreferenceItem>
            <PreferenceItem title="Visual Mode" value={visualMode ? "true" : "false"}>
              <Switch checked={visualMode} onChange={handleVisualModeChange} />
            </PreferenceItem>
            <PreferenceItem title="Strict API Code" value={apiBusinessCodeStrict ? "true" : "false"}>
              <Switch checked={apiBusinessCodeStrict} onChange={handleApiBusinessCodeStrictChange} />
            </PreferenceItem>
          </div>
        </Card>
      </div>
      <Card
        title="路由上下文来源"
        extra={
          <Space>
            <Button icon={<PlusOutlined />} onClick={openNewRouteSource}>
              新增来源
            </Button>
            <Button icon={<ReloadOutlined />} loading={routeLoading} onClick={loadRouteContext}>
              重载
            </Button>
          </Space>
        }
      >
        <Table
          size="middle"
          rowKey="source"
          loading={routeLoading}
          pagination={false}
          columns={routeColumns}
          dataSource={routeContext?.sources ?? []}
          scroll={{ y: 260 }}
        />
      </Card>
      <CaseTypeSettingsCard />
      <Card
        title={
          <Space size={14}>
            <span>环境变量</span>
            <Input
              className="w-[260px]"
              allowClear
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="搜索变量名/变量值/说明"
              value={variableSearchText}
              onChange={(event) => setVariableSearchText(event.target.value)}
            />
          </Space>
        }
        extra={
          <Space>
            <Button icon={<EditOutlined />} loading={envContentLoading} onClick={() => void openEnvEditor()}>
              查看修改
            </Button>
            <Upload accept=".env,.local,.txt" showUploadList={false} beforeUpload={handleImportEnvFile}>
              <Button icon={<ImportOutlined />} loading={importing}>
                导入 env
              </Button>
            </Upload>
            <Popconfirm
              title="清空当前环境变量？"
              description={`会清空 ${config?.fileName ?? "当前环境文件"} 中已保存的变量，基础配置和模板变量仍会作为缺失项提示显示。`}
              okText="清空"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={handleClearVariables}
            >
              <Button danger icon={<ClearOutlined />} disabled={saving || loading || importing}>
                清空
              </Button>
            </Popconfirm>
            <Button icon={<PlusOutlined />} onClick={addVariable}>
              新增变量
            </Button>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={loadConfig}>
              重载
            </Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
              保存到 {config?.fileName ?? "环境文件"}
            </Button>
          </Space>
        }
      >
        {config?.missingKeys.length ? (
          <Alert
            showIcon
            type="info"
            className="mb-2.5"
            title={`当前 ${config.fileName} 缺少 ${config.missingKeys.length} 个模板变量，已从基础配置或模板带入，保存后会写入当前环境文件。`}
          />
        ) : null}
        <Table
          size="middle"
          rowKey={envVariableRowKey}
          loading={loading}
          pagination={{
            pageSize: envVariablePageSize,
            showSizeChanger: false,
            hideOnSinglePage: visibleVariables.length <= envVariablePageSize
          }}
          columns={columns}
          dataSource={visibleVariables}
          locale={{ emptyText: variableSearchText.trim() ? "没有匹配的环境变量" : "暂无环境变量" }}
          scroll={{ y: "calc(100vh - 520px)" }}
        />
      </Card>
      <Drawer
        title={`查看修改 ${config?.fileName ?? "env 文件"}`}
        size={760}
        open={envEditorOpen}
        destroyOnClose
        onClose={closeEnvEditor}
        extra={
          <Space>
            <Button onClick={closeEnvEditor}>关闭</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={envContentSaving} onClick={() => void handleSaveEnvContent()}>
              保存
            </Button>
          </Space>
        }
      >
        <Space orientation="vertical" size={10} className="w-full">
          <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
            <span>{config?.fileName ?? "env 文件"}</span>
            <span>{config?.updatedAt ? new Date(config.updatedAt).toLocaleString() : "未创建"}</span>
          </div>
          <Input.TextArea
            value={envContent}
            disabled={envContentLoading || envContentSaving}
            rows={28}
            spellCheck={false}
            className="font-mono"
            placeholder="KEY=value"
            onChange={(event) => setEnvContent(event.target.value)}
          />
        </Space>
      </Drawer>
      <Drawer
        title={routeDetail ? `${routeDetail.source} 路由来源` : "新增路由来源"}
        size={760}
        open={routeEditorOpen}
        destroyOnClose
        onClose={closeRouteSourceEditor}
        extra={
          <Button type="primary" icon={<SaveOutlined />} loading={routeSaving} onClick={() => void handleSaveRouteSource()}>
            保存并解析
          </Button>
        }
      >
        <Space orientation="vertical" size={10} className="w-full">
          <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-2.5">
            <Input
              value={routeSourceKey}
              disabled={Boolean(routeDetail) || routeSaving}
              placeholder="source"
              onChange={(event) => setRouteSourceKey(event.target.value)}
            />
            <Input value={routeFileName} disabled={routeSaving} placeholder="路由来源文件名" onChange={(event) => setRouteFileName(event.target.value)} />
          </div>
          <Input.TextArea
            value={routeDraft}
            disabled={routeSaving}
            rows={22}
            spellCheck={false}
            placeholder="粘贴 JSON、JS/TS 路由数组、menus/menuList/auths 等菜单树内容"
            onChange={(event) => setRouteDraft(event.target.value)}
          />
          <div className="text-xs text-[#8a95a6]">
            当前解析：{routeDetail?.summary.routeCount ?? 0} 条路由
            {routeDetail?.updatedAt ? `，保存于 ${new Date(routeDetail.updatedAt).toLocaleString()}` : ""}
          </div>
        </Space>
      </Drawer>
    </div>
  );
}

function isRouteSourceKey(source: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(source.trim());
}

function extractEnvKeys(content: string): string[] {
  const keys = new Set<string>();
  for (const line of content.split(/\r?\n/)) {
    const match = line.trim().match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match?.[1]) {
      keys.add(match[1]);
    }
  }
  return [...keys];
}

function extractTargetEnv(content: string): TestEnv | undefined {
  const match = content.match(/^\s*(?:export\s+)?TEST_ENV\s*=\s*(.+?)\s*$/m);
  const value = match?.[1]?.trim().replace(/^['"]|['"]$/g, "");
  return value && isTestEnv(value) ? value : undefined;
}

function isTestEnv(value: string): value is TestEnv {
  return ["local", "dev", "sit", "prod"].includes(value);
}

function PreferenceItem({ title, value, children }: { title: string; value: string; children: ReactNode }) {
  return (
    <div className="flex h-[90px] flex-col justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 truncate text-sm font-medium leading-5 text-slate-900" title={title}>
          {title}
        </div>
        <div className="max-w-[50%] shrink-0 truncate text-right text-xs leading-5 text-slate-500" title={value}>
          {value}
        </div>
      </div>
      <div className="mt-3 flex min-h-8 w-full items-center justify-end">{children}</div>
    </div>
  );
}
