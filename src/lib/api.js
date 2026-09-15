import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = import.meta.env.VITE_API_ORIGIN || '';

async function request(path, options = {}) {
  const res = await fetch(`${API}/api${path}`, {
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!res.ok) {
    let detail;
    try {
      detail = await res.json();
    } catch {
      detail = { error: res.statusText };
    }
    const err = new Error(detail.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),
};

// ---- React Query hooks ----

export function useMe() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => request('/auth/me'),
    retry: false,
  });
}

export function usePosts() {
  return useQuery({
    queryKey: ['posts'],
    queryFn: () => request('/posts'),
  });
}

export function usePost(slug) {
  return useQuery({
    queryKey: ['posts', slug],
    queryFn: () => request(`/posts/${slug}`),
    enabled: !!slug,
  });
}

export function useKits() {
  return useQuery({
    queryKey: ['kits'],
    queryFn: () => request('/kits'),
  });
}

export function useKit(slug) {
  return useQuery({
    queryKey: ['kits', slug],
    queryFn: () => request(`/kits/${slug}`),
    enabled: !!slug,
  });
}

export function useDemo(slug) {
  return useQuery({
    queryKey: ['demos', slug],
    queryFn: () => request(`/demos/${slug}`),
    enabled: !!slug,
  });
}

export function useApplications() {
  return useQuery({
    queryKey: ['applications'],
    queryFn: () => request('/applications'),
  });
}

export function useAdminPosts() {
  return useQuery({
    queryKey: ['admin', 'posts'],
    queryFn: () => request('/admin/posts'),
  });
}

export function useAdminKits() {
  return useQuery({
    queryKey: ['admin', 'kits'],
    queryFn: () => request('/admin/kits'),
  });
}

export function useAdminDemos() {
  return useQuery({
    queryKey: ['admin', 'demos'],
    queryFn: () => request('/admin/demos'),
  });
}

// ---- Mutations ----

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth'] }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => request('/auth/logout', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth'] }),
  });
}

function useAdminMutation(method) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body }) => request(`/admin${path}`, { method, body: body ? JSON.stringify(body) : undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] });
      qc.invalidateQueries({ queryKey: ['kits'] });
      qc.invalidateQueries({ queryKey: ['demos'] });
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

export const useCreatePost = () => useAdminMutation('POST').mutationFn
  ? null
  : null;

export function useAdminActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['posts'] });
    qc.invalidateQueries({ queryKey: ['kits'] });
    qc.invalidateQueries({ queryKey: ['demos'] });
    qc.invalidateQueries({ queryKey: ['admin'] });
  };
  return {
    createPost: useMutation({
      mutationFn: (body) => request('/admin/posts', { method: 'POST', body: JSON.stringify(body) }),
      onSuccess: invalidate,
    }),
    updatePost: useMutation({
      mutationFn: ({ slug, ...body }) =>
        request(`/admin/posts/${slug}`, { method: 'PUT', body: JSON.stringify(body) }),
      onSuccess: invalidate,
    }),
    deletePost: useMutation({
      mutationFn: (slug) => request(`/admin/posts/${slug}`, { method: 'DELETE' }),
      onSuccess: invalidate,
    }),
    createKit: useMutation({
      mutationFn: (body) => request('/admin/kits', { method: 'POST', body: JSON.stringify(body) }),
      onSuccess: invalidate,
    }),
    updateKit: useMutation({
      mutationFn: ({ slug, ...body }) =>
        request(`/admin/kits/${slug}`, { method: 'PUT', body: JSON.stringify(body) }),
      onSuccess: invalidate,
    }),
    deleteKit: useMutation({
      mutationFn: (slug) => request(`/admin/kits/${slug}`, { method: 'DELETE' }),
      onSuccess: invalidate,
    }),
    createDemo: useMutation({
      mutationFn: (body) => request('/admin/demos', { method: 'POST', body: JSON.stringify(body) }),
      onSuccess: invalidate,
    }),
    updateDemo: useMutation({
      mutationFn: ({ slug, ...body }) =>
        request(`/admin/demos/${slug}`, { method: 'PUT', body: JSON.stringify(body) }),
      onSuccess: invalidate,
    }),
    deleteDemo: useMutation({
      mutationFn: (slug) => request(`/admin/demos/${slug}`, { method: 'DELETE' }),
      onSuccess: invalidate,
    }),
  };
}

export function useSubmitApplication() {
  return useMutation({
    mutationFn: (body) => request('/applications', { method: 'POST', body: JSON.stringify(body) }),
  });
}

export function useStripeCheckout() {
  return useMutation({
    mutationFn: (kit_slug) =>
      request('/stripe/checkout', { method: 'POST', body: JSON.stringify({ kit_slug }) }),
  });
}
