export function isLoginUrl(url: string): boolean {
  return /(^|[/#?&])login([/?#&]|$)/i.test(url);
}

export function buildLoginStillPendingMessage(session: string | undefined, url: string): string {
  return `${session ?? "unknown"} 登录提交后仍停留在登录页：${url}。请检查账号密码、验证码、后端接口、网络请求或页面错误提示。`;
}
