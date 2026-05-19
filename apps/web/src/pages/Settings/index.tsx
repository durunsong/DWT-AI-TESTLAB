import { DeleteOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, InputNumber, Popconfirm, Space, Switch, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { getEnvFile, saveEnvFile } from "../../api/settings";
import { EnvSelector } from "../../components/EnvSelector";
import { PageHeader } from "../../components/PageHeader";
import { useSettingStore } from "../../stores/useSettingStore";
import type { EnvFileConfig, EnvVariable } from "../../types/settings";

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

  useEffect(() => {
    void loadConfig();
  }, [env]);

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

  return (
    <div className="flex min-h-full flex-col gap-4">
      {contextHolder}
      <PageHeader title="运行设置" description="维护不同测试环境的运行配置，并设置前端默认执行环境。" />
      <div className="grid grid-cols-[360px_minmax(0,1fr)] gap-4">
        <Card title="环境" className="h-full">
          <Form layout="vertical" className="[&_.ant-form-item]:mb-4">
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
        title="环境变量"
        extra={
          <Space>
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
            className="mb-4"
            message={`当前 ${config.fileName} 缺少 ${config.missingKeys.length} 个模板变量，已从基础配置或模板带入，保存后会写入当前环境文件。`}
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
    </div>
  );
}

function isSensitiveKey(key: string): boolean {
  return /(password|token|secret|key|cookie|authorization|apikey)/i.test(key);
}

function upsertVariableValue(variables: EnvVariable[], key: string, value: string): EnvVariable[] {
  const index = variables.findIndex((item) => item.key === key);
  if (index < 0) {
    return [...variables, { key, value, source: "file", sensitive: isSensitiveKey(key) }];
  }
  return variables.map((item, itemIndex) => (itemIndex === index ? { ...item, value, source: "file" } : item));
}

function PreferenceItem({ title, value, children }: { title: string; value: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[86px] items-center justify-between gap-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-900">{title}</div>
        <div className="mt-1 truncate text-xs text-slate-500">{value}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
