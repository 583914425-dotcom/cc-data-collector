import { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Link } from 'react-router-dom';
import { ArrowLeft, UserCheck, UserX, Shield, Loader2, User, Trash2 } from 'lucide-react';

// Error handling helper
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface AppUser {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'pending';
  createdAt: number;
}

export default function UserManagement({ user }: { user: any }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: AppUser[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as AppUser);
      });
      setUsers(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setError(`获取用户列表失败: ${error.message}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'user' | 'pending') => {
    if (userId === user.uid && newRole !== 'admin') {
      setError("您不能取消自己的管理员权限！");
      return;
    }
    
    setError(null);
    setUpdatingId(userId);
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
    } catch (error: any) {
      setError(`更新角色失败，权限不足。`);
      try {
        handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
      } catch (err) {}
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === user.uid) {
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
      await deleteDoc(doc(db, 'users', userId));
    } catch (error: any) {
      setError(`删除用户失败，权限不足。`);
      try {
        handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
      } catch (err) {}
    } finally {
      setUpdatingId(null);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-red-200 text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">连接错误</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

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

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 border-b border-red-200 flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
                关闭
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">用户邮箱</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">注册时间</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">当前状态</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                          <User className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{u.email}</span>
                        {u.id === user.uid && (
                          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">您自己</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {u.createdAt ? String(u.createdAt) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          <Shield className="w-3.5 h-3.5" /> 管理员
                        </span>
                      ) : u.role === 'user' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <UserCheck className="w-3.5 h-3.5" /> 普通用户
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <UserX className="w-3.5 h-3.5" /> 待审核
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        {updatingId === u.id ? (
                          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                        ) : (
                          <>
                            {u.role !== 'admin' && (
                              <button
                                onClick={() => handleUpdateRole(u.id, 'admin')}
                                className="text-purple-600 hover:text-purple-900 hover:bg-purple-50 px-3 py-1.5 rounded-md transition-colors"
                              >
                                设为管理员
                              </button>
                            )}
                            {u.role !== 'user' && (
                              <button
                                onClick={() => handleUpdateRole(u.id, 'user')}
                                className="text-green-600 hover:text-green-900 hover:bg-green-50 px-3 py-1.5 rounded-md transition-colors"
                              >
                                批准为用户
                              </button>
                            )}
                            {u.role !== 'pending' && u.id !== user.uid && (
                              <button
                                onClick={() => handleUpdateRole(u.id, 'pending')}
                                className="text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50 px-3 py-1.5 rounded-md transition-colors"
                              >
                                撤销权限
                              </button>
                            )}
                            {u.id !== user.uid && (
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="text-red-600 hover:text-red-900 hover:bg-red-50 px-3 py-1.5 rounded-md transition-colors"
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
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      暂无用户数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">确认删除用户</h3>
            <p className="text-gray-600 mb-6">您确定要删除该用户吗？此操作不可逆，且该用户将无法再访问系统。</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
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
