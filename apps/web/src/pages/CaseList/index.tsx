import { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Input, Modal, Popconfirm, Radio, Space, Table, Tabs, Tag, Tooltip, Typography, Upload, message } from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  UndoOutlined
} from "@ant-design/icons";
import type { UploadFile } from "antd";
import { useNavigate } from "react-router-dom";
import { generateMaterialCaseDraft } from "../../api/ai";
import { deleteCase, importCaseYaml, listCases } from "../../api/cases";
import { createTestRun } from "../../api/testRuns";
import { EnvSelector } from "../../components/EnvSelector";
import { PageHeader } from "../../components/PageHeader";
import { useCaseStore } from "../../stores/useCaseStore";
import { useRunStore } from "../../stores/useRunStore";
import { useSettingStore } from "../../stores/useSettingStore";
import type { CaseItem, CreateCaseInput, CreateCaseTemplate } from "../../types/case";
import type { ScenarioMode, ScenarioStep } from "@ai-e2e/shared";

interface CreateCaseFormValues {
  caseId: string;
  caseName: string;
  description?: string;
  template: CreateCaseTemplate;
  requirement?: string;
  prdText?: string;
  docUrlsText?: string;
}

const templateOptions: Array<{ label: string; value: CreateCaseTemplate; description: string }> = [
  {
    label: "user 登录",
    value: "user_login",
    description: "创建用户端登录流程，包含打开登录页、提交登录、登录后可见性断言。"
  },
  {
    label: "admin 登录",
    value: "admin_login",
    description: "创建管理端登录流程，包含打开登录页、提交登录、登录后可见性断言。"
  },
  {
    label: "KYC 提交审核",
    value: "user_admin_kyc",
    description: "创建 user 提交 KYC、admin 登录并审核通过的端到端流程骨架。"
  }
];

interface TemplateDraft {
  mode: ScenarioMode;
  locationFile: string;
  sessions: string[];
  steps: ScenarioStep[];
}

const templateDrafts: Record<CreateCaseTemplate, TemplateDraft> = {
  user_login: {
    mode: "web",
    locationFile: "cases/location/login.user.yaml",
    sessions: [
      "  - name: user",
      "    login_url: \"${env.USER_LOGIN_URL}\"",
      "    username: \"${env.USER_USERNAME}\"",
      "    password: \"${env.USER_PASSWORD}\""
    ],
    steps: [
      {
        step_id: "user_open_login",
        name: "user 打开登录页",
        type: "web_open",
        session: "user",
        url: "${session.login_url}"
      },
      {
        step_id: "user_login",
        name: "user 登录",
        type: "flow_login",
        session: "user",
        username: "${session.username}",
        password: "${session.password}"
      },
      {
        step_id: "user_assert_home_visible",
        name: "user 登录后页面可见",
        type: "web_assert_visible",
        session: "user",
        target: "user_home_marker",
        continue_on_failure: true
      }
    ]
  },
  admin_login: {
    mode: "web",
    locationFile: "cases/location/login.admin.yaml",
    sessions: [
      "  - name: admin",
      "    login_url: \"${env.ADMIN_LOGIN_URL}\"",
      "    username: \"${env.ADMIN_USERNAME}\"",
      "    password: \"${env.ADMIN_PASSWORD}\""
    ],
    steps: [
      {
        step_id: "admin_open_login",
        name: "admin 打开登录页",
        type: "web_open",
        session: "admin",
        url: "${session.login_url}"
      },
      {
        step_id: "admin_login",
        name: "admin 登录",
        type: "flow_login",
        session: "admin",
        username: "${session.username}",
        password: "${session.password}"
      },
      {
        step_id: "admin_assert_home_visible",
        name: "admin 登录后页面可见",
        type: "web_assert_visible",
        session: "admin",
        target: "admin_home_marker",
        continue_on_failure: true
      }
    ]
  },
  user_admin_kyc: {
    mode: "hybrid",
    locationFile: "cases/location/kyc.submit-and-approve.yaml",
    sessions: [
      "  - name: user",
      "    login_url: \"${env.USER_LOGIN_URL}\"",
      "    username: \"${env.USER_USERNAME}\"",
      "    password: \"${env.USER_PASSWORD}\"",
      "  - name: admin",
      "    login_url: \"${env.ADMIN_LOGIN_URL}\"",
      "    username: \"${env.ADMIN_USERNAME}\"",
      "    password: \"${env.ADMIN_PASSWORD}\""
    ],
    steps: [
      {
        step_id: "user_open_login",
        name: "user 打开登录页",
        type: "web_open",
        session: "user",
        url: "${session.login_url}"
      },
      {
        step_id: "user_login",
        name: "user 登录",
        type: "flow_login",
        session: "user",
        username: "${session.username}",
        password: "${session.password}"
      },
      {
        step_id: "user_submit_kyc",
        name: "user 提交 KYC",
        type: "flow_submit_kyc",
        session: "user"
      },
      {
        step_id: "admin_open_login",
        name: "admin 打开登录页",
        type: "web_open",
        session: "admin",
        url: "${session.login_url}"
      },
      {
        step_id: "admin_login",
        name: "admin 登录",
        type: "flow_login",
        session: "admin",
        username: "${session.username}",
        password: "${session.password}"
      },
      {
        step_id: "admin_approve_kyc",
        name: "admin 审核通过 KYC",
        type: "flow_admin_approve_kyc",
        session: "admin"
      }
    ]
  }
};

