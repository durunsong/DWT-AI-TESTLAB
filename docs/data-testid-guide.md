# data-testid 建议

建议业务系统为关键流程元素补充稳定标识：

```html
<input data-testid="user-login-username" />
<input data-testid="user-login-password" />
<button data-testid="user-login-submit">登录</button>

<input data-testid="admin-login-username" />
<input data-testid="admin-login-password" />
<button data-testid="admin-login-submit">登录</button>

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
