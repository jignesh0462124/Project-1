import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const projectRoot = path.resolve(process.argv[2] ?? process.cwd());
const outDir = path.join(projectRoot, "graphify-out");
const pluginRoot = process.env.UNDERSTAND_PLUGIN_ROOT ?? "C:/Users/jigne/.understand-anything-plugin";
const corePath = pathToFileURL(path.join(pluginRoot, "packages/core/dist/index.js")).href;
const {
  GraphBuilder,
  PluginRegistry,
  TreeSitterPlugin,
  LanguageRegistry,
  FrameworkRegistry,
  builtinLanguageConfigs,
  builtinExtractors,
  registerAllParsers,
  createIgnoreFilter,
  detectLayers,
  generateHeuristicTour,
  validateGraph,
  autoFixGraph,
  buildFingerprintStore,
} = await import(corePath);

fs.mkdirSync(outDir, { recursive: true });

function rel(file) {
  return path.relative(projectRoot, file).replaceAll(path.sep, "/");
}

function getGitHash() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function walk(dir, ignoreFilter, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const relative = rel(abs);
    const normalized = relative.toLowerCase();
    if (normalized === "graphify-out" || normalized.startsWith("graphify-out/")) continue;
    if (entry.isDirectory()) {
      if (!ignoreFilter.isIgnored(`${relative}/`)) walk(abs, ignoreFilter, files);
    } else if (entry.isFile() && !ignoreFilter.isIgnored(relative)) {
      files.push(abs);
    }
  }
  return files;
}

function lineCount(content) {
  return content ? content.split(/\r\n|\r|\n/).length : 0;
}

function complexityFromLines(lines) {
  if (lines > 350) return "complex";
  if (lines > 120) return "moderate";
  return "simple";
}

function categoryFor(relativePath, language) {
  const lower = relativePath.toLowerCase();
  if (lower === "readme.md" || lower.endsWith(".md") || lower.endsWith(".txt")) return "docs";
  if (lower.includes(".github/workflows/")) return "infra";
  if (lower.includes("supabase/migrations/") || lower.endsWith(".sql")) return "data";
  if (["json", "yaml", "toml", "env"].includes(language ?? "")) return "config";
  if (["dockerfile", "docker-compose", "terraform", "makefile"].includes(language ?? "")) return "infra";
  if (["shell", "batch"].includes(language ?? "")) return "script";
  if (["html", "css"].includes(language ?? "")) return "markup";
  return "code";
}

function nodeTypeForCategory(category, language, relativePath) {
  if (category === "docs") return "document";
  if (category === "infra") {
    if (relativePath.includes(".github/workflows/")) return "pipeline";
    if (language === "terraform") return "resource";
    return "service";
  }
  if (category === "data") return "schema";
  if (category === "config") return "config";
  return "file";
}

function summaryFor(relativePath, language, category, analysis) {
  const pieces = [];
  if (analysis?.functions?.length) pieces.push(`${analysis.functions.length} functions`);
  if (analysis?.classes?.length) pieces.push(`${analysis.classes.length} classes`);
  if (analysis?.imports?.length) pieces.push(`${analysis.imports.length} imports`);
  if (analysis?.definitions?.length) pieces.push(`${analysis.definitions.length} definitions`);
  if (analysis?.endpoints?.length) pieces.push(`${analysis.endpoints.length} endpoints`);
  if (analysis?.services?.length) pieces.push(`${analysis.services.length} services`);
  if (pieces.length) return `${relativePath} contains ${pieces.join(", ")}.`;
  return `${relativePath} is a ${category} file${language ? ` written as ${language}` : ""}.`;
}

function resolveImport(fromRel, importSource, filesByStem) {
  if (!importSource || (!importSource.startsWith(".") && !importSource.startsWith("/"))) return null;
  const fromDir = path.posix.dirname(fromRel);
  const base = path.posix.normalize(path.posix.join(fromDir, importSource));
  return filesByStem.get(base) ?? filesByStem.get(`${base}/index`) ?? filesByStem.get(`${base}/main`) ?? null;
}

function countBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
}

