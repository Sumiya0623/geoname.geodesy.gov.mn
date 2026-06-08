// HTTP METHOD уудын өнгөнүүд.
// Бараг эндээс өөр газар ашиглагдахгүй байх өө.

export const METHOD_COLORS = {
  get: '#4CAF50',    // Green
  post: '#2196F3',   // Blue
  patch: '#FF9800',  // Orange
  delete: '#F44336', // Red
  put: '#9C27B0',    // Purple
};

export const METHOD_CONFIGS = {
  get: {
    label: 'GET',
    description: 'унших',
    icon: 'solar:download-bold-duotone',
    color: METHOD_COLORS.get,
    lightColor: '#4CAF5020',
    gradientColors: ['#4CAF5040', '#4CAF5020'],
  },
  post: {
    label: 'POST',
    description: 'илгээх',
    icon: 'solar:upload-bold-duotone',
    color: METHOD_COLORS.post,
    lightColor: '#2196F320',
    gradientColors: ['#2196F340', '#2196F320'],
  },
  patch: {
    label: 'PATCH',
    description: 'засах',
    icon: 'solar:pen-new-square-bold-duotone',
    color: METHOD_COLORS.patch,
    lightColor: '#FF980020',
    gradientColors: ['#FF980040', '#FF980020'],
  },
  delete: {
    label: 'DELETE',
    description: 'устгах',
    icon: 'solar:trash-bin-trash-bold-duotone',
    color: METHOD_COLORS.delete,
    lightColor: '#F4433620',
    gradientColors: ['#F4433640', '#F4433620'],
  },
  put: {
    label: 'PUT',
    description: 'солих',
    icon: 'solar:refresh-bold-duotone',
    color: METHOD_COLORS.put,
    lightColor: '#9C27B020',
    gradientColors: ['#9C27B040', '#9C27B020'],
  },
};

export const getMethodColor = (method) => {
  if (!method) return METHOD_COLORS.get;
  return METHOD_COLORS[method.toLowerCase()] || METHOD_COLORS.get;
};

export const getMethodConfig = (method) => {
  if (!method) return METHOD_CONFIGS.get;
  return METHOD_CONFIGS[method.toLowerCase()] || METHOD_CONFIGS.get;
};

export const getMethodGradientColors = (method) => {
  const config = getMethodConfig(method);
  return config.gradientColors;
};

export const getMethodLightColor = (method) => {
  const config = getMethodConfig(method);
  return config.lightColor;
};

export const getMethodLabelColor = (method) => {
  switch (method?.toUpperCase()) {
    case 'GET':
      return 'success';  // Green
    case 'POST':
      return 'info';     // Blue  
    case 'PATCH':
      return 'warning';  // Orange
    case 'DELETE':
      return 'error';    // Red
    case 'PUT':
      return 'secondary'; // Purple
    default:
      return 'default';
  }
};