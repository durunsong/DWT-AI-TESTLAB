import { type ReactNode, useEffect, useState } from "react";
import { Alert, Button, Card, Col, Drawer, Form, Input, Row, Segmented, Space, Spin, Tag, Typography, message } from "antd";
import { ArrowLeftOutlined, CheckCircleOutlined, CopyOutlined, PlayCircleOutlined, RobotOutlined, SafetyCertificateOutlined, SaveOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { assistCaseYamlStream, type CaseYamlAssistMode } from "../../api/ai";
import { getCase, preflightCaseContent, saveCase, validateCase } from "../../api/cases";
import { createTestRun } from "../../api/testRuns";
import { PageHeader } from "../../components/PageHeader";
import { YamlEditor } from "../../components/YamlEditor";
import { useCaseStore } from "../../stores/useCaseStore";
import { useSettingStore } from "../../stores/useSettingStore";
import type { CasePreflightResult, CaseValidationResult } from "../../types/case";

const aiModeOptions: Array<{ label: string; value: CaseYamlAssistMode }> = [
  { label: "AI 写", value: "write" },
  { label: "续写", value: "continue" },
  { label: "优化", value: "optimize" },
  { label: "修复", value: "fix" }
];

const aiModeTips: Record<CaseYamlAssistMode, string> = {
  write: "按你的业务说明生成完整 YAML，适合从草稿重建。",
  continue: "保留当前 YAML，在 steps 后面补充新流程。",
  optimize: "整理命名、等待、断言和步骤顺序，不改变业务含义。",
  fix: "结合当前 DSL 校验问题修复 YAML。"
};

interface CaseMetaFormValues {
  caseId: string;
  caseName: string;
  description?: string;
}

export default function CaseEditor() {
  const { caseId = "" } = useParams();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const { activeCase, yaml, validation, setActiveCase, setYaml, setValidation } = useCaseStore();
  const { env } = useSettingStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [preflighting, setPreflighting] = useState(false);
  const [preflight, setPreflight] = useState<CasePreflightResult>();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<CaseYamlAssistMode>("continue");
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiDraft, setAiDraft] = useState("");
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiValidation, setAiValidation] = useState<CaseValidationResult>();
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    if (!caseId) return;
    setLoading(true);
    getCase(caseId)
      .then((detail) => {
        setActiveCase(detail);
        setValidation(detail.validation);
      })
      .catch((error) => messageApi.error(error instanceof Error ? error.message : String(error)))
      .finally(() => setLoading(false));
  }, [caseId, messageApi, setActiveCase, setValidation]);

  async function handleValidate() {
    try {
      const result = await validateCase(yaml);
      setValidation(result);
      if (result.valid) {
        messageApi.success("DSL 校验通过");
      } else {
        messageApi.warning("DSL 仍有校验问题");
      }
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await saveCase(caseId, yaml);
      setValidation(result.validation);
      if (result.saved) {
        messageApi.success("保存成功");
        if (result.caseId && result.caseId !== caseId) {
          navigate(`/cases/${result.caseId}`, { replace: true });
        }
      } else {
        messageApi.error("保存失败，请先修复校验问题");
      }
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  async function handlePreflight(): Promise<CasePreflightResult | undefined> {
    setPreflighting(true);
    try {
      const result = await preflightCaseContent(yaml, env);
      setPreflight(result);
      if (result.runnable) {
        messageApi.success("运行前预检通过");
      } else {
        messageApi.warning(`运行前预检发现 ${result.summary.errors} 个错误`);
      }
      return result;
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
      return undefined;
    } finally {
      setPreflighting(false);
    }
  }

  function handleMetaChange(_: Partial<CaseMetaFormValues>, values: CaseMetaFormValues) {
    setYaml(updateYamlMeta(yaml, {
      caseId: normalizeCaseId(values.caseId),
      caseName: values.caseName,
      description: values.description
    }));
  }

  async function handleRun() {
    setRunning(true);
    try {
      const validationResult = await validateCase(yaml);
      setValidation(validationResult);
      if (!validationResult.valid) {
        messageApi.error("DSL 校验失败，请先修复后再执行");
        return;
      }

      const preflightResult = await handlePreflight();
      if (!preflightResult?.runnable) {
        messageApi.error("运行前预检未通过，请先修复错误后再执行");
        return;
      }

      const result = await createTestRun({ caseId, env });
      navigate(`/runs/${result.runId}`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setRunning(false);
    }
  }

  function openAiAssistant(mode: CaseYamlAssistMode = aiMode) {
    setAiMode(mode);
    setAiOpen(true);
    setAiError("");
    if (!aiDraft) {
      setAiDraft("");
      setAiValidation(undefined);
    }
  }

  async function handleAiGenerate() {
    setAiStreaming(true);
    setAiDraft("");
    setAiValidation(undefined);
    setAiError("");

    let nextDraft = "";
    let streamError: Error | undefined;
    try {
      await assistCaseYamlStream(
        {
          mode: aiMode,
          caseId,
          currentYaml: yaml,
          instruction: aiInstruction,
          validationIssues: validation?.issues
        },
        {
          onChunk: (chunk) => {
            nextDraft += chunk;
            setAiDraft(nextDraft);
          },
          onError: (error) => {
            streamError = error;
          }
        }
      );
      if (streamError) throw streamError;

      const normalized = normalizeAiYaml(nextDraft);
      setAiDraft(normalized);
      const result = await validateCase(normalized);
      setAiValidation(result);
      if (result.valid) {
        messageApi.success("AI YAML 已生成并通过校验");
      } else {
        messageApi.warning("AI YAML 已生成，但仍有校验问题，请确认后再应用");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAiError(message);
      messageApi.error(message);
    } finally {
      setAiStreaming(false);
    }
  }

  async function handleApplyAiDraft() {
    const normalized = normalizeAiYaml(aiDraft);
    if (!normalized) return;
    const result = aiValidation ?? await validateCase(normalized);
    if (!result.valid) {
      setAiValidation(result);
      messageApi.warning("AI YAML 仍未通过校验，请修复后再应用");
      return;
    }
    setYaml(normalized);
    setValidation(result);
    setAiOpen(false);
    messageApi.success("AI YAML 已应用到编辑器，请确认后保存");
  }

  async function copyAiDraft() {
    if (!aiDraft) return;
    await navigator.clipboard.writeText(normalizeAiYaml(aiDraft));
    messageApi.success("AI YAML 已复制");
  }

  if (loading) {
    return (
      <div className="flex min-h-full flex-col gap-2.5">
        {contextHolder}
        <PageHeader title="用例编辑" description={caseId} />
        <Card className="min-h-[420px]">
          <div className="flex min-h-[360px] items-center justify-center">
            <Spin description="读取用例中">
              <div className="h-12 w-36" />
            </Spin>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-2.5">
      {contextHolder}
      <PageHeader
        title={activeCase?.caseName ?? caseId}
        description={activeCase?.file}
        extra={
          <>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/cases")}>
              返回
            </Button>
            <Button icon={<CheckCircleOutlined />} onClick={() => void handleValidate()}>
              校验
            </Button>
            <Button icon={<SafetyCertificateOutlined />} loading={preflighting} onClick={() => void handlePreflight()}>
              预检
            </Button>
            <Button icon={<RobotOutlined />} onClick={() => openAiAssistant()}>
              AI 助手
            </Button>
            <Button icon={<SaveOutlined />} loading={saving} onClick={() => void handleSave()}>
              保存
            </Button>
            <Button type="primary" icon={<PlayCircleOutlined />} loading={running} onClick={() => void handleRun()}>
              执行
            </Button>
          </>
        }
      />
      <Row gutter={[10, 10]}>
        <Col xs={24} xl={16}>
          <Card title="基础信息" size="small" className="mb-3 [&_.ant-card-body]:py-3">
            <Form<CaseMetaFormValues>
              key={activeCase?.caseId}
              layout="vertical"
              className="[&_.ant-form-item]:mb-0"
              initialValues={{
                caseId: activeCase?.caseId,
                caseName: activeCase?.caseName,
                description: activeCase?.description ?? ""
              }}
              onValuesChange={handleMetaChange}
            >
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item
                    label="caseId"
                    name="caseId"
                    normalize={normalizeCaseId}
                    rules={[
                      { required: true, message: "请输入 caseId" },
                      {
                        pattern: /^[a-z][a-z0-9_-]{2,63}$/,
                        message: "只能使用小写字母、数字、下划线或中划线，且必须以小写字母开头，长度 3-64 位"
                      }
                    ]}
                  >
                    <Input size="small" placeholder="例如 admin_profile_update" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="名称" name="caseName" rules={[{ required: true, message: "请输入名称" }]}>
                    <Input size="small" placeholder="例如 admin 修改资料" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="说明" name="description">
                    <Input size="small" placeholder="简要说明用例覆盖的流程或断言目标" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
          <Card
            className="overflow-hidden [&_.ant-card-body]:bg-[#1e1e1e] [&_.ant-card-body]:p-0"
            style={{ backgroundColor: "#1e1e1e", borderColor: "#1e1e1e" }}
          >
            <YamlEditor value={yaml} onChange={setYaml} />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="AI YAML 助手" className="mb-2.5">
            <div className="flex flex-col gap-2.5">
              <Typography.Text type="secondary">选择生成方式，AI 会先给出可校验草稿，确认后再应用到编辑器。</Typography.Text>
              <Segmented<CaseYamlAssistMode> block value={aiMode} options={aiModeOptions} onChange={setAiMode} />
              <Input.TextArea
                rows={4}
                value={aiInstruction}
                placeholder="例如：续写 admin 审核 KYC，并在 user 端断言状态变为已通过"
                onChange={(event) => setAiInstruction(event.target.value)}
              />
              <Button block type="primary" icon={<RobotOutlined />} className="mt-0.5" onClick={() => openAiAssistant(aiMode)}>
                打开 AI 助手
              </Button>
            </div>
          </Card>
          <Card
            title="DSL 校验结果"
            extra={validation ? <Tag color={validation.valid ? "success" : "error"}>{validation.valid ? "通过" : "失败"}</Tag> : null}
          >
            {!validation ? (
              <Alert type="info" showIcon title="尚未校验" description="保存会自动校验，也可以先手动校验 YAML DSL。" />
            ) : validation.valid ? (
              <Alert type="success" showIcon title="校验通过" description={`${validation.caseId ?? "-"} · ${validation.caseName ?? "-"}`} />
            ) : (
              <IssueStack>
                {validation.issues.map((item) => (
                  <IssueItem key={`${item.path}-${item.message}`} title={item.path} description={item.message} />
                ))}
              </IssueStack>
            )}
          </Card>
          <Card
            title="运行前预检"
            className="mt-2.5"
            extra={preflight ? <Tag color={preflight.runnable ? "success" : "error"}>{preflight.runnable ? "可执行" : "需修复"}</Tag> : null}
          >
            {!preflight ? (
              <Alert type="info" showIcon title="尚未预检" description="预检会检查环境变量、定位文件、API baseUrl、DB 开关和上传文件等运行前风险。" />
            ) : preflight.runnable ? (
              <Alert
                type="success"
                showIcon
                title="预检通过"
                description={`${preflight.summary.steps} 步 · Web ${preflight.summary.webSteps} · API ${preflight.summary.apiSteps} · DB ${preflight.summary.dbSteps}`}
              />
            ) : (
              <IssueStack>
                {preflight.issues.map((item) => (
                  <IssueItem
                    key={`${item.path}-${item.code}-${item.message}`}
                    title={
                      <Space>
                        <Tag color={item.severity === "error" ? "error" : "warning"}>{item.severity}</Tag>
                        <span>{item.path}</span>
                      </Space>
                    }
                    description={`${item.code} · ${item.message}`}
                  />
                ))}
              </IssueStack>
            )}
          </Card>
        </Col>
      </Row>
      <Drawer
        title="AI YAML 助手"
        size="min(920px, 92vw)"
        open={aiOpen}
        destroyOnHidden={false}
        extra={
          <Space wrap>
            <Button icon={<CopyOutlined />} disabled={!aiDraft} onClick={() => void copyAiDraft()}>
              复制
            </Button>
            <Button disabled={!aiDraft || aiStreaming} onClick={() => void handleApplyAiDraft()}>
              应用到编辑器
            </Button>
            <Button type="primary" icon={<RobotOutlined />} loading={aiStreaming} onClick={() => void handleAiGenerate()}>
              {aiDraft ? "重新生成" : "生成"}
            </Button>
          </Space>
        }
        onClose={() => setAiOpen(false)}
      >
        <div className="grid h-full min-h-0 grid-cols-1 gap-2.5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-2.5">
            <Card size="small" title="生成模式">
              <Space orientation="vertical" size={12} className="w-full">
                <Segmented<CaseYamlAssistMode> block value={aiMode} options={aiModeOptions} onChange={setAiMode} />
                <Alert type="info" showIcon title={aiModeTips[aiMode]} />
              </Space>
            </Card>
            <Card size="small" title="补充要求">
              <Input.TextArea
                rows={8}
                value={aiInstruction}
                placeholder="描述你要 AI 写什么、续写什么，或需要修复的问题。"
                onChange={(event) => setAiInstruction(event.target.value)}
              />
            </Card>
            {aiValidation ? (
              <Alert
                type={aiValidation.valid ? "success" : "warning"}
                showIcon
                title={aiValidation.valid ? "草稿校验通过" : "草稿仍需调整"}
                description={aiValidation.valid ? `${aiValidation.caseId ?? "-"} · ${aiValidation.caseName ?? "-"}` : `${aiValidation.issues.length} 个问题`}
              />
            ) : null}
            {aiError ? <Alert type="error" showIcon title="AI 生成失败" description={aiError} /> : null}
          </div>
          <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
            <div className="flex min-h-[44px] items-center justify-between border-b border-slate-800 px-3 text-slate-200">
              <span>AI YAML 预览</span>
              <Tag color={aiStreaming ? "processing" : aiValidation?.valid ? "success" : aiDraft ? "warning" : "default"}>
                {aiStreaming ? "生成中" : aiValidation?.valid ? "可应用" : aiDraft ? "待确认" : "未生成"}
              </Tag>
            </div>
            <pre className="m-0 min-h-[520px] flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-6 text-slate-200">
              {aiDraft || "选择模式并点击生成后，AI 会在这里流式输出 YAML 草稿。"}
            </pre>
          </div>
        </div>
      </Drawer>
    </div>
  );
}

function IssueStack({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-slate-100">{children}</div>;
}

function IssueItem({ title, description }: { title: ReactNode; description: ReactNode }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="mb-1 text-sm text-slate-900">{title}</div>
      <div className="text-sm text-slate-500">{description}</div>
    </div>
  );
}

function normalizeAiYaml(content: string): string {
  return content
    .replace(/^\s*```(?:yaml|yml)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim()
    .concat("\n");
}

function updateYamlMeta(content: string, meta: { caseId: string; caseName: string; description?: string }): string {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const nextLines = upsertYamlScalar(lines, "case_id", meta.caseId);
  const withName = upsertYamlScalar(nextLines, "case_name", meta.caseName);
  return upsertYamlScalar(withName, "description", meta.description?.trim() ?? "").join("\n");
}

function upsertYamlScalar(lines: string[], key: "case_id" | "case_name" | "description", value: string): string[] {
  const next = [...lines];
  const lineIndex = next.findIndex((line) => line.startsWith(`${key}:`));
  if (!value && key === "description") {
    if (lineIndex >= 0) {
      next.splice(lineIndex, 1);
    }
    return next;
  }

  const line = `${key}: ${quoteYamlScalar(value)}`;
  if (lineIndex >= 0) {
    next[lineIndex] = line;
    return next;
  }

  const insertIndex = key === "case_id" ? 0 : key === "case_name" ? afterKey(next, "case_id") : afterKey(next, "case_name");
  next.splice(insertIndex, 0, line);
  return next;
}

function afterKey(lines: string[], key: string): number {
  const index = lines.findIndex((line) => line.startsWith(`${key}:`));
  return index >= 0 ? index + 1 : 0;
}

function quoteYamlScalar(value: string): string {
  return JSON.stringify(value);
}

function normalizeCaseId(value?: string): string {
  return (value ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
}