function escapeScriptJson(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function buildViewerHtml(graph, stats) {
  const embedded = escapeScriptJson(graph);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Graphify | ${escapeHtml(graph.project.name)}</title>
  <style>
    :root { color-scheme: dark; --bg:#080a0f; --panel:#111827; --panel2:#151f32; --text:#eef4ff; --muted:#9fb0c9; --line:#263247; --accent:#39d98a; --accent2:#58a6ff; --warn:#ffd166; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Inter, ui-sans-serif, system-ui, Segoe UI, Arial, sans-serif; background: radial-gradient(circle at 20% 0%, #14301f 0, transparent 28rem), radial-gradient(circle at 90% 10%, #102a4f 0, transparent 24rem), var(--bg); color:var(--text); }
    header { padding:32px clamp(20px, 4vw, 56px) 18px; border-bottom:1px solid var(--line); }
    .topline { display:flex; align-items:center; justify-content:space-between; gap:18px; flex-wrap:wrap; }
    h1 { margin:0; font-size:clamp(30px, 5vw, 58px); line-height:1.02; letter-spacing:0; }
    .actions { display:flex; gap:10px; flex-wrap:wrap; }
    a.button, button { border:1px solid var(--line); background:#101826; color:var(--text); border-radius:8px; padding:10px 13px; text-decoration:none; cursor:pointer; font-weight:650; font-size:14px; }
    a.button:hover, button:hover { border-color:var(--accent); }
    .desc { margin:14px 0 0; color:var(--muted); max-width:860px; font-size:16px; line-height:1.6; }
    main { padding:24px clamp(20px, 4vw, 56px) 48px; }
    .stats { display:grid; grid-template-columns:repeat(5, minmax(130px, 1fr)); gap:12px; margin-bottom:20px; }
    .stat { background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02)); border:1px solid var(--line); border-radius:8px; padding:14px; }
    .stat b { display:block; font-size:28px; line-height:1; }
    .stat span { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.08em; }
    .layout { display:grid; grid-template-columns:minmax(280px, 380px) 1fr; gap:18px; align-items:start; }
    .panel { background:rgba(12,18,30,.82); border:1px solid var(--line); border-radius:8px; overflow:hidden; }
    .panel h2 { margin:0; padding:14px 16px; font-size:16px; border-bottom:1px solid var(--line); }
    .tools { display:grid; gap:10px; padding:14px; border-bottom:1px solid var(--line); }
    input, select { width:100%; background:#080d16; color:var(--text); border:1px solid var(--line); border-radius:8px; padding:10px 11px; font-size:14px; }
    .list { max-height:68vh; overflow:auto; }
    .node { display:block; width:100%; text-align:left; border:0; border-bottom:1px solid rgba(255,255,255,.07); border-radius:0; background:transparent; padding:12px 14px; }
    .node strong { display:block; color:var(--text); overflow-wrap:anywhere; }
    .node small { color:var(--muted); overflow-wrap:anywhere; }
    .node.active { background:#112a20; box-shadow: inset 3px 0 0 var(--accent); }
    .detail { padding:18px; min-height:320px; }
    .chips { display:flex; flex-wrap:wrap; gap:7px; margin:12px 0; }
    .chip { border:1px solid var(--line); color:#cfe3ff; border-radius:999px; padding:4px 8px; font-size:12px; background:#101826; }
    .grid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:14px; }
    .box { border:1px solid var(--line); border-radius:8px; padding:13px; background:rgba(255,255,255,.03); }
    .box h3 { margin:0 0 8px; font-size:14px; color:#d8e7ff; }
    .box ul { margin:0; padding-left:18px; color:var(--muted); line-height:1.6; }
    .layerbar { display:flex; flex-wrap:wrap; gap:8px; margin:16px 0 0; }
    .layerbar button { font-size:12px; padding:8px 10px; }
    code { color:#9ee493; }
    @media (max-width: 860px) { .stats { grid-template-columns:repeat(2, minmax(0,1fr)); } .layout, .grid { grid-template-columns:1fr; } .list { max-height:320px; } }
  </style>
</head>
<body>
  <header>
    <div class="topline">
      <h1>Graphify</h1>
      <nav class="actions">
        <a class="button" href="./graph.json" download>Download JSON</a>
        <a class="button" href="./wikipedia.html">Wikipedia View</a>
      </nav>
    </div>
    <p class="desc"><strong>${escapeHtml(graph.project.name)}</strong> — ${escapeHtml(graph.project.description)}. Generated at ${escapeHtml(graph.project.analyzedAt)} from commit <code>${escapeHtml(graph.project.gitCommitHash)}</code>.</p>
  </header>
  <main>
    <section class="stats">
      <div class="stat"><b>${stats.totalNodes}</b><span>Nodes</span></div>
      <div class="stat"><b>${stats.totalEdges}</b><span>Edges</span></div>
      <div class="stat"><b>${graph.layers.length}</b><span>Layers</span></div>
      <div class="stat"><b>${graph.tour.length}</b><span>Tour Steps</span></div>
      <div class="stat"><b>${graph.project.languages.length}</b><span>Languages</span></div>
    </section>
    <section class="layout">
      <aside class="panel">
        <h2>Nodes</h2>
        <div class="tools">
          <input id="search" placeholder="Search files, functions, configs...">
          <select id="typeFilter"><option value="">All node types</option></select>
        </div>
        <div id="nodeList" class="list"></div>
      </aside>
      <section class="panel">
        <h2 id="detailTitle">Project Overview</h2>
        <div id="detail" class="detail"></div>
      </section>
    </section>
  </main>
  <script id="graph-data" type="application/json">${embedded}</script>
  <script>
    const graph = JSON.parse(document.getElementById('graph-data').textContent);
    const nodes = graph.nodes || [];
    const edges = graph.edges || [];
    const byId = new Map(nodes.map(n => [n.id, n]));
    const list = document.getElementById('nodeList');
    const detail = document.getElementById('detail');
    const title = document.getElementById('detailTitle');
    const search = document.getElementById('search');
    const typeFilter = document.getElementById('typeFilter');
    const types = [...new Set(nodes.map(n => n.type))].sort();
    for (const type of types) typeFilter.insertAdjacentHTML('beforeend', '<option value="' + type + '">' + type + '</option>');
    function esc(v) { return String(v ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
    function related(id, dir) { return edges.filter(e => dir === 'in' ? e.target === id : e.source === id).slice(0, 18); }
    function renderOverview() {
      title.textContent = 'Project Overview';
      detail.innerHTML = '<div class="grid">' +
        '<div class="box"><h3>Languages</h3><ul>' + graph.project.languages.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' +
        '<div class="box"><h3>Frameworks</h3><ul>' + (graph.project.frameworks.length ? graph.project.frameworks : ['None detected']).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' +
        '<div class="box"><h3>Layers</h3><ul>' + graph.layers.map(x => '<li>' + esc(x.name) + ' (' + x.nodeIds.length + ')</li>').join('') + '</ul></div>' +
        '<div class="box"><h3>Tour</h3><ul>' + graph.tour.map(x => '<li>' + esc(x.order) + '. ' + esc(x.title) + '</li>').join('') + '</ul></div>' +
        '</div><div class="layerbar">' + graph.layers.map(layer => '<button data-layer="' + esc(layer.id) + '">' + esc(layer.name) + '</button>').join('') + '</div>';
      detail.querySelectorAll('[data-layer]').forEach(btn => btn.addEventListener('click', () => showLayer(btn.dataset.layer)));
    }
    function showLayer(layerId) {
      const layer = graph.layers.find(l => l.id === layerId);
      if (!layer) return;
      title.textContent = layer.name;
      detail.innerHTML = '<p>' + esc(layer.description) + '</p><div class="box"><h3>Nodes in this layer</h3><ul>' + layer.nodeIds.slice(0, 80).map(id => '<li><button data-node="' + esc(id) + '">' + esc(id) + '</button></li>').join('') + '</ul></div>';
      detail.querySelectorAll('[data-node]').forEach(btn => btn.addEventListener('click', () => showNode(btn.dataset.node)));
    }
    function showNode(id) {
      const node = byId.get(id);
      if (!node) return;
      document.querySelectorAll('.node').forEach(n => n.classList.toggle('active', n.dataset.id === id));
      title.textContent = node.name || node.id;
      const outgoing = related(id, 'out');
      const incoming = related(id, 'in');
      detail.innerHTML = '<p>' + esc(node.summary) + '</p>' +
        '<div class="chips">' + [node.type, node.complexity, ...(node.tags || [])].map(x => '<span class="chip">' + esc(x) + '</span>').join('') + '</div>' +
        '<div class="grid">' +
        '<div class="box"><h3>Details</h3><ul><li>ID: <code>' + esc(node.id) + '</code></li><li>File: <code>' + esc(node.filePath || 'n/a') + '</code></li></ul></div>' +
        '<div class="box"><h3>Outgoing Edges</h3><ul>' + (outgoing.length ? outgoing.map(e => '<li>' + esc(e.type) + ' → <code>' + esc(e.target) + '</code></li>').join('') : '<li>None</li>') + '</ul></div>' +
        '<div class="box"><h3>Incoming Edges</h3><ul>' + (incoming.length ? incoming.map(e => '<li><code>' + esc(e.source) + '</code> → ' + esc(e.type) + '</li>').join('') : '<li>None</li>') + '</ul></div>' +
        '</div>';
    }
    function renderList() {
      const q = search.value.toLowerCase();
      const type = typeFilter.value;
      const filtered = nodes.filter(n => (!type || n.type === type) && [n.id, n.name, n.filePath, n.summary].join(' ').toLowerCase().includes(q)).slice(0, 500);
      list.innerHTML = filtered.map(n => '<button class="node" data-id="' + esc(n.id) + '"><strong>' + esc(n.name) + '</strong><small>' + esc(n.type) + ' · ' + esc(n.filePath || n.id) + '</small></button>').join('');
      list.querySelectorAll('.node').forEach(btn => btn.addEventListener('click', () => showNode(btn.dataset.id)));
    }
    search.addEventListener('input', renderList);
    typeFilter.addEventListener('change', renderList);
    renderList();
    renderOverview();
  </script>
</body>
</html>`;
}

function buildWikipediaHtml(graph, stats) {
  const nodeTypes = Object.entries(stats.nodeTypes).sort((a, b) => b[1] - a[1]);
  const edgeTypes = Object.entries(stats.edgeTypes).sort((a, b) => b[1] - a[1]);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(graph.project.name)} - Graphify Wiki</title>
  <style>
    body { margin:0; background:#f8f9fa; color:#202122; font-family: Georgia, 'Times New Roman', serif; }
    .page { max-width:1120px; margin:0 auto; padding:28px 22px 48px; background:white; min-height:100vh; }
    h1 { font-size:38px; font-weight:400; border-bottom:1px solid #a2a9b1; margin:0 0 12px; padding-bottom:8px; }
    h2 { font-size:24px; font-weight:400; border-bottom:1px solid #a2a9b1; margin-top:28px; }
    p, li { line-height:1.65; font-size:16px; }
    a { color:#36c; }
    .infobox { float:right; width:300px; border:1px solid #a2a9b1; background:#f8f9fa; margin:0 0 18px 24px; font-family:Arial, sans-serif; font-size:14px; }
    .infobox h2 { margin:0; padding:9px; border:0; background:#cedff2; text-align:center; font-size:18px; font-weight:700; }
    .row { display:grid; grid-template-columns:110px 1fr; border-top:1px solid #eaecf0; }
    .row b { padding:8px; background:#eaecf0; }
    .row span { padding:8px; }
    code { background:#f1f2f4; padding:1px 4px; border-radius:3px; }
    table { border-collapse:collapse; width:100%; margin:12px 0; font-family:Arial, sans-serif; font-size:14px; }
    th, td { border:1px solid #a2a9b1; padding:8px; text-align:left; }
    th { background:#eaecf0; }
    @media (max-width: 780px) { .infobox { float:none; width:auto; margin:0 0 18px; } }
  </style>
</head>
<body>
  <article class="page">
    <h1>${escapeHtml(graph.project.name)}</h1>
    <aside class="infobox">
      <h2>Graphify summary</h2>
      <div class="row"><b>Project</b><span>${escapeHtml(graph.project.name)}</span></div>
      <div class="row"><b>Nodes</b><span>${stats.totalNodes}</span></div>
      <div class="row"><b>Edges</b><span>${stats.totalEdges}</span></div>
      <div class="row"><b>Layers</b><span>${graph.layers.length}</span></div>
      <div class="row"><b>Languages</b><span>${escapeHtml(graph.project.languages.join(', '))}</span></div>
      <div class="row"><b>Frameworks</b><span>${escapeHtml(graph.project.frameworks.join(', ') || 'None detected')}</span></div>
      <div class="row"><b>Commit</b><span><code>${escapeHtml(graph.project.gitCommitHash)}</code></span></div>
    </aside>
    <p><b>${escapeHtml(graph.project.name)}</b> is represented here as a generated Graphify knowledge article. ${escapeHtml(graph.project.description)}</p>
    <p>The graph was generated on ${escapeHtml(graph.project.analyzedAt)} and contains ${stats.totalNodes} nodes connected by ${stats.totalEdges} relationships.</p>
    <h2>Architecture</h2>
    <p>The project is organized into ${graph.layers.length} detected layers. These layers group files, configuration, schema objects, and source entities by their role in the application.</p>
    <ul>${graph.layers.map(layer => `<li><b>${escapeHtml(layer.name)}</b>: ${escapeHtml(layer.description)} (${layer.nodeIds.length} graph nodes)</li>`).join('')}</ul>
    <h2>Languages and frameworks</h2>
    <p>Detected languages include ${escapeHtml(graph.project.languages.join(', ') || 'none')}. Detected frameworks include ${escapeHtml(graph.project.frameworks.join(', ') || 'none')}.</p>
    <h2>Node composition</h2>
    <table><thead><tr><th>Node type</th><th>Count</th></tr></thead><tbody>${nodeTypes.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${v}</td></tr>`).join('')}</tbody></table>
    <h2>Relationship composition</h2>
    <table><thead><tr><th>Edge type</th><th>Count</th></tr></thead><tbody>${edgeTypes.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${v}</td></tr>`).join('')}</tbody></table>
    <h2>Guided tour</h2>
    <ol>${graph.tour.map(step => `<li><b>${escapeHtml(step.title)}</b>: ${escapeHtml(step.description)}</li>`).join('')}</ol>
    <h2>Generated artifacts</h2>
    <ul>
      <li><a href="./index.html">Interactive Graphify viewer</a></li>
      <li><a href="./graph.json">Machine-readable graph JSON</a></li>
      <li><a href="./knowledge-graph.json">Understand-compatible graph JSON copy</a></li>
    </ul>
  </article>
</body>
</html>`;
}

function buildWikiMarkdown(graph, stats) {
  return `# ${graph.project.name}\n\n${graph.project.description}\n\n- Nodes: ${stats.totalNodes}\n- Edges: ${stats.totalEdges}\n- Layers: ${graph.layers.length}\n- Tour steps: ${graph.tour.length}\n- Languages: ${graph.project.languages.join(", ")}\n- Frameworks: ${graph.project.frameworks.join(", ") || "None detected"}\n- Commit: ${graph.project.gitCommitHash}\n\n## Architecture\n\n${graph.layers.map(layer => `### ${layer.name}\n\n${layer.description}\n\nNodes: ${layer.nodeIds.length}`).join("\n\n")}\n\n## Tour\n\n${graph.tour.map(step => `${step.order}. **${step.title}** - ${step.description}`).join("\n")}\n`;
}

const packageJson = readJson(path.join(projectRoot, "package.json"));
const projectName = packageJson?.name ?? path.basename(projectRoot);
const projectDescription = packageJson?.description ?? "Knowledge graph generated from the local source tree.";
const gitHash = getGitHash();
const ignoreFilter = createIgnoreFilter(projectRoot);
const languageRegistry = LanguageRegistry.createDefault();
const frameworkRegistry = FrameworkRegistry.createDefault();
const registry = new PluginRegistry(languageRegistry);
const treeSitter = new TreeSitterPlugin(languageRegistry.getAllLanguages(), builtinExtractors);
await treeSitter.init();
registry.register(treeSitter);
registerAllParsers(registry);

const builder = new GraphBuilder(projectName, gitHash, languageRegistry);
const files = walk(projectRoot, ignoreFilter).sort((a, b) => rel(a).localeCompare(rel(b)));
const filesByStem = new Map();
const analyses = new Map();
const categories = new Map();
const languages = new Set();

for (const file of files) {
  const relativePath = rel(file);
  const parsed = path.posix.parse(relativePath);
  filesByStem.set(path.posix.join(parsed.dir, parsed.name), relativePath);
}

for (const file of files) {
  const relativePath = rel(file);
  const language = registry.getLanguageForFile(relativePath);
  if (language) languages.add(language);
  const category = categoryFor(relativePath, language);
  categories.set(relativePath, category);
  let content;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const lines = lineCount(content);
  let analysis = null;
  try {
    analysis = registry.analyzeFile(relativePath, content);
  } catch {
    analysis = null;
  }
  analyses.set(relativePath, analysis);
  const meta = {
    summary: summaryFor(relativePath, language, category, analysis),
    tags: [category, language ?? "unknown"].filter(Boolean),
    complexity: complexityFromLines(lines),
  };
  if (category === "code") {
    builder.addFileWithAnalysis(relativePath, analysis ?? { functions: [], classes: [], imports: [], exports: [] }, {
      ...meta,
      summaries: {},
      fileSummary: meta.summary,
    });
  } else {
    builder.addNonCodeFileWithAnalysis(relativePath, {
      ...meta,
      nodeType: nodeTypeForCategory(category, language, relativePath),
      definitions: analysis?.definitions,
      services: analysis?.services,
      endpoints: analysis?.endpoints,
      steps: analysis?.steps,
      resources: analysis?.resources,
      sections: analysis?.sections,
    });
  }
}

for (const [relativePath, analysis] of analyses) {
  for (const item of analysis?.imports ?? []) {
    const target = resolveImport(relativePath, item.source, filesByStem);
    if (target) builder.addImportEdge(relativePath, target);
  }
}

let graph = builder.build();
const manifests = {};
for (const file of files) {
  const relativePath = rel(file);
  const basename = path.posix.basename(relativePath);
  if (["package.json", "requirements.txt", "pyproject.toml", "go.mod", "Cargo.toml", "pom.xml", "build.gradle", "composer.json"].includes(basename)) {
    manifests[relativePath] = fs.readFileSync(file, "utf8");
  }
}
const frameworks = frameworkRegistry.detectFrameworks(manifests).map(framework => framework.displayName ?? framework.id);
graph.project.description = projectDescription;
graph.project.languages = [...languages].sort();
graph.project.frameworks = [...new Set(frameworks)].sort();
graph.project.analyzedAt = new Date().toISOString();
graph.project.gitCommitHash = gitHash;
graph.layers = detectLayers(graph);
graph.tour = generateHeuristicTour(graph);

let validation = validateGraph(graph);
let issues = validation.issues ?? [];
if ((validation.valid === false || validation.success === false || issues.length > 0) && typeof autoFixGraph === "function") {
  const fixed = autoFixGraph(graph);
  graph = fixed.graph ?? fixed.data ?? graph;
  validation = validateGraph(graph);
  issues = validation.issues ?? [];
}

const stats = {
  totalNodes: graph.nodes.length,
  totalEdges: graph.edges.length,
  nodeTypes: countBy(graph.nodes, node => node.type),
  edgeTypes: countBy(graph.edges, edge => edge.type),
  fileCategoryCounts: countBy([...categories.values()], category => category),
};

fs.writeFileSync(path.join(outDir, "graph.json"), JSON.stringify(graph, null, 2), "utf8");
fs.writeFileSync(path.join(outDir, "knowledge-graph.json"), JSON.stringify(graph, null, 2), "utf8");
fs.writeFileSync(path.join(outDir, "index.html"), buildViewerHtml(graph, stats), "utf8");
fs.writeFileSync(path.join(outDir, "wikipedia.html"), buildWikipediaHtml(graph, stats), "utf8");
fs.writeFileSync(path.join(outDir, "wiki.md"), buildWikiMarkdown(graph, stats), "utf8");

try {
  const fingerprintStore = buildFingerprintStore(projectRoot, files.map(rel), registry, gitHash);
  fs.writeFileSync(path.join(outDir, "fingerprints.json"), JSON.stringify(fingerprintStore, null, 2), "utf8");
} catch (error) {
  console.warn(`Fingerprint generation skipped: ${error.message}`);
}

fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify({
  lastAnalyzedAt: graph.project.analyzedAt,
  gitCommitHash: gitHash,
  version: graph.version,
  analyzedFiles: files.length,
  outputFolder: "graphify-out",
  viewer: "graphify-out/index.html",
  wiki: "graphify-out/wikipedia.html",
}, null, 2), "utf8");

console.log(JSON.stringify({
  outputFolder: outDir,
  viewer: path.join(outDir, "index.html"),
  wiki: path.join(outDir, "wikipedia.html"),
  graph: path.join(outDir, "graph.json"),
  analyzedFiles: files.length,
  totalNodes: graph.nodes.length,
  totalEdges: graph.edges.length,
  layers: graph.layers.map(layer => layer.name),
  issues,
}, null, 2));
