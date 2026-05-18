# 阿里百炼模型使用指南

## dwt-testing 接入结论

当前 AI 自动化测试平台改用阿里百炼 OpenAI 兼容模式。项目通过以下环境变量接入：

```env
AI_PROVIDER=aliyun-bailian
AI_BASE_URL=https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
AI_API_KEY=你的原始 API Key，不带 Bearer
AI_MODEL=qwen3.6-flash
```

说明：

- `AI_BASE_URL` 填到 `/compatible-mode/v1`，项目会自动拼接 `/chat/completions`。
- `AI_API_KEY` 建议只填写原始 Key，不写 `Bearer`。
- 当前项目的 `OpenAiCompatibleClient` 会自动给 `AI_API_KEY` 补 `Bearer` 前缀；如果误填了 `Bearer <API Key>`，也不会重复添加。
- `AI_MODEL` 必须填写百炼兼容接口可用的模型名。当前使用 `qwen3.6-flash`；如果截图分析提示模型不支持图片，再切换到百炼控制台提供的视觉模型部署名。
- 不要把真实 API Key 写入 `.env.example`、文档、源码或提交记录。

当前项目已提供接口：

```text
POST /api/ai/chat
POST /api/ai/cases/draft
POST /api/ai/analyze-screenshot
```

`/api/ai/analyze-screenshot` 会读取失败截图，转换为 `data:image/png;base64,...`，再通过 OpenAI 兼容的 `image_url` 消息发送给百炼模型。

## .env 配置

在 `dwt-testing/.env` 中配置：

```env
AI_PROVIDER=aliyun-bailian
AI_BASE_URL=https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
AI_API_KEY=你的原始 API Key
AI_MODEL=qwen3.6-flash
```

修改 `.env` 后需要重启 `dwt-testing` server，否则 Node 进程仍会使用旧环境变量。

## curl 连通性检查

不要在日志、截图或群聊中暴露真实 Key。可以用无效 Key 检查网络是否通：

```bash
curl -i "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/models" \
  -H "Authorization: Bearer invalid-key-for-connectivity-check"
```

判断：

- 返回 `401 InvalidApiKey`：网络、TLS、网关可达，继续检查真实 Key 和模型名。
- 返回 TLS/SSL/ECONNRESET/超时：网络、代理、VPN、证书或网关不可达。

## API 调用示例

普通对话：

```bash
curl -X POST "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AI_API_KEY" \
  -d '{
    "model": "qwen3.6-flash",
    "messages": [
      { "role": "user", "content": "你好，请介绍一下你自己" }
    ],
    "stream": false
  }'
```

图片理解：

```json
{
  "model": "qwen3.6-flash",
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "请分析这张失败截图" },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,<base64>"
          }
        }
      ]
    }
  ],
  "stream": false
}
```

## 常见问题

Q：配置到 OpenClaw 不用写 Bearer，代码请求要不要写？

A：直接 HTTP 请求的 `Authorization` 头必须是 `Bearer <API Key>`。但本项目 `.env` 只建议写原始 Key，代码会自动补 `Bearer`。

Q：AI 截图分析报 `InvalidApiKey`？

A：网络已经通了，检查 `.env` 中 `AI_API_KEY` 是否正确、是否重启 server、Key 是否属于当前百炼服务。

Q：AI 截图分析报模型不支持图片？

A：`qwen3.6-flash` 如果在当前百炼服务中不支持图片输入，需要把 `AI_MODEL` 换成支持视觉输入的模型或控制台提供的视觉模型部署名。

Q：配置改了还是请求 Gemma？

A：确认 `dwt-testing/.env` 已修改并重启 server；前端页面不需要改，后端进程启动时读取环境变量。
