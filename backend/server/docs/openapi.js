'use strict';

const baseResponse = {
  description: 'Successful response.',
};

const errorResponse = {
  description: 'Error response.',
  content: {
    'application/json': {
      schema: {
        $ref: '#/components/schemas/ErrorResponse',
      },
    },
  },
};

const userRef = {
  type: 'object',
  properties: {
    id: { type: 'string', example: '64f1f3b2b9a5e1c123456789' },
    username: { type: 'string', example: 'student' },
    role: { type: 'string', example: 'STUDENT' },
  },
};

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'GPU Resource Management System API',
    version: '1.0.0',
    description: 'Interactive API documentation for GPU request management, administration, health checks, and analytics.',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API base path',
    },
  ],
  tags: [
    { name: 'Authentication' },
    { name: 'GPU Resources' },
    { name: 'GPU Requests' },
    { name: 'Admin' },
    { name: 'Analytics' },
    { name: 'Health' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'fail' },
          message: { type: 'string', example: 'You are not logged in. Please log in to get access.' },
        },
      },
      AuthRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', example: 'student' },
          password: { type: 'string', example: 'Student@1234' },
        },
      },
      SignupRequest: {
        allOf: [
          { $ref: '#/components/schemas/AuthRequest' },
        ],
      },
      AuthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        },
      },
      RefreshResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        },
      },
      LogoutResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          message: { type: 'string', example: 'Logged out successfully.' },
        },
      },
      User: userRef,
      GpuResource: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '64f1f3b2b9a5e1c123456789' },
          name: { type: 'string', example: 'NVIDIA GeForce RTX 4090' },
          model: { type: 'string', example: 'RTX 4090' },
          vram: { type: 'number', example: 24 },
          cudaCores: { type: 'number', example: 16384 },
          condition: { type: 'string', example: 'New' },
          availableVRAM: { type: 'number', example: 16 },
          status: { type: 'string', example: 'Available' },
        },
      },
      GpuResourceCreateRequest: {
        type: 'object',
        required: ['name', 'model', 'vram'],
        properties: {
          name: { type: 'string', example: 'NVIDIA GeForce RTX 4090' },
          model: { type: 'string', example: 'RTX 4090' },
          vram: { type: 'number', example: 24 },
          cudaCores: { type: 'number', example: 16384 },
          condition: { type: 'string', example: 'New' },
          status: { type: 'string', example: 'Available' },
        },
      },
      GpuResourceUpdateRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'NVIDIA GeForce RTX 4090' },
          model: { type: 'string', example: 'RTX 4090' },
          vram: { type: 'number', example: 24 },
          cudaCores: { type: 'number', example: 16384 },
          condition: { type: 'string', example: 'Used' },
          status: { type: 'string', example: 'Maintenance' },
        },
      },
      GpuRequest: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '64f1f3b2b9a5e1c123456789' },
          userId: { $ref: '#/components/schemas/User' },
          gpuResourceId: { $ref: '#/components/schemas/GpuResource' },
          facultyId: { $ref: '#/components/schemas/User' },
          requiredVRAM: { type: 'number', example: 8 },
          purpose: { type: 'string', example: 'Run model training job' },
          startDate: { type: 'string', format: 'date-time', example: '2030-01-10T00:00:00.000Z' },
          endDate: { type: 'string', format: 'date-time', example: '2030-01-11T00:00:00.000Z' },
          status: { type: 'string', example: 'PENDING' },
        },
      },
      GpuRequestCreateRequest: {
        type: 'object',
        required: ['purpose', 'startDate', 'endDate'],
        properties: {
          gpuResourceId: { type: 'string', nullable: true, example: '64f1f3b2b9a5e1c123456789' },
          requiredVRAM: { type: 'number', example: 8 },
          purpose: { type: 'string', example: 'Run model training job' },
          startDate: { type: 'string', format: 'date-time', example: '2030-01-10T00:00:00.000Z' },
          endDate: { type: 'string', format: 'date-time', example: '2030-01-11T00:00:00.000Z' },
        },
      },
      GpuRequestApprovalRequest: {
        type: 'object',
        required: ['gpuId'],
        properties: {
          gpuId: { type: 'string', example: '64f1f3b2b9a5e1c123456789' },
        },
      },
      AdminCreateUserRequest: {
        type: 'object',
        required: ['username', 'password', 'role'],
        properties: {
          username: { type: 'string', example: 'admin' },
          password: { type: 'string', example: 'Admin@1234' },
          role: { type: 'string', enum: ['STUDENT', 'FACULTY', 'ADMIN'], example: 'ADMIN' },
        },
      },
      AdminUserResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          data: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: '64f1f3b2b9a5e1c123456789' },
                  username: { type: 'string', example: 'admin' },
                  role: { type: 'string', example: 'ADMIN' },
                },
              },
            },
          },
        },
      },
      AuditLog: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '64f1f3b2b9a5e1c123456789' },
          actorId: { $ref: '#/components/schemas/User' },
          action: { type: 'string', example: 'REQUEST_APPROVED' },
          details: { type: 'object', additionalProperties: true },
          level: { type: 'string', example: 'INFO' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      HealthLiveResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
        },
      },
      HealthReadyResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          mongodb: { type: 'string', example: 'connected' },
        },
      },
      HealthStatusResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          mongodb: { type: 'string', example: 'connected' },
          uptime: { type: 'number', example: 1234 },
          environment: { type: 'string', example: 'development' },
        },
      },
      AdminSummary: {
        type: 'object',
        properties: {
          totalGpus: { type: 'number', example: 10 },
          availableGpus: { type: 'number', example: 7 },
          allocatedGpus: { type: 'number', example: 3 },
          totalUsers: { type: 'number', example: 42 },
          totalRequests: { type: 'number', example: 18 },
          pendingRequests: { type: 'number', example: 4 },
          approvedRequests: { type: 'number', example: 10 },
        },
      },
      UsageAnalyticsResponse: {
        type: 'object',
        properties: {
          gpuUtilization: {
            type: 'object',
            properties: {
              total: { type: 'number', example: 10 },
              allocated: { type: 'number', example: 3 },
              available: { type: 'number', example: 7 },
              utilizationRate: { type: 'string', example: '30.00%' },
            },
          },
          requestDistribution: {
            type: 'object',
            properties: {
              total: { type: 'number', example: 18 },
              pending: { type: 'number', example: 4 },
              approved: { type: 'number', example: 10 },
              rejected: { type: 'number', example: 4 },
            },
          },
        },
      },
      PaginatedGpuResourcesResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          results: { type: 'number', example: 10 },
          meta: {
            type: 'object',
            properties: {
              page: { type: 'number', example: 1 },
              limit: { type: 'number', example: 20 },
              total: { type: 'number', example: 42 },
              pages: { type: 'number', example: 3 },
            },
          },
          data: {
            type: 'object',
            properties: {
              gpus: {
                type: 'array',
                items: { $ref: '#/components/schemas/GpuResource' },
              },
            },
          },
        },
      },
      PaginatedGpuRequestsResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          results: { type: 'number', example: 10 },
          meta: {
            type: 'object',
            properties: {
              page: { type: 'number', example: 1 },
              limit: { type: 'number', example: 20 },
              total: { type: 'number', example: 18 },
              pages: { type: 'number', example: 1 },
            },
          },
          data: {
            type: 'object',
            properties: {
              requests: {
                type: 'array',
                items: { $ref: '#/components/schemas/GpuRequest' },
              },
            },
          },
        },
      },
    },
  },
  security: [
    { bearerAuth: [] },
  ],
  paths: {
    '/auth/signup': {
      post: {
        tags: ['Authentication'],
        summary: 'Create a student account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SignupRequest' },
            },
          },
        },
        responses: {
          201: {
            ...baseResponse,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminUserResponse' } } },
          },
          400: errorResponse,
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Authenticate a user and issue an access token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthRequest' },
            },
          },
        },
        responses: {
          200: {
            ...baseResponse,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
          },
          400: errorResponse,
          401: errorResponse,
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Refresh the access token using the refresh cookie',
        responses: {
          200: {
            ...baseResponse,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshResponse' } } },
          },
          401: errorResponse,
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Log out the current user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            ...baseResponse,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LogoutResponse' } } },
          },
          401: errorResponse,
        },
      },
    },
    '/gpu-resources/available': {
      get: {
        tags: ['GPU Resources'],
        summary: 'List available GPU resources',
        responses: {
          200: {
            ...baseResponse,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    results: { type: 'number', example: 2 },
                    data: {
                      type: 'object',
                      properties: {
                        gpus: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/GpuResource' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: errorResponse,
        },
      },
    },
    '/gpu-resources': {
      get: {
        tags: ['GPU Resources'],
        summary: 'List GPU resources with pagination',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            ...baseResponse,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedGpuResourcesResponse' } } },
          },
          401: errorResponse,
          403: errorResponse,
        },
      },
      post: {
        tags: ['GPU Resources'],
        summary: 'Create a GPU resource',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GpuResourceCreateRequest' },
            },
          },
        },
        responses: {
          201: {
            ...baseResponse,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: {
                      type: 'object',
                      properties: {
                        gpu: { $ref: '#/components/schemas/GpuResource' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
        },
      },
    },
    '/gpu-resources/{id}': {
      patch: {
        tags: ['GPU Resources'],
        summary: 'Update a GPU resource',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GpuResourceUpdateRequest' },
            },
          },
        },
        responses: {
          200: {
            ...baseResponse,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: {
                      type: 'object',
                      properties: {
                        gpu: { $ref: '#/components/schemas/GpuResource' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
        },
      },
      delete: {
        tags: ['GPU Resources'],
        summary: 'Delete a GPU resource',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          204: { description: 'Resource deleted successfully.' },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
        },
      },
    },
    '/gpu-requests': {
      post: {
        tags: ['GPU Requests'],
        summary: 'Create a GPU request',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GpuRequestCreateRequest' },
            },
          },
        },
        responses: {
          201: {
            ...baseResponse,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: {
                      type: 'object',
                      properties: {
                        request: { $ref: '#/components/schemas/GpuRequest' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
        },
      },
    },
    '/gpu-requests/my-requests': {
      get: {
        tags: ['GPU Requests'],
        summary: 'List the authenticated user’s requests',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            ...baseResponse,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedGpuRequestsResponse' } } },
          },
          401: errorResponse,
        },
      },
    },
    '/gpu-requests/pending': {
      get: {
        tags: ['GPU Requests'],
        summary: 'List pending requests for faculty review',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            ...baseResponse,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedGpuRequestsResponse' } } },
          },
          401: errorResponse,
          403: errorResponse,
        },
      },
    },
    '/gpu-requests/all': {
      get: {
        tags: ['GPU Requests'],
        summary: 'List all GPU requests',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            ...baseResponse,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedGpuRequestsResponse' } } },
          },
          401: errorResponse,
          403: errorResponse,
        },
      },
    },
    '/gpu-requests/{id}/approve': {
      patch: {
        tags: ['GPU Requests'],
        summary: 'Approve a GPU request',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GpuRequestApprovalRequest' },
            },
          },
        },
        responses: {
          200: {
            ...baseResponse,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: { type: 'object' },
                  },
                },
              },
            },
          },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
          409: errorResponse,
        },
      },
    },
    '/gpu-requests/{id}/reject': {
      patch: {
        tags: ['GPU Requests'],
        summary: 'Reject a GPU request',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            ...baseResponse,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: { type: 'object' },
                  },
                },
              },
            },
          },
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
        },
      },
    },
    '/gpu-requests/{id}/complete': {
      patch: {
        tags: ['GPU Requests'],
        summary: 'Mark an approved GPU request as completed',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            ...baseResponse,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: { type: 'object' },
                  },
                },
              },
            },
          },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
        },
      },
    },
    '/admin/summary': {
      get: {
        tags: ['Admin'],
        summary: 'Get dashboard summary metrics',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            ...baseResponse,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: { $ref: '#/components/schemas/AdminSummary' },
                  },
                },
              },
            },
          },
          401: errorResponse,
          403: errorResponse,
        },
      },
    },
    '/admin/audit-logs': {
      get: {
        tags: ['Admin'],
        summary: 'List audit log entries',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            ...baseResponse,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    results: { type: 'number', example: 10 },
                    meta: {
                      type: 'object',
                      properties: {
                        page: { type: 'number', example: 1 },
                        limit: { type: 'number', example: 50 },
                        total: { type: 'number', example: 200 },
                        pages: { type: 'number', example: 4 },
                      },
                    },
                    data: {
                      type: 'object',
                      properties: {
                        logs: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/AuditLog' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: errorResponse,
          403: errorResponse,
        },
      },
    },
    '/admin/users': {
      post: {
        tags: ['Admin'],
        summary: 'Create a student, faculty, or admin user',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AdminCreateUserRequest' },
            },
          },
        },
        responses: {
          201: {
            ...baseResponse,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
          },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
        },
      },
    },
    '/analytics/usage': {
      get: {
        tags: ['Analytics'],
        summary: 'Get GPU utilization and request distribution analytics',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            ...baseResponse,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UsageAnalyticsResponse' } } },
          },
          401: errorResponse,
          403: errorResponse,
        },
      },
    },
    '/live': {
      get: {
        tags: ['Health'],
        summary: 'Liveness probe',
        responses: {
          200: {
            ...baseResponse,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthLiveResponse' } } },
          },
        },
      },
    },
    '/ready': {
      get: {
        tags: ['Health'],
        summary: 'Readiness probe',
        responses: {
          200: {
            ...baseResponse,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthReadyResponse' } } },
          },
          503: {
            description: 'MongoDB is disconnected.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthReadyResponse' } } },
          },
        },
      },
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'General health snapshot',
        responses: {
          200: {
            ...baseResponse,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthStatusResponse' } } },
          },
        },
      },
    },
  },
};
