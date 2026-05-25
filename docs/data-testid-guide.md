# data-testid 建议

页面定位优先级为 `data-testid -> role -> label -> placeholder -> text -> name -> css -> xpath`。业务系统应优先为关键元素补充稳定的 `data-testid`，避免依赖易变的 CSS 层级或文案。

## 命名建议

- 使用小写短横线：`user-login-submit`。
- 包含业务端、页面/模块、元素含义：`admin-kyc-approve-button`。
- 不包含动态数据、数据库 ID、手机号、账号等敏感信息。
- 对同类列表项可增加业务稳定字段，例如 `order-row-${orderNo}`，但不要使用随机 DOM index。

## 登录示例

```html
<input data-testid="user-login-username" />
<input data-testid="user-login-password" />
<button data-testid="user-login-submit">登录</button>

<input data-testid="admin-login-username" />
<input data-testid="admin-login-password" />
<button data-testid="admin-login-submit">登录</button>
```

## KYC 示例

```html
<button data-testid="user-kyc-menu">企业认证</button>
<input data-testid="kyc-enterprise-name" />
<input data-testid="kyc-license-no" />
<input data-testid="kyc-legal-person" />
<input data-testid="kyc-license-upload" type="file" />
<button data-testid="kyc-submit">提交审核</button>
<span data-testid="kyc-status">审核中</span>
<span data-testid="kyc-order-no"></span>

<button data-testid="admin-kyc-menu">企业认证审核</button>
<input data-testid="admin-kyc-search-input" />
<button data-testid="admin-kyc-search-submit">搜索</button>
<button data-testid="admin-kyc-review-button">审核</button>
<textarea data-testid="admin-kyc-review-remark"></textarea>
<button data-testid="admin-kyc-approve-button">审核通过</button>
<button data-testid="admin-kyc-confirm">确认</button>
<span data-testid="admin-kyc-status">审核通过</span>
```

## 落地约定

- 新增关键流程前，优先补齐 `data-testid`，再维护 `cases/location/*.yaml`。
- 弹窗、抽屉、二次确认按钮也需要独立标识。
- 上传控件要标识真正的 `<input type="file">` 或可被 Playwright 定位到的上传入口。
- 表格操作按钮建议给行容器和按钮分别加标识，便于先定位行再点击操作。
