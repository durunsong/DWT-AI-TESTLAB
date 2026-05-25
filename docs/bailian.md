# 阿里云百炼接入指南

本文说明 `dwt-testing` 如何通过阿里云百炼的 OpenAI 兼容模式接入模型服务。

## 接入结论

项目的 AI 客户端只依赖 OpenAI 兼容的 Chat Completions 接口：

```text
{AI_BASE_URL}/chat/completions
```

因此百炼配置只需要关注四个环境变量：

```env
AI_PROVIDER=aliyun-bailian
AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_API_KEY=你的原始 API Key，不带 Bearer
AI_MODEL=qwen-plus
```

说明：

- `AI_BASE_URL` 填到 `/compatible-mode/v1`，不要再追加 `/chat/completions`。
- `AI_API_KEY` 建议填写原始 Key，不写 `Bearer`。
- 项目的 `OpenAiCompatibleClient` 会自动补 `Bearer` 前缀；如果误填了 `Bearer <API Key>`，也不会重复添加。
- `AI_MODEL` 使用百炼控制台中当前账号可调用的模型名，本文的 `qwen-plus` 只是示例。
- 截图分析需要模型支持图片输入；如果文本模型不支持图片，请切换到百炼控制台提供的视觉模型或多模态模型。
- 不要把真实 API Key 写入 `.env.example`、文档、源码、日志、截图或提交记录。

官方参考：

- 阿里云百炼 OpenAI 兼容模式文档：`https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope`
- 百炼 API Key 获取文档：`https://help.aliyun.com/zh/model-studio/get-api-key`

## 项目接口

当前项目中与 AI 相关的主要接口：

```text
POST /api/ai/chat
POST /api/ai/cases/draft
POST /api/ai/analyze-screenshot
```

其中 `/api/ai/analyze-screenshot` 会读取失败截图，将图片转换为 `data:image/png;base64,...`，再通过 OpenAI 兼容消息中的 `image_url` 发送给模型。

## .env 配置

在 `dwt-testing/.env` 或对应环境文件中配置：

```env
AI_PROVIDER=aliyun-bailian
AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_API_KEY=你的原始 API Key
AI_MODEL=qwen-plus
```

修改 `.env*` 后需要重启 `dwt-testing` server，否则 Node 进程仍会使用旧环境变量。

## 连通性检查

不要在日志、截图或群聊中暴露真实 Key。可以用无效 Key 检查网络、TLS 和网关是否可达：

```bash
curl -i "https://dashscope.aliyuncs.com/compatible-mode/v1/models" \
  -H "Authorization: Bearer invalid-key-for-connectivity-check"
```

判断：

- 返回 `401` 或 `InvalidApiKey`：网络、TLS、网关可达，继续检查真实 Key、权限和模型名。
- 返回 TLS/SSL/ECONNRESET/超时：优先检查网络、代理、VPN、证书或网关策略。

## API 调用示例

普通对话：

```bash
curl -X POST "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AI_API_KEY" \
  -d '{
    "model": "qwen-plus",
    "messages": [
      { "role": "user", "content": "请用一句话介绍你自己" }
    ],
    "stream": false
  }'
```

图片理解消息格式：

```json
{
  "model": "请替换为支持图片输入的模型名",
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

Q：`.env` 中要不要写 `Bearer`？

A：不建议写。直接填写原始 API Key 即可，项目会在请求时自动生成 `Authorization: Bearer <API Key>`。

Q：AI 请求报 `InvalidApiKey`？

A：网络已经通了，优先检查 `.env*` 中的 `AI_API_KEY`、Key 所属账号/业务空间、百炼服务权限，以及修改配置后是否已重启 server。

Q：AI 请求报模型不存在或无权限？

A：检查 `AI_MODEL` 是否是当前百炼账号、地域和业务空间可调用的模型名。模型名称不要照抄旧文档，以控制台实际可用名称为准。

Q：截图分析报模型不支持图片？

A：当前 `AI_MODEL` 可能是纯文本模型。请切换为支持图片输入的视觉或多模态模型，并重新执行失败分析。

Q：配置改了还是请求旧模型或旧地址？

A：确认修改的是 `dwt-testing/.env` 或当前运行环境对应的 `.env*` 文件，并重启 server。前端页面通常不需要改，后端进程启动时读取环境变量。

