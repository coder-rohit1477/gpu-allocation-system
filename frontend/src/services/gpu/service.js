import api from '../../api/client';

const getAllGpus = () => api.get('/v1/gpu-resources');
const getAvailableGpus = () => api.get('/v1/gpu-resources/available');
const createGpu = (data) => api.post('/v1/gpu-resources', data);
const updateGpu = (id, data) => api.patch(`/v1/gpu-resources/${id}`, data);
const deleteGpu = (id) => api.delete(`/v1/gpu-resources/${id}`);
const getAnalytics = () => api.get('/v1/admin/summary');

export default { getAllGpus, getAvailableGpus, createGpu, updateGpu, deleteGpu, getAnalytics };
