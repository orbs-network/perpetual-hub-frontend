import apiClient from './client';
import type { LoginRequest, LoginResponse } from '../types';

export async function login(request: LoginRequest, signal?: AbortSignal): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/api/v1/auth/login', request, { signal });

  return response.data;
}