const defaultDescriptions: Record<CreateCaseTemplate, string> = {
  user_login: "user 登录流程，用于验证用户端登录入口、账号密码提交和登录后页面可见性。",
  admin_login: "admin 登录流程，用于验证管理端登录入口、账号密码提交和登录后页面可见性。",
  user_admin_kyc: "user 提交 KYC 后由 admin 审核的端到端流程骨架。"
};

export default function CaseList() {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const { cases, setCases } = useCaseStore();
  const { env, setEnv } = useSettingStore();
  const { setRun } = useRunStore();
  const [form] = Form.useForm<CreateCaseFormValues>();
  const [loading, setLoading] = useState(false);
  const [runningCaseId, setRunningCaseId] = useState("");
  const [deletingCaseId, setDeletingCaseId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createMode, setCreateMode] = useState<"template" | "ai">("template");
  const [templateSteps, setTemplateSteps] = useState<ScenarioStep[]>(() => cloneTemplateSteps("user_login"));
  const [materialFiles, setMaterialFiles] = useState<UploadFile[]>([]);

  async function refresh() {
    setLoading(true);
    try {
      setCases(await listCases());
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function runCase(caseId: string) {
    setRunningCaseId(caseId);
    try {
      const created = await createTestRun({ caseId, env });
      setRun({ runId: created.runId, caseId, status: created.status });
      navigate(`/runs/${created.runId}`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setRunningCaseId("");
    }
  }

  async function removeCase(caseId: string) {
    setDeletingCaseId(caseId);
    try {
      await deleteCase(caseId);
      messageApi.success("用例已删除");
      await refresh();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setDeletingCaseId("");
    }
  }

  function openCreateModal() {
    form.resetFields();
    form.setFieldsValue({
      caseId: "",
      caseName: "",
      description: "",
      template: "user_login",
      requirement: "",
      prdText: "",
      docUrlsText: ""
    });
    setMaterialFiles([]);
    setCreateMode("template");
    setTemplateSteps(cloneTemplateSteps("user_login"));
    setCreateOpen(true);
  }

  async function handleCreateCase() {
    const values = await form.validateFields();
    setCreating(true);
    try {
      const payload: CreateCaseInput = {
        caseId: normalizeCaseId(values.caseId),
        caseName: values.caseName,
        description: values.description,
        template: values.template
      };
      const created = createMode === "ai"
        ? await createCaseByAi(values, payload.caseId)
        : await createCaseByTemplate(values, payload.caseId);
      messageApi.success(createMode === "ai" ? "AI 用例已生成" : "用例已创建");
      setCreateOpen(false);
      await refresh();
      navigate(`/cases/${created.caseId}`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setCreating(false);
    }
  }

  async function createCaseByAi(values: CreateCaseFormValues, caseId: string) {
    const files = await Promise.all(materialFiles.map(readUploadFileAsBase64));
    const docUrls = (values.docUrlsText ?? "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

    const result = await generateMaterialCaseDraft({
      caseId,
      caseName: values.caseName,
      description: values.description,
      templateHint: templateOptions.find((item) => item.value === values.template)?.label,
      requirement: values.requirement,
      prdText: values.prdText,
      docUrls,
      files
    });
    const saved = await importCaseYaml({ content: result.content, caseId });
    if (!saved.saved) {
      throw new Error(saved.validation?.issues?.map((item) => `${item.path}: ${item.message}`).join("; ") || "AI YAML 未通过校验");
    }
    return saved;
  }

  async function createCaseByTemplate(values: CreateCaseFormValues, caseId: string) {
    if (templateSteps.length === 0) {
      throw new Error("模板步骤不能为空，请恢复默认步骤或至少保留一个步骤");
    }
    const saved = await importCaseYaml({
      content: buildTemplateCaseYaml(values, caseId, templateSteps),
      caseId
    });
    if (!saved.saved) {
      throw new Error(saved.validation?.issues?.map((item) => `${item.path}: ${item.message}`).join("; ") || "模板 YAML 未通过校验");
    }
    return saved;
  }

  function resetTemplateSteps(template: CreateCaseTemplate = form.getFieldValue("template") ?? "user_login") {
    setTemplateSteps(cloneTemplateSteps(template));
  }

  function moveTemplateStep(index: number, offset: -1 | 1) {
    setTemplateSteps((current) => {
      const nextIndex = index + offset;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const source = next[index];
      const target = next[nextIndex];
      if (!source || !target) {
        return current;
      }
      next[index] = target;
      next[nextIndex] = source;
      return next;
    });
  }

  function removeTemplateStep(index: number) {
    setTemplateSteps((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function copyFilePath(file?: string) {
    if (!file) {
      return;
    }
    try {
      await navigator.clipboard.writeText(file);
      messageApi.success("文件路径已复制");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "复制失败");
    }
  }

  return (
    <div className="flex min-h-full flex-col gap-4">
      {contextHolder}
      <PageHeader
        title="用例管理"
        description="读取 cases/scenario 下的 YAML 用例，支持查看、编辑和执行。"
        extra={
          <>
            <EnvSelector value={env} onChange={setEnv} />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新增用例
            </Button>
            <Button
              icon={<ReloadOutlined className={loading ? "animate-spin" : undefined} />}
              disabled={loading}
              onClick={() => void refresh()}
            >
              刷新
            </Button>
          </>
        }
      />
      <Card className="[&_.ant-card-body]:p-4">
        <Table<CaseItem>
          rowKey="caseId"
          loading={loading}
          dataSource={cases}
          pagination={false}
          rowClassName={() => "align-top"}
          tableLayout="fixed"
          scroll={{ x: 1430 }}
          className="[&_.ant-table-cell]:align-top"
          columns={[
            {
              title: "caseId",
              dataIndex: "caseId",
              width: 190,
              render: (caseId: string) => <span className="font-mono text-sm text-slate-900 break-all">{caseId}</span>
            },
            {
              title: "名称",
              dataIndex: "caseName",
              width: 220,
              render: (caseName: string) => <span className="block leading-6 text-slate-900">{caseName}</span>
            },
            {
              title: "说明",
              dataIndex: "description",
              width: 320,
              render: (description: string) => (
                <span className="block whitespace-normal break-words leading-6 text-slate-700">{description || "-"}</span>
              )
            },
            { title: "模式", dataIndex: "mode", width: 80, render: (mode) => <Tag>{mode}</Tag> },
            {
              title: "状态",
              dataIndex: "valid",
              width: 90,
              render: (valid) => <Tag color={valid === false ? "error" : "success"}>{valid === false ? "需修复" : "可执行"}</Tag>
            },
            { title: "步骤数", dataIndex: "total", width: 80 },
            {
              title: "文件",
              dataIndex: "file",
              width: 230,
              render: (file: string) => (
                <button
                  type="button"
                  className="block max-w-full cursor-copy truncate rounded bg-slate-100 px-2 py-1 text-left font-mono text-xs leading-5 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
                  title={`点击复制：${file}`}
                  onClick={() => void copyFilePath(file)}
                >
                  {file}
                </button>
              )
            },
            {
              title: "操作",
              width: 240,
              fixed: "right",
              render: (_, record) => (
                <Space size={8} className="whitespace-nowrap">
                  <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/cases/${record.caseId}`)}>
                    编辑
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    disabled={record.valid === false}
                    loading={runningCaseId === record.caseId}
                    onClick={() => void runCase(record.caseId)}
                  >
                    执行
                  </Button>
                  <Popconfirm
                    title="删除用例"
                    description={`确定删除 ${record.caseId}.yaml？此操作不会删除历史报告。`}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true, loading: deletingCaseId === record.caseId }}
                    onConfirm={() => removeCase(record.caseId)}
                  >
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      disabled={runningCaseId === record.caseId}
                      loading={deletingCaseId === record.caseId}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
      </Card>
      <Modal
        title="新增用例"
        open={createOpen}
        width={860}
        okText={createMode === "ai" ? "AI 生成并编辑" : "创建并编辑"}
        cancelText="取消"
        confirmLoading={creating}
        destroyOnHidden
        forceRender
        maskClosable={!creating}
        styles={{ body: { maxHeight: "72vh", overflowY: "auto", paddingRight: 8 } }}
        onOk={() => void handleCreateCase()}
        onCancel={() => {
          if (!creating) setCreateOpen(false);
        }}
      >
        <Alert
          className="mb-4"
          type="info"
          showIcon
          message={createMode === "ai" ? "AI 会根据资料生成可编辑的 YAML 用例" : "新建后会生成一份可校验的 YAML 草稿"}
          description="账号、密码、token 和地址仍然引用 .env 变量，不会写死到用例文件里。创建后可以继续用编辑页的 AI 助手补充步骤。"
        />
        <Form<CreateCaseFormValues>
          form={form}
          layout="vertical"
          initialValues={{ template: "user_login" }}
          onValuesChange={(changed) => {
            if ("caseName" in changed && !form.getFieldValue("caseId")) {
              form.setFieldValue("caseId", normalizeCaseId(changed.caseName));
            }
            if ("template" in changed && changed.template) {
              resetTemplateSteps(changed.template);
            }
          }}
        >
          <Tabs
            activeKey={createMode}
            className="mb-2"
            items={[
              { key: "template", label: "模板创建" },
              { key: "ai", label: "AI 资料生成", icon: <RobotOutlined /> }
            ]}
            onChange={(key) => setCreateMode(key as "template" | "ai")}
          />
          <Form.Item
            label="case_id"
            name="caseId"
            normalize={normalizeCaseId}
            extra="将作为 YAML 中的 case_id 和文件名，例如 login_user_sit.yaml。"
            rules={[
              { required: true, message: "请输入 case_id" },
              {
                pattern: /^[a-z][a-z0-9_-]{2,63}$/,
                message: "只能使用小写字母、数字、下划线或中划线，且必须以小写字母开头，长度 3-64 位"
              },
              {
                validator: (_, value: string) => {
                  if (!value || !cases.some((item) => item.caseId === value)) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("case_id 已存在"));
                }
              }
            ]}
          >
            <Input placeholder="例如 login_user_sit" allowClear />
          </Form.Item>
          <Form.Item label="用例名称" name="caseName" rules={[{ required: true, message: "请输入用例名称" }]}>
            <Input placeholder="例如 user 登录流程 - SIT" allowClear />
          </Form.Item>
          <Form.Item label="说明" name="description">
            <Input.TextArea rows={3} placeholder="简要说明这个用例覆盖的业务流程、前置条件或断言目标" showCount maxLength={180} />
          </Form.Item>
          <Form.Item label="模板" name="template" rules={[{ required: true, message: "请选择模板" }]}>
            <Radio.Group className="w-full">
              <div className="flex w-full flex-col gap-4">
                {templateOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 bg-white px-4 py-4 transition hover:border-blue-300 hover:bg-blue-50/40 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50"
                  >
                    <Radio value={option.value} className="mt-0.5" />
                    <div className="grid min-w-0 gap-1">
                      <Typography.Text strong>{option.label}</Typography.Text>
                      <Typography.Text type="secondary" className="!text-xs">
                        {option.description}
                      </Typography.Text>
                    </div>
                  </label>
                ))}
              </div>
            </Radio.Group>
          </Form.Item>
          {createMode === "template" ? (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Typography.Text strong>继承步骤</Typography.Text>
                  <Typography.Text type="secondary" className="ml-2 !text-xs">
                    创建前可调整顺序或移除步骤，保存后生成独立 YAML。
                  </Typography.Text>
                </div>
                <Button size="small" icon={<UndoOutlined />} onClick={() => resetTemplateSteps()}>
                  恢复默认
                </Button>
              </div>
              <div className="grid gap-2">
                {templateSteps.map((step, index) => (
                  <div
                    key={`${step.step_id}-${index}`}
                    className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
                  >
                    <span className="font-mono text-xs text-slate-500">{index + 1}</span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900" title={step.name}>
                        {step.name}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="font-mono">{step.step_id}</span>
                        <Tag className="m-0" color="blue">
                          {step.type}
                        </Tag>
                        {step.session ? <span>session: {step.session}</span> : null}
                      </div>
                    </div>
                    <Space.Compact>
                      <Tooltip title="上移">
                        <Button
                          size="small"
                          icon={<ArrowUpOutlined />}
                          disabled={index === 0}
                          onClick={() => moveTemplateStep(index, -1)}
                        />
                      </Tooltip>
                      <Tooltip title="下移">
                        <Button
                          size="small"
                          icon={<ArrowDownOutlined />}
                          disabled={index === templateSteps.length - 1}
                          onClick={() => moveTemplateStep(index, 1)}
                        />
                      </Tooltip>
                      <Tooltip title="移除">
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeTemplateStep(index)} />
                      </Tooltip>
                    </Space.Compact>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {createMode === "ai" ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <Form.Item label="补充目标" name="requirement">
                <Input.TextArea rows={3} placeholder="例如：根据 PRD 生成开户申请、资料上传、后台审核通过的主流程，并补充关键断言。" />
              </Form.Item>
              <Form.Item label="粘贴 PRD / 需求说明" name="prdText">
                <Input.TextArea rows={6} placeholder="可以直接粘贴产品 PRD、验收标准、流程说明、接口约束或页面规则。" />
              </Form.Item>
              <Form.Item label="开源文档链接" name="docUrlsText" extra="每行一个公开 http/https 链接；为安全起见，不读取 localhost 或内网地址。">
                <Input.TextArea rows={3} placeholder={"https://example.com/docs/getting-started\nhttps://example.com/api"} />
              </Form.Item>
              <Form.Item label="导入资料" extra="支持 docx、PDF、Markdown、TXT、JSON、YAML，以及 PNG/JPG/WebP 图片；单文件最大 8MB。">
                <Upload.Dragger
                  multiple
                  fileList={materialFiles}
                  accept=".docx,.pdf,.md,.markdown,.txt,.json,.yaml,.yml,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  beforeUpload={() => false}
                  onChange={({ fileList }) => setMaterialFiles(fileList)}
                  onRemove={(file) => setMaterialFiles((current) => current.filter((item) => item.uid !== file.uid))}
                >
                  <p className="ant-upload-drag-icon">
                    <CloudUploadOutlined />
                  </p>
                  <p className="ant-upload-text">拖拽 PRD、PDF、docx 或图片到这里</p>
                  <p className="ant-upload-hint">AI 会读取文档文本，并直接理解页面截图、流程图、原型图中的信息。</p>
                </Upload.Dragger>
              </Form.Item>
            </div>
          ) : null}
        </Form>
      </Modal>
    </div>
  );
}

async function readUploadFileAsBase64(file: UploadFile): Promise<{ name: string; mimeType?: string; base64: string }> {
  const rawFile = file.originFileObj;
  if (!rawFile) {
    throw new Error(`${file.name} 文件读取失败`);
  }
  if (rawFile.size > 8 * 1024 * 1024) {
    throw new Error(`${file.name} 超过 8MB，请拆分或精简后再上传`);
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error(`${file.name} 文件读取失败`));
    reader.readAsDataURL(rawFile);
  });

  return {
    name: file.name,
    mimeType: rawFile.type,
    base64: dataUrl.split(",", 2)[1] ?? ""
  };
}

function normalizeCaseId(value?: string): string {
  return (value ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
}

function cloneTemplateSteps(template: CreateCaseTemplate): ScenarioStep[] {
  return templateDrafts[template].steps.map((step) => ({ ...step }));
}

function buildTemplateCaseYaml(values: CreateCaseFormValues, caseId: string, steps: ScenarioStep[]): string {
  const draft = templateDrafts[values.template];
  const description = values.description?.trim() || defaultDescriptions[values.template];
  return [
    `case_id: ${caseId}`,
    `case_name: ${quoteYaml(values.caseName)}`,
    `description: ${quoteYaml(description)}`,
    `mode: ${draft.mode}`,
    "sessions:",
    ...draft.sessions,
    "locations:",
    `  file: ${quoteYaml(draft.locationFile)}`,
    "steps:",
    ...steps.flatMap(renderStepYaml),
    ""
  ].join("\n");
}

function renderStepYaml(step: ScenarioStep): string[] {
  const lines = [
    `  - step_id: ${step.step_id}`,
    `    name: ${quoteYaml(step.name)}`,
    `    type: ${step.type}`
  ];
  const fieldOrder: Array<keyof ScenarioStep> = [
    "session",
    "target",
    "url",
    "value",
    "expected",
    "variable",
    "save_as",
    "sql",
    "params",
    "row_index",
    "timeout_ms",
    "wait_for_network",
    "continue_on_failure",
    "username",
    "password",
    "file"
  ];

  for (const field of fieldOrder) {
    const value = step[field];
    if (value === undefined) {
      continue;
    }
    lines.push(...renderYamlField(field, value));
  }

  return lines;
}

function renderYamlField(field: string, value: unknown): string[] {
  if (Array.isArray(value)) {
    if (!value.length) {
      return [`    ${field}: []`];
    }
    return [`    ${field}:`, ...value.map((item) => `      - ${renderYamlScalar(item)}`)];
  }
  if (value && typeof value === "object") {
    return [
      `    ${field}:`,
      ...Object.entries(value).map(([key, item]) => `      ${key}: ${renderYamlScalar(item)}`)
    ];
  }
  return [`    ${field}: ${renderYamlScalar(value)}`];
}

function renderYamlScalar(value: unknown): string {
  return typeof value === "string" ? quoteYaml(value) : String(value);
}

function quoteYaml(value: string): string {
  return JSON.stringify(value);
}
