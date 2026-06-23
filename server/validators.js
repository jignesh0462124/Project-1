const JDOODLE_LANGUAGES = {
  javascript: { language: 'nodejs', versionIndex: '4' },
  typescript: { language: 'typescript', versionIndex: '0' },
  python: { language: 'python3', versionIndex: '4' },
  java: { language: 'java', versionIndex: '4' },
  cpp: { language: 'cpp17', versionIndex: '1' },
  go: { language: 'go', versionIndex: '4' },
  rust: { language: 'rust', versionIndex: '4' },
};

const SUPPORTED_ROOM_LANGUAGES = new Set([...Object.keys(JDOODLE_LANGUAGES), 'html']);
const MAX_CODE_LENGTH = 50000;
const MAX_CHAT_MESSAGE_LENGTH = 200;
const MAX_USERNAME_LENGTH = 20;
const MAX_COMPILER_OUTPUT_LENGTH = 2000;
const DANGEROUS_CODE_PATTERNS = [
  /while\s*\(\s*true\s*\)/i,
  /for\s*\(\s*;\s*;\s*\)/i,
  /\bThread\.sleep\s*\(\s*\d{5,}\s*\)/,
  /\bsleep\s*\(\s*\d{2,}\s*\)/i,
  /\bsetInterval\s*\([^,]+,\s*0\s*\)/i
];

function normalizeRoomId(roomId) {
  const normalized = String(roomId || '').trim().toUpperCase();
  return /^[A-Z0-9]{8}$/.test(normalized) ? normalized : null;
}

function normalizeUsername(username) {
  const normalized = String(username || '').trim();
  if (!normalized || normalized.length > MAX_USERNAME_LENGTH) return null;
  return normalized;
}

function normalizeLanguage(language) {
  const normalized = String(language || 'javascript').trim().toLowerCase();
  return SUPPORTED_ROOM_LANGUAGES.has(normalized) ? normalized : 'javascript';
}

function isValidCodePayload(code) {
  return typeof code === 'string' && code.length <= MAX_CODE_LENGTH;
}

function isSafeExecutableCode(code) {
  return typeof code === 'string' && !DANGEROUS_CODE_PATTERNS.some((pattern) => pattern.test(code));
}

function normalizeCompilerOutput(compilerOutput) {
  return typeof compilerOutput === 'string'
    ? compilerOutput.slice(0, MAX_COMPILER_OUTPUT_LENGTH)
    : null;
}

function normalizeChatMessage(message) {
  const normalized = String(message || '').trim();
  if (!normalized || normalized.length > MAX_CHAT_MESSAGE_LENGTH) return null;
  return normalized;
}

function isValidCursorPosition(position) {
  return Number.isInteger(position?.lineNumber)
    && Number.isInteger(position?.column)
    && position.lineNumber > 0
    && position.column > 0
    && position.lineNumber < 1000000
    && position.column < 100000;
}

function isValidSelectionRange(selection) {
  if (!selection) return true;

  return Number.isInteger(selection.startLineNumber)
    && Number.isInteger(selection.startColumn)
    && Number.isInteger(selection.endLineNumber)
    && Number.isInteger(selection.endColumn)
    && selection.startLineNumber > 0
    && selection.startColumn > 0
    && selection.endLineNumber > 0
    && selection.endColumn > 0
    && selection.startLineNumber < 1000000
    && selection.endLineNumber < 1000000
    && selection.startColumn < 100000
    && selection.endColumn < 100000;
}

function normalizeSelection(selection) {
  if (!selection || !isValidSelectionRange(selection)) return null;

  return {
    startLineNumber: selection.startLineNumber,
    startColumn: selection.startColumn,
    endLineNumber: selection.endLineNumber,
    endColumn: selection.endColumn,
  };
}

module.exports = {
  JDOODLE_LANGUAGES,
  SUPPORTED_ROOM_LANGUAGES,
  MAX_CODE_LENGTH,
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_USERNAME_LENGTH,
  MAX_COMPILER_OUTPUT_LENGTH,
  DANGEROUS_CODE_PATTERNS,
  normalizeRoomId,
  normalizeUsername,
  normalizeLanguage,
  isValidCodePayload,
  isSafeExecutableCode,
  normalizeCompilerOutput,
  normalizeChatMessage,
  isValidCursorPosition,
  isValidSelectionRange,
  normalizeSelection,
};
