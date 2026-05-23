import { ClearOutlined, DeleteOutlined, EditOutlined, ImportOutlined, PlusOutlined, ReloadOutlined, SaveOutlined, UploadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Drawer, Form, Input, InputNumber, Popconfirm, Space, Switch, Table, Tag, Upload, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { RcFile } from "antd/es/upload";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { getEnvFile, getEnvFileContent, importEnvFile, saveEnvFile, saveEnvFileContent } from "../../api/settings";
import { deleteAppContextSource, getAppContext, getAppContextSource, saveAppContextSource } from "../../api/context";
import { EnvSelector } from "../../components/EnvSelector";
import { PageHeader } from "../../components/PageHeader";
import { useSettingStore } from "../../stores/useSettingStore";
import type { EnvFileConfig, EnvVariable, TestEnv } from "../../types/settings";
import type { AppAuthSourceSummary, AppContextSourceDetail, AppContextSummary } from "../../types/context";

const contextBodyLimitMb = Number(import.meta.env.VITE_APP_CONTEXT_BODY_LIMIT_MB || 5);

export default function Settings() {
  const {
    env,
    headless,
    slowMo,
    trace,
    screenshot,
    setEnv,
    setHeadless,
    setSlowMo,
    setTrace,
    setScreenshot
  } = useSettingStore();
  const [config, setConfig] = useState<EnvFileConfig>();
  const [variables, setVariables] = useState<EnvVariable[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [envEditorOpen, setEnvEditorOpen] = useState(false);
  const [envContent, setEnvContent] = useState("");
  const [envContentLoading, setEnvContentLoading] = useState(false);
  const [envContentSaving, setEnvContentSaving] = useState(false);
  const [routeContext, setRouteContext] = useState<AppContextSummary>();
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

  const syncRunPreferences = (nextVariables: EnvVariable[]) => {
    const valueOf = (key: string) => nextVariables.find((item) => item.key === key)?.value;
    const nextSlowMo = Number(valueOf("SLOW_MO") ?? 100);
    setHeadless(valueOf("HEADLESS") === "true");
    setSlowMo(Number.isFinite(nextSlowMo) ? nextSlowMo : 100);
    setTrace(valueOf("TRACE") !== "off");
    setScreenshot(valueOf("SCREENSHOT") !== "off");
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
      setRouteContext(await getAppContext());
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
    void loadRouteContext();
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

  const columns: ColumnsType<EnvVariable> = [
    {
      title: "变量名",
      dataIndex: "key",
      width: 260,
      render: (value: string, _record, index) => (
        <Input value={value} placeholder="例如 USER_LOGIN_URL" onChange={(event) => updateVariable(index, { key: event.target.value })} />
      )
    },
    {
      title: "变量值",
      dataIndex: "value",
      render: (value: string, record, index) =>
        record.sensitive ? (
          <Input.Password value={value} autoComplete="new-password" onChange={(event) => updateVariable(index, { value: event.target.value })} />
        ) : (
          <Input value={value} onChange={(event) => updateVariable(index, { value: event.target.value })} />
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
      render: (value: string | undefined, _record, index) => (
        <Input value={value} placeholder="可选" onChange={(event) => updateVariable(index, { comment: event.target.value })} />
      )
    },
    {
      title: "操作",
      width: 80,
      render: (_value, _record, index) => (
        <Popconfirm title="删除这个变量？" okText="删除" cancelText="取消" onConfirm={() => removeVariable(index)}>
          <Button danger type="text" icon={<DeleteOutlined />} />
        </Popconfirm>
      )
    }
  ];

  const routeColumns: ColumnsType<AppAuthSourceSummary> = [
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
          <div className="grid grid-cols-2 gap-3">
            <PreferenceItem title="Headless" value={headless ? "true" : "false"}>
              <Switch checked={headless} onChange={handleHeadlessChange} />
            </PreferenceItem>
            <PreferenceItem title="SlowMo" value={`${slowMo} ms`}>
              <Space.Compact>
                <InputNumber min={0} max={3000} step={50} value={slowMo} onChange={handleSlowMoChange} />
                <span className="inline-flex h-8 items-center rounded-r-md border border-l-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-600">
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
      <Card
        title="环境变量"
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
          rowKey={(record) => record.key || `new-${variables.indexOf(record)}`}
          loading={loading}
          pagination={false}
          columns={columns}
          dataSource={variables}
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

function isSensitiveKey(key: string): boolean {
  return /(password|token|secret|key|cookie|authorization|apikey)/i.test(key);
}

function isRouteSourceKey(source: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(source.trim());
}

function upsertVariableValue(variables: EnvVariable[], key: string, value: string): EnvVariable[] {
  const index = variables.findIndex((item) => item.key === key);
  if (index < 0) {
    return [...variables, { key, value, source: "file", sensitive: isSensitiveKey(key) }];
  }
  return variables.map((item, itemIndex) => (itemIndex === index ? { ...item, value, source: "file" } : item));
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
    <div className="flex min-h-[86px] items-center justify-between gap-2.5 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-900">{title}</div>
        <div className="mt-1 truncate text-xs text-slate-500">{value}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
