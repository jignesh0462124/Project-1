const axios = require('axios');
const { getProviderErrorDetails } = require('./providerErrors');

function createEmptyAnalysis(reason = 'Analysis could not be parsed into structured JSON.') {
  return {
    fixes: reason ? [{ severity: 'info', title: 'Analysis unavailable', description: reason }] : [],
    quality: {
      score: 0,
      grade: 'F',
      items: reason ? [{ category: 'Analyzer', comment: reason }] : [],
    },
    complexity: {
      time: 'O(?)',
      space: 'O(?)',
      explanation: reason || 'No complexity explanation is available.',
    },
  };
}

function normalizeSeverity(value) {
  return ['critical', 'warning', 'info'].includes(value) ? value : 'info';
}

function normalizeGrade(value) {
  return ['A', 'B', 'C', 'D', 'F'].includes(value) ? value : 'F';
}

function normalizeAnalysisShape(value, fallbackReason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return createEmptyAnalysis(fallbackReason);

  const fixes = Array.isArray(value.fixes)
    ? value.fixes.slice(0, 5).map(item => ({
      severity: normalizeSeverity(item?.severity),
      title: String(item?.title || 'Review note').slice(0, 120),
      description: String(item?.description || 'No description provided.').slice(0, 600),
    }))
    : [];

  const rawQuality = value.quality && typeof value.quality === 'object' ? value.quality : {};
  const score = Number(rawQuality.score);
  const quality = {
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0,
    grade: normalizeGrade(String(rawQuality.grade || '').toUpperCase()),
    items: Array.isArray(rawQuality.items)
      ? rawQuality.items.slice(0, 4).map(item => ({
        category: String(item?.category || 'General').slice(0, 80),
        comment: String(item?.comment || 'No comment provided.').slice(0, 400),
      }))
      : [],
  };

  const rawComplexity = value.complexity && typeof value.complexity === 'object' ? value.complexity : {};
  const complexity = {
    time: String(rawComplexity.time || 'O(?)').slice(0, 40),
    space: String(rawComplexity.space || 'O(?)').slice(0, 40),
    explanation: String(rawComplexity.explanation || 'No complexity explanation is available.').slice(0, 900),
  };

  return { fixes, quality, complexity };
}

function parseAnalysisResponse(rawResponse) {
  if (rawResponse && typeof rawResponse === 'object') return normalizeAnalysisShape(rawResponse);
  if (typeof rawResponse !== 'string') return createEmptyAnalysis();

  const trimmed = rawResponse.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return normalizeAnalysisShape(JSON.parse(trimmed));
  } catch {
    return createEmptyAnalysis('The AI response was not valid JSON, so a safe placeholder was returned.');
  }
}

function buildAnalysisPrompts(code, language, compilerOutput) {
  const systemPrompt = `You are an AI programming assistant embedded inside a real-time collaborative coding platform called Collaborative Platform.
Analyze the provided code and compiler output carefully.

Respond exclusively with valid JSON. Do not include a preamble, markdown fences, comments, or explanation outside the JSON object.

Return exactly one JSON object with exactly these top-level keys: fixes, quality, complexity.

Schema:
{
  "fixes": [
    {
      "severity": "critical | warning | info",
      "title": "short one-line issue title",
      "description": "one to two sentences explaining what is wrong and exactly what to change"
    }
  ],
  "quality": {
    "score": 0,
    "grade": "A | B | C | D | F",
    "items": [
      {
        "category": "Naming | Structure | Readability | Best Practices | Performance | Testing",
        "comment": "one sentence of feedback"
      }
    ]
  },
  "complexity": {
    "time": "O(n)",
    "space": "O(1)",
    "explanation": "two to three sentences explaining the complexity and bottleneck"
  }
}

Rules:
- fixes must contain no more than five items.
- quality.items must contain no more than four items.
- If no fixes are needed, return an empty fixes array.
- Use only severity values "critical", "warning", or "info".
- Use only grade values "A", "B", "C", "D", or "F".
- Complexity time and space must be Big-O strings.`;

  const userPrompt = `Language: ${language}

User Code:
\`\`\`${language}
${code}
\`\`\`

Compiler Output:
${compilerOutput || 'No compiler output available (code not yet executed).'}`;

  return { systemPrompt, userPrompt };
}

