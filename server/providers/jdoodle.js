const axios = require('axios');
const { JDOODLE_LANGUAGES } = require('../validators');
const {
  createProviderError,
  getProviderErrorDetails,
  getSafeProviderMessage,
} = require('./providerErrors');

const JDOODLE_API_URL = 'https://api.jdoodle.com/v1/execute';

function getJdoodleCredentialStatus() {
  const clientId = process.env.JDOODLE_CLIENT_ID || '';
  const clientSecret = process.env.JDOODLE_CLIENT_SECRET || '';

  return {
    clientIdExists: Boolean(clientId),
    clientIdLength: clientId.length,
    clientSecretExists: Boolean(clientSecret),
    clientSecretLength: clientSecret.length,
  };
}

function logJdoodleCredentialStatus() {
  console.info('[jdoodle] credential status:', getJdoodleCredentialStatus());
}

async function executeCode({ code, language, httpClient = axios }) {
  const jdoodleLang = JDOODLE_LANGUAGES[language];
  if (!jdoodleLang) {
    return { statusCode: 400, body: { error: `Unsupported language: ${language}` } };
  }

  const clientId = process.env.JDOODLE_CLIENT_ID;
  const clientSecret = process.env.JDOODLE_CLIENT_SECRET;
  logJdoodleCredentialStatus();

  if (!clientId || !clientSecret) {
    return {
      statusCode: 500,
      body: createProviderError({
        message: 'JDoodle API is not configured.',
        provider: 'jdoodle',
        status: 500,
        details: 'Set JDOODLE_CLIENT_ID and JDOODLE_CLIENT_SECRET on the server.',
      }),
    };
  }

  try {
    const response = await httpClient.post(
      JDOODLE_API_URL,
      {
        clientId,
        clientSecret,
        script: code,
        language: jdoodleLang.language,
        versionIndex: jdoodleLang.versionIndex,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        validateStatus: () => true,
      }
    );

    if (response.status < 200 || response.status >= 300) {
      const message = getSafeProviderMessage(response.data, response.status === 401 ? 'Unauthorized' : 'JDoodle API error');
      console.warn('[jdoodle] non-2xx response:', { status: response.status, message });
      return {
        statusCode: response.status,
        body: createProviderError({
          message,
          provider: 'jdoodle',
          status: response.status,
        }),
      };
    }

    const result = response.data;
    const isError = result.statusCode !== 200;
    const isTimeLimit = result.statusCode === 139 || result.cpuTime > 15;
    const isMemoryLimit = result.memory && result.memory > 256000;

    let status;
    if (isTimeLimit) {
      status = { id: 5, description: 'Time Limit Exceeded (>15s)' };
    } else if (isMemoryLimit) {
      status = { id: 8, description: 'Memory Limit Exceeded' };
    } else if (isError) {
      status = { id: 11, description: 'Runtime Error' };
    } else {
      status = { id: 3, description: 'Accepted' };
    }

    return {
      statusCode: 200,
      body: {
        stdout: isError || isTimeLimit || isMemoryLimit ? null : (result.output || null),
        stderr: (isError && !isTimeLimit && !isMemoryLimit) ? (result.output || result.error || null) : null,
        compile_output: null,
        status,
        memory: result.memory,
        cpuTime: result.cpuTime,
        error: result.error || (isTimeLimit ? 'Execution time exceeded 15 seconds limit' : null),
      },
    };
  } catch (err) {
    const details = getProviderErrorDetails(err);
    console.error('Code execution error:', err.message);

    if (err.code === 'ECONNABORTED') {
      return {
        statusCode: 408,
        body: {
          error: 'Request Timeout',
          details: 'Code execution took too long (>30s). Try optimizing your code.',
          status: { id: 5, description: 'Time Limit Exceeded' },
        },
      };
    }

    if (err.response) {
      const status = err.response.status;
      const data = err.response.data;
      const message = getSafeProviderMessage(data, status === 401 ? 'Unauthorized' : 'JDoodle API error');
      return {
        statusCode: status,
        body: createProviderError({
          message,
          provider: 'jdoodle',
          status,
          details: typeof details === 'string' ? details : undefined,
        }),
      };
    }

    return {
      statusCode: 502,
      body: {
        error: 'Code execution provider unavailable',
        details,
        status: { id: 11, description: 'Execution Provider Error' },
      },
    };
  }
}

module.exports = {
  JDOODLE_API_URL,
  getJdoodleCredentialStatus,
  logJdoodleCredentialStatus,
  executeCode,
};
