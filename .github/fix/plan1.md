# Fix: AI Analyzer Output — Structured JSON Response with Tabbed UI

## Problem

The AI analyzer currently returns a long unstructured plain text blob. The output mixes bug fixes, code quality suggestions, and complexity analysis all together with no separation, making it hard to read and not actionable. The goal is to make the analyzer return clean structured data and display it in a polished tabbed panel.

## What Needs to Change

There are two parts to this fix — the backend prompt and response shape, and the frontend panel that renders it.

## Backend — server/providers/openrouter.js

Inside buildAnalysisPrompts, rewrite the system prompt so the model is instructed to respond exclusively in valid JSON with no preamble, no markdown fences, and no explanation outside the JSON object. The JSON schema the model must return is a single object with exactly three top-level keys: fixes, quality, and complexity.

The fixes key must be an array of objects, where each object has a severity field that is one of "critical", "warning", or "info", a title field that is a short one-line description of the issue, and a description field that is one to two sentences explaining what is wrong and exactly what to change. There should be no more than five fix items.

The quality key must be an object with a score field that is a number from 0 to 100 representing overall code quality, a grade field that is a letter grade from A to F, and an items array where each item has a category field such as "Naming", "Structure", "Readability", or "Best Practices", and a comment field that is one sentence of feedback. There should be no more than four quality items.

The complexity key must be an object with a time field, a space field, and an explanation field. The time and space fields are strings in Big-O notation such as "O(n)" or "O(n log n)". The explanation field is two to three sentences describing why the code has that complexity and where the bottleneck is, if any.

After calling requestOpenRouterAnalysis, parse the raw string response as JSON before returning it from analyzeCode. If parsing fails, fall back to a safe default object that matches the same schema with empty arrays and placeholder values rather than returning the raw string. The API route in server/routes/index.js that calls analyzeCode should forward this parsed object as the JSON response body directly, not wrapped in any additional envelope.

## Frontend — client/src/components/AnalysisPanel.jsx

Replace the current output display with a three-tab layout. The tabs are labeled "Fixes", "Quality", and "Complexity". Only one tab is visible at a time and the active tab is highlighted using the existing retro pixel theme tokens.

The Fixes tab renders each item in the fixes array as a card. Each card shows the severity as a colored badge — red for critical, yellow for warning, and blue for info — followed by the title in bold and the description below it. If the fixes array is empty, show a message saying the code looks clean.

The Quality tab shows the score and grade prominently at the top, styled like a stat display consistent with the retro gaming theme. Below that, render each item in the quality items array as a row with the category name on the left and the comment on the right.

The Complexity tab shows the time and space complexity values as two large labeled stat boxes side by side, followed by the explanation text below them.

While the analysis is loading, show a skeleton or pixel-themed loading state inside the panel instead of a spinner over the whole editor. If the response fails to parse or returns an error, show a clear error state inside the panel with a retry button.

The AnalysisPanel component receives the raw API response as a prop from Editor.jsx. It should parse and render the structured JSON directly. No logic changes are needed in Editor.jsx beyond passing the response through as-is.

## Do Not

Do not stream the response — parse it as a complete JSON object after the full response arrives. Do not change the OpenRouter model selection logic or the shouldUseLocalAnalysisFallback behavior. Do not add new API routes — use the existing analyze endpoint. Do not change anything in the authentication or rate limiting middleware. Do not lose the retro pixel visual theme in the panel redesign.
