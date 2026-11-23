/**
 * 认证 hook 统一出口。
 *
 * 返回：
 * - user: 当前登录用户，未登录为 null
 * - isLoading: 是否正在拉取用户信息
 * - isError: 拉取用户信息是否出错
 * - login(payload): 登录，成功后返回用户信息
 * - logout(): 登出，成功后跳转到登录页
 * - hasRole(role): 检查当前用户是否拥有指定角色
 * - refetch(): 手动刷新用户信息
 */
export { useAuth } from '@client/src/contexts/AuthContext';
