import { useEffect, useState } from 'react';
import { pb } from '../lib/pb';
import { Link } from 'react-router-dom';
import { ArrowLeft, UserCheck, UserX, Shield, Loader2, Trash2 } from 'lucide-react';

interface AppUser {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'pending';
  name: string;
  created: string;
}

export default function UserManagement({ user }: { user: any }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const records = await pb.collection('users').getFullList({ sort: '-created' });
      const data: AppUser[] = records.map((r: any) => ({
        id: r.id,
        email: r.email,
        role: r.role || 'pending',
        name: r.name || '',
        created: r.created,
      }));
      setUsers(data);
      setLoading(false);
    } catch (err: any) {
      setError(`获取用户列表失败: ${err.message}`);
      setLoading(false);
    }
  };

  useEffect(() => {
    let unsubFn: (() => void) | null = null;

    fetchUsers();

    pb.collection('users').subscribe('*', () => {
      fetchUsers();
    }).then(fn => { unsubFn = fn; }).catch(() => {});

    return () => {
      if (unsubFn) unsubFn();
      else pb.collection('users').unsubscribe('*').catch(() => {});
    };
  }, []);

  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'user' | 'pending') => {
    if (userId === user.id && newRole !== 'admin') {
      setError("您不能取消自己的管理员权限！");
      return;
    }
    setError(null);
    setUpdatingId(userId);
    try {
      await pb.collection('users').update(userId, { role: newRole });
    } catch (err: any) {
      setError(`更新角色失败，权限不足。`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === user.id) {
      setError("您不能删除自己！");
      return;
    }
    setConfirmDeleteId(userId);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    const userId = confirmDeleteId;
    setConfirmDeleteId(null);
    setError(null);
    setUpdatingId(userId);
    try {
      await pb.collection('users').delete(userId);
    } catch (err: any) {
      setError(`删除用户失败，权限不足。`);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800"><Shield className="w-3 h-3" />管理员</span>;
      case 'user':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><UserCheck className="w-3 h-3" />已授权</span>;
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><UserX className="w-3 h-3" />待审核</span>;
      default:
        return <span className="text-gray-400 text-xs">{role}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">用户权限管理</h1>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex justify-between items-center">
            <span className="text-red-700 text-sm">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-sm">关闭</button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">注册时间</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{u.name || u.email.split('@')[0]}</div>
                      <div className="text-xs text-gray-400">{u.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      {getRoleBadge(u.role)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {u.created ? new Date(u.created).toLocaleDateString('zh-CN') : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {updatingId === u.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        ) : (
                          <>
                            {u.role !== 'admin' && (
                              <button
                                onClick={() => handleUpdateRole(u.id, 'admin')}
                                className="px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                              >
                                设为管理员
                              </button>
                            )}
                            {u.role !== 'user' && (
                              <button
                                onClick={() => handleUpdateRole(u.id, 'user')}
                                className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                              >
                                {u.role === 'pending' ? '批准' : '设为普通用户'}
                              </button>
                            )}
                            {u.role !== 'pending' && u.id !== user.id && (
                              <button
                                onClick={() => handleUpdateRole(u.id, 'pending')}
                                className="px-2.5 py-1 text-xs font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 rounded-lg transition-colors"
                              >
                                撤销权限
                              </button>
                            )}
                            {u.id !== user.id && (
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="删除用户"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirm delete dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">确认删除</h3>
            <p className="text-gray-600 mb-6 text-sm">此操作将永久删除该用户账号，无法恢复。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