function getOpenRouterModels() {
  const primaryModel = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash';
  const fallbackModels = (process.env.OPENROUTER_FALLBACK_MODELS || '')
    .split(',')
    .map(model => model.trim())
    .filter(Boolean);

  return [...new Set([primaryModel, ...fallbackModels])];
}

async function requestOpenRouterAnalysis({ code, language, compilerOutput, model, httpClient = axios }) {
  const { systemPrompt, userPrompt } = buildAnalysisPrompts(code, language, compilerOutput);

  const response = await httpClient.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost:5173',
        'X-OpenRouter-Title': process.env.OPENROUTER_APP_TITLE || 'Collaborative Platform',
      },
      timeout: 30000,
    }
  );

  return response.data?.choices?.[0]?.message?.content || '{}';
}

function createLocalAnalysis({ code, language, compilerOutput, reason }) {
  const fixes = [];
  const qualityItems = [];
  const trimmedCode = code.trim();

  if (!trimmedCode) {
    fixes.push({ severity: 'warning', title: 'Empty file', description: 'The file is empty, so there is nothing to analyze yet. Add code before running the analyzer again.' });
  }

  if (compilerOutput && /error|exception|traceback|failed|undefined|cannot|syntax/i.test(compilerOutput)) {
    fixes.push({ severity: 'critical', title: 'Compiler output contains an error', description: 'The latest compiler output appears to contain an error. Start with the first reported line number and fix that error before tuning style or performance.' });
  }

  if (/\beval\s*\(/.test(code)) {
    fixes.push({ severity: 'warning', title: 'Avoid eval', description: 'The code uses eval, which can execute unsafe input and makes debugging harder. Replace it with explicit parsing or direct function calls.' });
  }

  if (language === 'javascript' || language === 'typescript') {
    if (/\bvar\s+/.test(code)) {
      qualityItems.push({ category: 'Best Practices', comment: 'Use const or let instead of var so variable scope is easier to reason about.' });
    }
    if (/[^=!]==[^=]|!=[^=]/.test(code)) {
      fixes.push({ severity: 'info', title: 'Prefer strict equality', description: 'Loose equality can cause implicit type coercion bugs. Prefer === and !== unless coercion is intentional and documented.' });
    }
  }

  if (/console\.log\s*\(/.test(code)) {
    qualityItems.push({ category: 'Readability', comment: 'Remove temporary console.log calls or keep them behind a debug flag before sharing final code.' });
  }

  if (code.split('\n').some(line => line.length > 120)) {
    qualityItems.push({ category: 'Structure', comment: 'Wrap long lines so the code is easier to read during collaborative editing.' });
  }

  if (!fixes.length) {
    fixes.push({ severity: 'info', title: 'No obvious blocking issue', description: 'The local fallback analyzer did not find a clear syntax or runtime issue. Run the hosted AI analyzer again when the provider is available for a deeper review.' });
  }

  qualityItems.unshift({ category: 'Analyzer', comment: reason ? `Local fallback used: ${reason}` : 'Local fallback analysis completed.' });

  return normalizeAnalysisShape({
    fixes,
    quality: {
      score: Math.max(40, Math.min(90, 85 - fixes.filter(item => item.severity === 'critical').length * 25 - fixes.filter(item => item.severity === 'warning').length * 10)),
      grade: fixes.some(item => item.severity === 'critical') ? 'C' : fixes.some(item => item.severity === 'warning') ? 'B' : 'A',
      items: qualityItems,
    },
    complexity: {
      time: 'O(?)',
      space: 'O(?)',
      explanation: 'The local fallback analyzer does not infer precise algorithmic complexity. Review loops, recursion, and nested data-structure operations to identify the real bottleneck.',
    },
  });
}

function shouldUseLocalAnalysisFallback() {
  return process.env.ANALYSIS_FALLBACK_ON_ERROR !== 'false';
}

async function analyzeCode({ code, language, compilerOutput, httpClient = axios }) {
  if (!process.env.OPENROUTER_API_KEY) {
    if (shouldUseLocalAnalysisFallback()) {
      return {
        statusCode: 200,
        body: createLocalAnalysis({
          code,
          language,
          compilerOutput,
          reason: 'OpenRouter API key is not configured.',
        }),
      };
    }

    return {
      statusCode: 500,
      body: {
        error: 'OpenRouter API is not configured. Add OPENROUTER_API_KEY to server/.env or enable ANALYSIS_FALLBACK_ON_ERROR.',
      },
    };
  }

  const providerErrors = [];

  for (const model of getOpenRouterModels()) {
    try {
      const analysisText = await requestOpenRouterAnalysis({ code, language, compilerOutput, model, httpClient });
      return { statusCode: 200, body: parseAnalysisResponse(analysisText) };
    } catch (err) {
      const status = err.response?.status;
      const details = err.response?.data?.error?.message || err.response?.data || getProviderErrorDetails(err);
      providerErrors.push({ model, status, details });

      if (![402, 408, 429, 500, 502, 503, 504].includes(status)) {
        throw err;
      }
    }
  }

  if (shouldUseLocalAnalysisFallback()) {
    const exhaustedModels = providerErrors
      .map(item => `${item.model}${item.status ? ` (${item.status})` : ''}`)
      .join(', ');

    return {
      statusCode: 200,
      body: createLocalAnalysis({
        code,
        language,
        compilerOutput,
        reason: `OpenRouter model quota/rate limit was reached or unavailable for: ${exhaustedModels}.`,
      }),
    };
  }

  return {
    statusCode: 429,
    body: {
      error: 'OpenRouter rate limit reached',
      details: 'All configured OpenRouter models are rate-limited, out of quota, or unavailable.',
      providerErrors,
    },
  };
}

function handleOpenRouterError(err, req) {
  console.error('AI analysis error:', err.message);
  if (err.response) {
    const status = err.response.status;
    const details = err.response.data?.error?.message || err.response.data || getProviderErrorDetails(err);

    if (shouldUseLocalAnalysisFallback()) {
      return {
        statusCode: 200,
        body: createLocalAnalysis({
          code: req.body.code,
          language: req.body.language,
          compilerOutput: req.normalizedCompilerOutput,
          reason: `OpenRouter returned ${status || 'an error'}: ${typeof details === 'string' ? details : JSON.stringify(details)}`,
        }),
      };
    }

    if (status === 429) {
      return {
        statusCode: 429,
        body: {
          error: 'OpenRouter rate limit reached',
          details: 'The selected OpenRouter model is currently rate-limited or out of quota. Try again later, add credits, or switch OPENROUTER_MODEL to another available model.',
        },
      };
    }

    if (status === 401 || status === 403) {
      return {
        statusCode: status,
        body: {
          error: 'OpenRouter authentication failed',
          details: 'Check OPENROUTER_API_KEY in server/.env and restart the server.',
        },
      };
    }

    return { statusCode: err.response.status, body: { error: 'OpenRouter API error', details } };
  }

  if (shouldUseLocalAnalysisFallback()) {
    return {
      statusCode: 200,
      body: createLocalAnalysis({
        code: req.body.code,
        language: req.body.language,
        compilerOutput: req.normalizedCompilerOutput,
        reason: `OpenRouter request failed: ${getProviderErrorDetails(err)}`,
      }),
    };
  }

  return { statusCode: 500, body: { error: 'AI analysis failed', details: err.message } };
}

module.exports = {
  buildAnalysisPrompts,
  getOpenRouterModels,
  requestOpenRouterAnalysis,
  createEmptyAnalysis,
  createLocalAnalysis,
  parseAnalysisResponse,
  shouldUseLocalAnalysisFallback,
  analyzeCode,
  handleOpenRouterError,
};