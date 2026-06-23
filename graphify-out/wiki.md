# collaborative-platform

Real-time Collaborative Code Editor - Retro Gaming Theme

- Nodes: 367
- Edges: 239
- Layers: 8
- Tour steps: 9
- Languages: css, env, html, javascript, json, markdown, plaintext, sql, toml, yaml
- Frameworks: React
- Commit: c6c51f36a66edf9be89cbafea1a14f4292cf0197

## Architecture

### Configuration Layer

Application configuration and environment settings

Nodes: 2

### Middleware Layer

Request/response middleware and interceptors

Nodes: 2

### Service Layer

Business logic and application services

Nodes: 2

### External Services

External service integrations, SDKs, and third-party adapters

Nodes: 13

### UI Layer

User interface components and views

Nodes: 13

### Core

Core application files

Nodes: 17

### API Layer

HTTP endpoints, route handlers, and API controllers

Nodes: 1

### Test Layer

Test files and test utilities

Nodes: 6

## Tour

1. **Configuration Layer** - Application configuration and environment settings. Key files: supabase.js, supabase.js.
2. **Middleware Layer** - Request/response middleware and interceptors. Key files: auth.js, auth.js.
3. **Service Layer** - Business logic and application services. Key files: roomService.js, roomService.js.
4. **External Services** - External service integrations, SDKs, and third-party adapters. Key files: index.html, postcss.config.js, _redirects, App.jsx, main.jsx, pixel.css, client.js, tailwind.config.js, vite.config.js, socket.js, boilerplates.js, languages.js, supabase.js.
5. **UI Layer** - User interface components and views. Key files: RoomHeader.jsx, Editor.jsx, Home.jsx, ThemeContext.jsx, UserList.jsx, ChatPanel.jsx, LanguageSelector.jsx, OutputPanel.jsx, AnalysisPanel.jsx, ProblemPanel.jsx, ThemeToggle.jsx, SupabaseAuthPanel.jsx, useTheme.js.
6. **Core** - Core application files. Key files: graphify-update.mjs, collabDocument.js, executionToken.js, index.js, problems.js, jdoodle.js, openrouter.js, providerErrors.js, validators.js, cli-latest, gotrue-version, pooler-url, postgres-version, project-ref, rest-version, storage-migration, storage-version.
7. **API Layer** - HTTP endpoints, route handlers, and API controllers. Key files: index.js.
8. **Test Layer** - Test files and test utilities. Key files: analyze-route.test.js, collab-document.test.js, execute-route.test.js, executionToken.test.js, presence-socket.test.js, validators.test.js.
9. **Supporting Components** - Additional supporting files: CHANGELOG.md, _contributing.md, _sections.md, _template.md, advanced-full-text-search.md, advanced-jsonb-indexing.md, conn-idle-timeout.md, conn-limits.md, conn-pooling.md, conn-prepared-statements.md, data-batch-inserts.md, data-n-plus-one.md, data-pagination.md, data-upsert.md, lock-advisory.md, lock-deadlock-prevention.md, lock-short-transactions.md, lock-skip-locked.md, monitor-explain-analyze.md, monitor-pg-stat-statements.md, monitor-vacuum-analyze.md, query-composite-indexes.md, query-covering-indexes.md, query-index-types.md, query-missing-indexes.md, query-partial-indexes.md, schema-constraints.md, schema-data-types.md, schema-foreign-key-indexes.md, schema-lowercase-identifiers.md, schema-partitioning.md, schema-primary-keys.md, security-privileges.md, security-rls-basics.md, security-rls-performance.md, SKILL.md, feedback-issue-template.md, CHANGELOG.md, skill-feedback.md, SKILL.md, plan.md, 001_initial_schema.sql, 002_rls_policies.sql, README.md, SUPABASE_AUTH_PLAN.md, copilot-instructions.md, plan.md, plan1.md, 01-supabase-auth.md, 02-persistent-room-state.md, 03-code-snippets.md, 04-test-case-judge.md, 05-whiteboard.md, 06-voice-video-call.md, 07-user-dashboard.md, 08-ai-chat.md, 09-readonly-links.md, 10-session-timer.md, 11-judge0-languages.md, 12-multi-file-editor.md, 13-room-tags-search.md, 14-code-screenshot.md, 15-code-templates.md, 16-confetti.md, 17-i18n.md, 18-notifications.md, 19-accessibility.md, 20-room-replay.md, 21-achievements.md, 22-problem-submission.md, README.md, plan.md, Notes.txt, plan.md, AGENTS.md, .env, .env.example, .env.local, package.json, package.json, README.md, render.yaml, .env, .env.example, package.json, skills-lock.json, linked-project.json, config.toml, 20260620070938_initial_schema.sql, 20260620070939_rls_policies.sql, 20260620073820_fix_advisor_warnings.sql, getUserFromToken, requireAuth, optionalAuth, requireOwner, profiles, rooms, room_members, chat_messages, code_snapshots, saved_snippets, solved_problems, idx_rooms_is_active, idx_room_members_room, idx_room_members_user, idx_chat_room, idx_snapshots_room, idx_snippets_user, idx_solved_user, createRoom, getRoom, updateRoomCode, closeRoom, joinRoom, leaveRoom, getRoomMembers, transferOwnership, VITE_SOCKET_URL, VITE_SOCKET_URL, VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SOCKET_URL, VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, EditorLoadingFallback, App, RoomHeader, clamp, getStoredNumber, getStoredDensity, isOwnerUser, getPresenceKey, createPresenceMap, isRangeSelected, getSelectionPayload, getEditorPresencePayload, toDocumentUpdate, hexToRgba, EditorPage, TopBar, ResizeHandle, SessionRail, PresenceRail, ActivityRail, ShortcutsBar, MobileTabs, MobileSheet, InviteModal, createClient, withOpacity, normalizeModuleId, matchesPackage, resolveModulePreloadDependencies, getManualChunk, rel, getGitHash, readJson, walk, lineCount, complexityFromLines, categoryFor, nodeTypeForCategory, summaryFor, resolveImport, countBy, escapeHtml, escapeScriptJson, buildViewerHtml, buildWikipediaHtml, buildWikiMarkdown, NODE_ENV, PORT, CORS_ORIGINS, EXECUTION_TOKEN_SECRET, JDOODLE_CLIENT_ID, JDOODLE_CLIENT_SECRET, OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_HTTP_REFERER, OPENROUTER_APP_TITLE, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, NODE_ENV, PORT, CORS_ORIGINS, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EXECUTION_TOKEN_SECRET, JDOODLE_CLIENT_ID, JDOODLE_CLIENT_SECRET, OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_FALLBACK_MODELS, OPENROUTER_HTTP_REFERER, OPENROUTER_APP_TITLE, ANALYSIS_FALLBACK_ON_ERROR, createCollabDocument, attachCollabDocument, normalizeDocumentUpdate, encodeDocumentUpdate, getDocumentStatePayload, applyDocumentUpdate, replaceDocumentText, getSupabaseConfigStatus, validateAccessToken, getUserFromAccessToken, getExecutionTokenSecret, base64urlEncode, base64urlDecode, signPayload, createExecutionToken, verifyExecutionToken, getUserColor, getRoomUsers, generateRoomId, getUserPresence, getRoomPresence, updateUserPresence, scheduleRoomCodePersist, createRoomExecutionToken, getBearerToken, optionalAuth, requireAuth, getJdoodleCredentialStatus, logJdoodleCredentialStatus, executeCode, createEmptyAnalysis, normalizeSeverity, normalizeGrade, normalizeAnalysisShape, parseAnalysisResponse, buildAnalysisPrompts, getOpenRouterModels, requestOpenRouterAnalysis, createLocalAnalysis, shouldUseLocalAnalysisFallback, analyzeCode, handleOpenRouterError, getProviderErrorDetails, getSafeProviderMessage, createProviderError, registerRoutes, skipped, logError, run, memberConflictTarget, getRoom, upsertRoom, updateRoomCode, updateRoomLanguage, closeRoom, joinRoomMember, leaveRoomMember, updateMemberPaused, transferOwnership, saveChatMessage, saveSnapshot, setCurrentProblem, markProblemSolved, noopLimiter, createTestApp, noopLimiter, createTestApp, validToken, getSocketHandler, normalizeRoomId, normalizeUsername, normalizeLanguage, isValidCodePayload, isSafeExecutableCode, normalizeCompilerOutput, normalizeChatMessage, isValidCursorPosition, isValidSelectionRange, normalizeSelection, public, idx_rooms_is_active, idx_rooms_expires_at, idx_room_members_room_active, idx_room_members_user, idx_room_members_socket, idx_chat_room_created, idx_snapshots_room_created, idx_snippets_user, idx_solved_user, Home, ProductPreview, ThemeProvider, SocketService, UserList, ChatPanel, LanguageSelector, OutputPanel, OutputBlock, parseAnalysis, normalizeAnalysis, LoadingState, AnalysisPanel, ProblemPanel, getBoilerplate, ThemeToggle, getEmailRedirectUrl, getAuthErrorMessage, SupabaseAuthPanel, useTheme, getFreshSession, getSupabaseAccessToken, getDisplayNameFromUser.
