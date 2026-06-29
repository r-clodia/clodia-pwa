<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { page } from '$app/stores';
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import { session, authHeaders } from '$lib/auth.js';
  import { getChannel, getChannelMessages, postChannelMessage, agentPfpUrl } from '$lib/api.js';

  const BASE = (import.meta.env.VITE_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

  marked.setOptions({ breaks: true, gfm: true });

  $: tier = $page.params.tier;
  $: name = $page.params.name;

  let info = null;
  let messages = [];
  let draft = '';
  let sending = false;
  let error = '';
  let loadedKey = '';
  let streamEl;
  let poll;
  let missing = {};

  // --- Ragionamento / attività live (SSE del turno del risponditore) -------
  // Il backend emette thinking_chunk / message_chunk / tool_use sul bus, con
  // chat_id = `chan:{tier}:{name}:{agent}`. Pannello "Ragionamento" comprimibile
  // (di default aperto): sui task lunghi mostra che l'agente sta lavorando.
  let liveThink = '';
  let liveReply = '';
  let liveTools = [];
  let thinkOpen = true;
  let typing = false;
  let typingTimer;
  $: hasLive = !!(liveThink || liveReply || liveTools.length);
  function resetLive() {
    liveThink = '';
    liveReply = '';
    liveTools = [];
  }
  function setTyping(on) {
    clearTimeout(typingTimer);
    typing = on;
    if (on) typingTimer = setTimeout(() => (typing = false), 90000);
    else resetLive();
  }

  let sseAbort = null;
  async function startSse() {
    sseAbort?.abort();
    const ctrl = new AbortController();
    sseAbort = ctrl;
    try {
      const r = await fetch(`${BASE}/clodia/events`, { headers: authHeaders(), signal: ctrl.signal });
      if (!r.ok || !r.body) return;
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          handleSse(buf.slice(0, idx));
          buf = buf.slice(idx + 2);
        }
      }
    } catch (_) {
      /* abort o rete: ignora (il polling resta il fallback) */
    }
  }
  function handleSse(chunk) {
    const data = chunk
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .join('\n');
    if (!data) return;
    let env;
    try {
      env = JSON.parse(data);
    } catch {
      return;
    }
    const p = env.payload || {};
    if (env.type === 'channel_typing') {
      if (p.tier === tier && p.name === name) setTyping(p.state === 'start');
      return;
    }
    if (typeof p.chat_id !== 'string' || !p.chat_id.startsWith(`chan:${tier}:${name}:`)) return;
    if (env.type === 'thinking_chunk') liveThink += String(p.delta ?? '');
    else if (env.type === 'message_chunk') {
      if (p.role === 'assistant') liveReply += String(p.delta ?? '');
    } else if (env.type === 'tool_use') {
      const inp = p.input_summary ? `: ${String(p.input_summary)}` : '';
      liveTools = [...liveTools, `🔧 ${String(p.tool ?? '')}${inp}`].slice(-8);
    }
  }

  function render(text) {
    // togli un eventuale marcatore choices invisibile + render markdown
    const clean = (text || '').replace(/<!--\s*choices(-multi)?\s*=.*?-->/gi, '').trim();
    return DOMPurify.sanitize(marked.parse(clean || ''));
  }
  function choices(text) {
    const m = (text || '').match(/<!--\s*choices(-multi)?\s*=(.*?)-->/i);
    return m ? m[2].split(/[,;|]/).map((s) => s.trim()).filter(Boolean) : [];
  }

  async function loadAll() {
    try {
      [info, messages] = await Promise.all([
        getChannel(tier, name).catch(() => null),
        getChannelMessages(tier, name)
      ]);
      error = '';
      await tick();
      scrollDown();
    } catch (e) {
      error = e?.message || String(e);
    }
  }
  async function refresh() {
    try {
      messages = await getChannelMessages(tier, name);
    } catch (_) {}
  }
  function scrollDown() {
    if (streamEl) streamEl.scrollTop = streamEl.scrollHeight;
  }

  async function send(text) {
    const body = (text ?? draft).trim();
    if (!body || sending) return;
    sending = true;
    draft = '';
    try {
      await postChannelMessage(tier, name, body);
      await refresh();
      await tick();
      scrollDown();
    } catch (e) {
      error = e?.message || String(e);
      draft = body;
    } finally {
      sending = false;
    }
  }

  $: title = info?.meta?.title || name;

  $: if (tier && name && `${tier}/${name}` !== loadedKey) {
    loadedKey = `${tier}/${name}`;
    typing = false;
    resetLive();
    loadAll();
  }

  onMount(() => {
    poll = setInterval(refresh, 4000);
    startSse();
  });
  onDestroy(() => {
    if (poll) clearInterval(poll);
    clearTimeout(typingTimer);
    sseAbort?.abort();
  });

  function fmtTs(ts) {
    try {
      return new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }
</script>

<svelte:head><title>{title} — Clodia</title></svelte:head>

<div class="ch">
  <header class="chhead">
    <a class="back" href="/agents">‹</a>
    <span class="title">{title}</span>
  </header>

  {#if error}<div class="err">{error}</div>{/if}

  <div class="stream" bind:this={streamEl}>
    {#each messages as m (m.id)}
      <div class="msg" class:mine={m.author === $session?.principal} class:ai={m.kind === 'ai'}>
        <div class="mhead">
          {#if !missing[m.author]}
            <img class="mava" src={agentPfpUrl(m.author)} alt="" on:error={() => (missing = { ...missing, [m.author]: true })} />
          {/if}
          <span class="mauthor">{m.author}</span>
          <span class="mts">{fmtTs(m.ts)}</span>
        </div>
        <div class="mbody">{@html render(m.text)}</div>
        {#if choices(m.text).length && m === messages[messages.length - 1]}
          <div class="pills">
            {#each choices(m.text) as c}
              <button class="pill" on:click={() => send(c)} disabled={sending}>{c}</button>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <p class="empty">Nessun messaggio. Scrivi qualcosa.</p>
    {/each}
  </div>

  {#if typing && !hasLive}
    <div class="typing">sta lavorando…</div>
  {/if}
  {#if hasLive}
    <div class="think" class:open={thinkOpen}>
      <button type="button" class="think-head" on:click={() => (thinkOpen = !thinkOpen)} aria-expanded={thinkOpen}>
        <span class="caret" class:open={thinkOpen}>▸</span>
        <span class="think-title">Ragionamento</span>
        {#if typing}<span class="think-live">● live</span>{/if}
        <span class="think-hint">{thinkOpen ? 'comprimi' : 'espandi'}</span>
      </button>
      {#if thinkOpen}
        <div class="think-body">
          {#if liveThink}<pre class="think-text">{liveThink}</pre>{/if}
          {#if liveTools.length}
            <ul class="think-tools">
              {#each liveTools as t}<li>{t}</li>{/each}
            </ul>
          {/if}
          {#if liveReply}<div class="think-reply mbody">{@html render(liveReply)}</div>{/if}
        </div>
      {/if}
    </div>
  {/if}

  <div class="composer">
    <textarea bind:value={draft} rows="1" placeholder="Messaggio…"
      on:keydown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}></textarea>
    <button class="snd" on:click={() => send()} disabled={sending || !draft.trim()}>{sending ? '…' : '➤'}</button>
  </div>
</div>

<style>
  .ch { display: flex; flex-direction: column; width: 100%; max-width: 100%; height: 100%; min-width: 0; min-height: 0; overflow-x: hidden; }
  .chhead { flex: 0 0 auto; min-width: 0; display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #1c2733; }
  .back { color: #ff6b3d; text-decoration: none; font-size: 26px; line-height: 1; }
  .title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; font-size: 16px; }
  .err { color: #e85d75; font-size: 12px; padding: 6px 12px; }
  .stream { flex: 1 1 auto; width: 100%; max-width: 100%; min-width: 0; min-height: 0; overflow-x: hidden; overflow-y: auto; -webkit-overflow-scrolling: touch; display: flex; flex-direction: column; gap: 10px; padding: 12px; }
  .msg { min-width: 0; max-width: 85%; overflow-wrap: anywhere; background: #131a22; border: 1px solid #243040; border-radius: 12px; padding: 8px 11px; align-self: flex-start; }
  .msg.mine { align-self: flex-end; background: #1a2530; }
  .msg.ai { border-color: rgba(255,107,61,.35); }
  .mhead { display: flex; align-items: center; gap: 6px; min-width: 0; margin-bottom: 2px; }
  .mava { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; }
  .mauthor { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; font-size: 12px; }
  .mts { font-size: 10px; color: #7b8a99; }
  .mbody { min-width: 0; max-width: 100%; overflow-wrap: anywhere; font-size: 14px; line-height: 1.45; }
  .mbody :global(p) { margin: 0 0 .4em; }
  .mbody :global(p:last-child) { margin-bottom: 0; }
  .mbody :global(code) { background: rgba(255,255,255,.08); padding: 0 4px; border-radius: 3px; }
  .mbody :global(pre) { max-width: 100%; background: #0b0f14; padding: 8px; border-radius: 6px; overflow-x: auto; }
  .mbody :global(a) { color: #6fb6ff; }
  .pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .pill { background: transparent; border: 1px solid rgba(255,107,61,.5); color: #e6edf3; font-size: 12px; padding: 5px 11px; border-radius: 999px; }
  .empty { color: #7b8a99; text-align: center; margin-top: 24px; font-size: 13px; }
  .typing { flex: 0 0 auto; padding: 4px 14px; font-size: 12px; color: #7b8a99; font-style: italic; }
  /* Pannello "Ragionamento" live (comprimibile, di default aperto) */
  .think { flex: 0 0 auto; min-width: 0; max-width: calc(100% - 20px); margin: 4px 10px 8px; border: 1px solid #243040; border-radius: 10px; background: rgba(19,26,34,.7); max-height: 40vh; overflow: auto; }
  .think-head { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; text-align: left; background: transparent; border: 0; color: #7b8a99; font: inherit; font-size: 11px; padding: 8px 11px; }
  .think-head .caret { transition: transform .15s ease; }
  .think-head .caret.open { transform: rotate(90deg); }
  .think-title { font-weight: 800; letter-spacing: .04em; text-transform: uppercase; font-size: 10px; }
  .think-live { color: #ff6b3d; font-weight: 800; font-size: 10px; }
  .think-hint { margin-left: auto; opacity: .7; font-size: 10px; }
  .think-body { min-width: 0; padding: 0 11px 11px; display: flex; flex-direction: column; gap: 8px; }
  .think-text { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, monospace; font-size: 11.5px; line-height: 1.5; color: #9fb0bf; }
  .think-tools { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; }
  .think-tools li { font-size: 11px; color: #9fb0bf; font-family: ui-monospace, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .think-reply { border-top: 1px solid #243040; padding-top: 8px; font-size: 13.5px; }
  .composer { flex: 0 0 auto; display: flex; gap: 8px; width: 100%; max-width: 100%; min-width: 0; padding: 8px 10px; border-top: 1px solid #1c2733; background: #0d131a; overflow-x: hidden; }
  .composer textarea { flex: 1 1 auto; width: 100%; min-width: 0; background: #0b0f14; border: 1px solid #243040; color: #e6edf3; border-radius: 18px; padding: 9px 12px; font: inherit; font-size: 14px; resize: none; max-height: 120px; }
  .snd { flex: 0 0 40px; background: #ff6b3d; border: none; color: #1a1208; font-weight: 700; width: 40px; border-radius: 50%; font-size: 16px; }
  .snd:disabled { opacity: .5; }
</style>
