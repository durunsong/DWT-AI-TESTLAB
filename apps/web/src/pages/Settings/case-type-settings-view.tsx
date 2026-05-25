import { DeleteOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { Button, Card, Input, InputNumber, Popconfirm, Space, Switch, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { memo, useEffect, useMemo, useState } from "react";
import { listCaseTypes, saveCaseTypes } from "../../api/settings";
import type { CaseTypeConfig } from "../../types/settings";
import { addEmptyCaseType, updateCaseTypeAt } from "./case-type-settings-utils";
import { caseTypeRowKey } from "./settings-row-key";

type CaseTypeRow = CaseTypeConfig & { originalIndex: number };

export const defaultCaseTypeConfig: CaseTypeConfig = {
  key: "uncategorized",
  label: "未分类",
  enabled: true,
  sort: 0,
  description: "默认类型，用于兼容未配置类型的历史用例。"
};

export const CaseTypeSettingsCard = memo(function CaseTypeSettingsCard() {
  const [messageApi, contextHolder] = message.useMessage();
  const [caseTypes, setCaseTypes] = useState<CaseTypeConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadCaseTypes = async () => {
    setLoading(true);
    try {
      setCaseTypes(await listCaseTypes());
    } catch (error) {
      setCaseTypes([defaultCaseTypeConfig]);
      messageApi.error(error instanceof Error ? error.message : "读取用例类型失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCaseTypes();
  }, []);

  const updateCaseType = (index: number, patch: Partial<CaseTypeConfig>) => {
    setCaseTypes((items) => updateCaseTypeAt(items, index, patch));
  };

  const addCaseType = () => {
    setCaseTypes(addEmptyCaseType);
  };

  const removeCaseType = (index: number) => {
    setCaseTypes((items) => items.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSaveCaseTypes = async () => {
    setSaving(true);
    try {
      const saved = await saveCaseTypes(caseTypes);
      setCaseTypes(saved);
      messageApi.success("用例类型已保存");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "保存用例类型失败");
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(() => caseTypes.map((item, originalIndex) => ({ ...item, originalIndex })), [caseTypes]);
  const columns = useMemo<ColumnsType<CaseTypeRow>>(
    () => [
      {
        title: "key",
        dataIndex: "key",
        width: 180,
        render: (value: string, record) => (
          <CaseTypeTextInput
            value={value}
            disabled={record.key === "uncategorized"}
            placeholder="例如 smoke"
            normalize={(next) => next.trim().toLowerCase()}
            onCommit={(next) => updateCaseType(record.originalIndex, { key: next })}
          />
        )
      },
      {
        title: "名称",
        dataIndex: "label",
        width: 180,
        render: (value: string, record) => (
          <CaseTypeTextInput
            value={value}
            placeholder="例如 冒烟"
            onCommit={(next) => updateCaseType(record.originalIndex, { label: next })}
          />
        )
      },
      {
        title: "说明",
        dataIndex: "description",
        render: (value: string | undefined, record) => (
          <CaseTypeTextInput
            value={value ?? ""}
            placeholder="可选"
            onCommit={(next) => updateCaseType(record.originalIndex, { description: next })}
          />
        )
      },
      {
        title: "排序",
        dataIndex: "sort",
        width: 120,
        render: (value: number, record) => (
          <InputNumber
            className="w-full"
            value={value}
            step={10}
            onChange={(next) => updateCaseType(record.originalIndex, { sort: Number(next ?? 0) })}
          />
        )
      },
      {
        title: "启用",
        dataIndex: "enabled",
        width: 90,
        render: (value: boolean, record) => (
          <Switch
            checked={value}
            disabled={record.key === "uncategorized"}
            onChange={(checked) => updateCaseType(record.originalIndex, { enabled: checked })}
          />
        )
      },
      {
        title: "操作",
        width: 90,
        render: (_value, record) =>
          record.key === "uncategorized" ? (
            <Tag color="default">内置</Tag>
          ) : (
            <Popconfirm title="删除这个用例类型？" okText="删除" cancelText="取消" onConfirm={() => removeCaseType(record.originalIndex)}>
              <Button danger type="text" icon={<DeleteOutlined />} />
            </Popconfirm>
          )
      }
    ],
    []
  );

  return (
    <Card
      title="用例类型"
      extra={
        <Space>
          <Button icon={<PlusOutlined />} onClick={addCaseType}>
            新增类型
          </Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadCaseTypes()}>
            重载
          </Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void handleSaveCaseTypes()}>
            保存类型
          </Button>
        </Space>
      }
    >
      {contextHolder}
      <Table size="middle" rowKey={caseTypeRowKey} loading={loading} pagination={false} columns={columns} dataSource={rows} />
    </Card>
  );
});

function CaseTypeTextInput(props: {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  normalize?: (value: string) => string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(props.value);

  useEffect(() => {
    setDraft(props.value);
  }, [props.value]);

  const commit = () => {
    const next = props.normalize ? props.normalize(draft) : draft;
    setDraft(next);
    if (next !== props.value) {
      props.onCommit(next);
    }
  };

  return (
    <Input
      value={draft}
      disabled={props.disabled}
      placeholder={props.placeholder}
      onBlur={commit}
      onPressEnter={commit}
      onChange={(event) => setDraft(event.target.value)}
    />
  );
}
