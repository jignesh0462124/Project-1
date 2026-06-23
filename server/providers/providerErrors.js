function getProviderErrorDetails(err) {
  if (!err) return 'Unknown provider error';
  if (err.response?.data?.error?.message) return err.response.data.error.message;
  if (err.response?.data?.message) return err.response.data.message;
  if (typeof err.response?.data === 'string') return err.response.data.slice(0, 500);
  if (err.message) return err.message;
  return 'Unknown provider error';
}

function getSafeProviderMessage(data, fallback) {
  if (typeof data?.error === 'string') return data.error;
  if (typeof data?.message === 'string') return data.message;
  if (typeof data?.error?.message === 'string') return data.error.message;
  return fallback;
}

function createProviderError({ message, provider, status, details }) {
  return {
    success: false,
    error: {
      message,
      provider,
      status,
      ...(details ? { details } : {}),
    },
  };
}

module.exports = {
  getProviderErrorDetails,
  getSafeProviderMessage,
  createProviderError,
};
