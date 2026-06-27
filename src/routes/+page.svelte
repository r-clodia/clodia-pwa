<script>
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import { agentPfpUrl, listTopics } from '$lib/api.js';

  marked.setOptions({ breaks: true, gfm: true });

  let topics = [];
  let loading = true;
  let error = '';
  let refreshing = false;
  let standalone = false;
  let showArchived = false;
  let expandedTopics = {};
  let missingPfps = {};

  $: archivedCount = topics.filter((topic) => topicStatus(topic) === 'archived').length;
  $: filteredTopics = topics
    .filter((topic) => showArchived || topicStatus(topic) !== 'archived')
    .toSorted((a, b) => commitTime(b) - commitTime(a));

  function renderMarkdown(text) {
    return DOMPurify.sanitize(marked.parse(text || '_Nessun TLDR disponibile._'));
  }

  function topicColor(tier) {
    const t = String(tier || 'SEAL-0').toUpperCase().replace(/^P(\d)$/, 'SEAL-$1');
    if (t === 'SEAL-4') return '#a855f7';
    if (t === 'SEAL-3') return '#ef4444';
    if (t === 'SEAL-2') return '#f59e0b';
    if (t === 'SEAL-1') return '#60a5fa';
    return '#94a3b8';
  }

  function privacyClass(tier) {
    const t = String(tier || 'SEAL-0').toUpperCase().replace(/^P(\d)$/, 'SEAL-$1');
    return (t === 'SEAL-3' || t === 'SEAL-4') ? 'privacy-confidential' : 'privacy-personal';
  }

  function topicStatus(topic) {
    return String(topic.status || 'active').toLowerCase();
  }

  function statusClass(status) {
    const s = String(status || 'active').toLowerCase();
    if (s === 'archived') return 'status-archived';
    if (s === 'await') return 'status-await';
    if (s === 'idle') return 'status-idle';
    return 'status-active';
  }

  function formatDate(value) {
    if (!value) return 'no git';
    try {
      return new Intl.DateTimeFormat('it-IT', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value));
    } catch (_) {
      return value;
    }
  }

  function commitTime(topic) {
    const t = Date.parse(topic.last_commit || '');
    return Number.isNaN(t) ? 0 : t;
  }

  function topicKey(topic) {
    return `${topic.tier}/${topic.name}`;
  }

  function toggleTopic(topic) {
    const key = topicKey(topic);
    expandedTopics = { ...expandedTopics, [key]: !expandedTopics[key] };
  }

  function initials(name) {
    return String(name || '?').slice(0, 2).toUpperCase();
  }

  function markMissingPfp(name) {
    missingPfps = { ...missingPfps, [name]: true };
  }

  function fileIcon(name) {
    const ext = String(name).split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') return '📄';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
    if (['ppt', 'pptx'].includes(ext)) return '📑';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return '🖼';
    if (['zip', 'tar', 'gz', '7z'].includes(ext)) return '🗜';
    if (['py', 'js', 'ts', 'sh', 'json', 'yaml', 'yml'].includes(ext)) return '💾';
    return '📎';
  }

  function artifactDownloadUrl(topic, artifact) {
    // Same-origin di default (stringa vuota → URL relativo): in container il
    // server.mjs fa da proxy verso il backend, così la PWA funziona ovunque
    // (LAN, Tailscale) senza IP cablati. Override con VITE_PUBLIC_API_BASE_URL.
    const base = import.meta.env.VITE_PUBLIC_API_BASE_URL || '';
    return `${base}/topics/${topic.tier}/${topic.name}/download?path=${encodeURIComponent(artifact.path)}`;
  }

  function fmtArtifactDate(iso) {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(new Date(iso));
    } catch (_) {
      return '';
    }
  }

  function chatHref(topic) {
    // Il topic è un canale: apri la vista canale (stream messaggi + composer).
    return `/channel/${topic.tier}/${topic.name}`;
  }

  async function refresh() {
    error = '';
    refreshing = true;
    try {
      topics = await listTopics();
    } catch (err) {
      error = err.message || 'Errore caricamento topics';
    } finally {
      loading = false;
      refreshing = false;
    }
  }

  onMount(() => {
    standalone =
      window.navigator.standalone === true ||
      window.matchMedia?.('(display-mode: standalone)').matches;
    refresh();
  });
