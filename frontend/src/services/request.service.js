import api from '../api/client';

const submitRequest = (data) => api.post('/v1/gpu-requests', data);
const getMyRequests = () => api.get('/v1/gpu-requests/my-requests');
const getPendingRequests = () => api.get('/v1/gpu-requests/pending');
const getAllRequests = () => api.get('/v1/gpu-requests/all');
const approveRequest = (id, gpuId) => api.patch(`/v1/gpu-requests/${id}/approve`, { gpuId });
const rejectRequest = (id) => api.patch(`/v1/gpu-requests/${id}/reject`);
const completeRequest = (id) => api.patch(`/v1/gpu-requests/${id}/complete`);

export default {
  submitRequest, getMyRequests, getPendingRequests,
  getAllRequests, approveRequest, rejectRequest, completeRequest,
};