</script>

<svelte:head>
  <title>Clodia Topics</title>
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, viewport-fit=cover"
  />
</svelte:head>

<div class="home">
  <header class="topbar">
    <h1>Topics</h1>
    <button class="refresh-btn" on:click={refresh} disabled={refreshing} aria-label="Aggiorna topics">
      {refreshing ? '…' : '↻'}
    </button>
  </header>

  {#if !standalone}
    <section class="install-card" aria-label="Installa Clodia">
      <strong>Vuoi usarla come app?</strong>
      <span>Su iPhone: Condividi → Aggiungi alla schermata Home.</span>
    </section>
  {/if}

  <label class="archive-toggle">
    <input type="checkbox" bind:checked={showArchived} />
    <span>Mostra archived</span>
    {#if archivedCount > 0}
      <strong>{archivedCount}</strong>
    {/if}
  </label>

  {#if loading}
    <section class="state">Carico i topic…</section>
  {:else if error}
    <section class="state error">
      <strong>Non riesco a caricare i topic.</strong>
      <span>{error}</span>
    </section>
  {:else if filteredTopics.length === 0}
    <section class="state">Nessun topic in questa vista.</section>
  {:else}
    <section class="topic-list" aria-label="Anteprime topic">
      {#each filteredTopics as topic (topic.tier + '/' + topic.name)}
        {@const key = topicKey(topic)}
        {@const expanded = !!expandedTopics[key]}
        <article class="topic-card">
          <button
            class="card-summary"
            class:expanded
            type="button"
            aria-expanded={expanded}
            aria-controls={`topic-details-${key}`}
            on:click={() => toggleTopic(topic)}
          >
            <span class="dot" style={`background: ${topicColor(topic.tier)}`}></span>
            <span class="title-block">
              <span class="topic-title">{topic.title || topic.name}</span>
              <span class="topic-meta">
                <span>{formatDate(topic.last_commit)}</span>
                <span class="privacy {privacyClass(topic.tier)}">
                  {topic.tier_name || topic.tier}
                </span>
                <span class="status-pill {statusClass(topicStatus(topic))}">
                  {topicStatus(topic)}
                </span>
              </span>
            </span>
            <span class="chevron" aria-hidden="true">⌄</span>
          </button>

          {#if expanded}
            <div class="card-details" id={`topic-details-${key}`}>
              {#if topic.contact_agent}
                <div class="contact-agent">
                  {#if !missingPfps[topic.contact_agent]}
                    <img
                      src={agentPfpUrl(topic.contact_agent)}
                      alt={`Profilo ${topic.contact_agent}`}
                      on:error={() => markMissingPfp(topic.contact_agent)}
                    />
                  {:else}
                    <span class="agent-fallback" aria-hidden="true">
                      {initials(topic.contact_agent)}
                    </span>
                  {/if}
                  <span>
                    <span class="contact-label">Contact agent</span>
                    <strong>{topic.contact_agent}</strong>
                  </span>
                  <a
                    class="chat-link"
                    href={chatHref(topic)}
                    aria-label={`Apri il canale ${topic.name}`}
                    on:click|stopPropagation
                  >
                    💬
                  </a>
                </div>
              {/if}

              <div class="tldr markdown">
                {@html renderMarkdown(topic.tldr)}
              </div>

              <div class="todos">
                <div class="todos-title">Todo aperti</div>
                {#if topic.action_points?.length}
                  <ol>
                    {#each topic.action_points.slice(0, 3) as item}
                      <li class="markdown todo-item">{@html renderMarkdown(item)}</li>
                    {/each}
                  </ol>
                {:else}
                  <p class="empty-todos">Nessun todo rilevato nel summary.</p>
                {/if}
              </div>

              {#if topic.recent_artifacts?.length}
                <div class="artifacts">
                  <div class="artifacts-title">Artefatti recenti</div>
                  <ul class="artifact-list">
                    {#each topic.recent_artifacts as a}
                      <li class="artifact-item">
                        <span class="artifact-icon">{fileIcon(a.name)}</span>
                        <a
                          class="artifact-name"
                          title={a.path}
                          href={artifactDownloadUrl(topic, a)}
                          download={a.name}
                          on:click|stopPropagation
                        >{a.name}</a>
                        <span class="artifact-date">{fmtArtifactDate(a.mtime_iso)}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          {/if}
        </article>
      {/each}
    </section>
  {/if}
</div>

<style>
  .home {
    padding: 14px 16px max(20px, env(safe-area-inset-bottom));
    box-sizing: border-box;
    max-width: 100%;
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 14px;
  }

  h1 {
    margin: 0;
    font-size: 26px;
    line-height: 1.05;
  }

  .refresh-btn {
    width: 42px;
    height: 42px;
    border: 1px solid #2d2f3a;
    border-radius: 8px;
    background: #191b24;
    color: #f4f4f5;
    font-size: 20px;
  }

  .refresh-btn:disabled {
    color: #71717a;
  }

  .segmented {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    padding: 4px;
    border: 1px solid #2d2f3a;
    border-radius: 8px;
    background: #171922;
    position: sticky;
    top: max(8px, env(safe-area-inset-top));
    z-index: 2;
  }

  .install-card {
    display: grid;
    gap: 4px;
    margin-bottom: 12px;
    padding: 12px;
    border: 1px solid rgba(110, 231, 183, 0.34);
    border-radius: 8px;
    background: rgba(110, 231, 183, 0.09);
    color: #d1fae5;
    font-size: 13px;
  }

  .install-card span {
    color: #a7f3d0;
    line-height: 1.35;
  }

  .segmented button {
    border: 0;
    border-radius: 6px;
    padding: 9px 6px;
    background: transparent;
    color: #a1a1aa;
    font-size: 13px;
    font-weight: 650;
  }

  .segmented button.active {
    background: #f4f4f5;
    color: #111217;
  }

  .archive-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    color: #d4d4d8;
    font-size: 13px;
    font-weight: 650;
  }

  .archive-toggle input {
    width: 18px;
    height: 18px;
    accent-color: #71717a;
  }

  .archive-toggle strong {
    border-radius: 999px;
    background: #272a36;
    color: #a1a1aa;
    padding: 2px 7px;
    font-size: 11px;
  }

  .topic-list {
    display: grid;
    gap: 12px;
    margin-top: 14px;
  }

  .topic-card {
    border: 1px solid #2d2f3a;
    border-radius: 8px;
    background: rgba(25, 27, 36, 0.92);
    overflow: hidden;
    box-shadow: 0 12px 34px rgba(0, 0, 0, 0.22);
  }

  .card-summary {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 0;
    padding: 13px 12px;
    background: transparent;
    color: inherit;
    text-align: left;
  }

  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex: 0 0 auto;
  }

  .title-block {
    min-width: 0;
    flex: 1;
    display: grid;
    gap: 5px;
  }

  .topic-title {
    font-size: 18px;
    line-height: 1.2;
    overflow-wrap: anywhere;
    font-weight: 750;
  }

  .topic-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    color: #a1a1aa;
    font-size: 12px;
  }

  .privacy {
    border-radius: 999px;
    padding: 2px 7px;
    border: 1px solid transparent;
    font-weight: 700;
  }

  .privacy-personal {
    border-color: rgba(59, 130, 246, 0.45);
    background: rgba(59, 130, 246, 0.14);
    color: #bfdbfe;
  }

  .privacy-confidential {
    border-color: rgba(239, 68, 68, 0.48);
    background: rgba(239, 68, 68, 0.14);
    color: #fecaca;
  }

  .status-pill {
    border-radius: 999px;
    border: 1px solid transparent;
    padding: 2px 7px;
    font-weight: 700;
  }

  .status-active {
    border-color: rgba(34, 197, 94, 0.4);
    background: rgba(34, 197, 94, 0.12);
    color: #bbf7d0;
  }

  .status-await {
    border-color: rgba(245, 158, 11, 0.46);
    background: rgba(245, 158, 11, 0.13);
    color: #fde68a;
  }

  .status-idle {
    border-color: rgba(161, 161, 170, 0.4);
    background: rgba(161, 161, 170, 0.12);
    color: #d4d4d8;
  }

  .status-archived {
    border-color: rgba(113, 113, 122, 0.5);
    background: rgba(113, 113, 122, 0.16);
    color: #a1a1aa;
  }

  .chevron {
    color: #a1a1aa;
    font-size: 22px;
    line-height: 1;
    transition: transform 0.16s ease;
  }

  .card-summary.expanded .chevron {
    transform: rotate(180deg);
  }

  .card-details {
    padding: 0 14px 14px;
  }

  .contact-agent {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 3px 0 12px;
  }

  .contact-agent img,
  .agent-fallback {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid #3f4150;
    background: #242733;
    flex: 0 0 auto;
  }

  .contact-agent img {
    object-fit: cover;
  }

  .agent-fallback {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #d4d4d8;
    font-size: 12px;
    font-weight: 800;
  }

  .contact-agent > span:last-child {
    display: grid;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .contact-label {
    color: #a1a1aa;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .contact-agent strong {
    font-size: 14px;
    overflow-wrap: anywhere;
  }

  .chat-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border: 1px solid #3f4150;
    border-radius: 8px;
    background: #242733;
    text-decoration: none;
    font-size: 18px;
  }

  .tldr {
    border-top: 1px solid #2d2f3a;
    border-bottom: 1px solid #2d2f3a;
    padding: 11px 0;
    color: #e4e4e7;
  }

  .markdown :global(p) {
    margin: 0;
    line-height: 1.45;
  }

  .markdown :global(strong) {
    color: #ffffff;
  }

  .markdown :global(a) {
    color: #93c5fd;
  }

  .todos {
    margin-top: 11px;
  }

  .todos-title {
    color: #a1a1aa;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  ol {
    margin: 8px 0 0;
    padding-left: 21px;
  }

  li {
    margin: 7px 0;
    line-height: 1.38;
  }

  .todo-item :global(p) {
    display: inline;
  }

  .empty-todos {
    margin: 8px 0 0;
    color: #71717a;
    font-style: italic;
  }

  .artifacts {
    margin-top: 12px;
    padding-top: 11px;
    border-top: 1px solid #2d2f3a;
  }

  .artifacts-title {
    color: #a1a1aa;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .artifact-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .artifact-item {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }

  .artifact-icon {
    font-size: 15px;
    flex-shrink: 0;
  }

  .artifact-name {
    flex: 1;
    font-size: 13px;
    color: #93c5fd;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-decoration: none;
  }
  .artifact-name:hover {
    text-decoration: underline;
  }

  .artifact-date {
    flex-shrink: 0;
    font-size: 11px;
    color: #71717a;
  }

  .state {
    margin-top: 18px;
    border: 1px solid #2d2f3a;
    border-radius: 8px;
    background: #171922;
    padding: 18px;
    color: #d4d4d8;
  }

  .state.error {
    display: grid;
    gap: 6px;
    color: #fecaca;
    border-color: rgba(248, 113, 113, 0.45);
  }

  @media (min-width: 700px) {
    .home {
      max-width: 480px;
      margin: 0 auto;
    }
  }
</style>
