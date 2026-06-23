<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { page } from '$app/stores';
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import { session } from '$lib/auth.js';
  import { getChannel, getChannelMessages, postChannelMessage, agentPfpUrl } from '$lib/api.js';

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
    loadAll();
  }

  onMount(() => {
    poll = setInterval(refresh, 4000);
  });
  onDestroy(() => poll && clearInterval(poll));

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

  <div class="composer">
    <textarea bind:value={draft} rows="1" placeholder="Messaggio…"
      on:keydown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}></textarea>
    <button class="snd" on:click={() => send()} disabled={sending || !draft.trim()}>{sending ? '…' : '➤'}</button>
  </div>
</div>

<style>
  .ch { display: flex; flex-direction: column; height: 100%; min-height: 0; }
  .chhead { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #1c2733; }
  .back { color: #ff6b3d; text-decoration: none; font-size: 26px; line-height: 1; }
  .title { font-weight: 700; font-size: 16px; }
  .err { color: #e85d75; font-size: 12px; padding: 6px 12px; }
  .stream { flex: 1 1 auto; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; display: flex; flex-direction: column; gap: 10px; padding: 12px; }
  .msg { max-width: 85%; background: #131a22; border: 1px solid #243040; border-radius: 12px; padding: 8px 11px; align-self: flex-start; }
  .msg.mine { align-self: flex-end; background: #1a2530; }
  .msg.ai { border-color: rgba(255,107,61,.35); }
  .mhead { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
  .mava { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; }
  .mauthor { font-weight: 700; font-size: 12px; }
  .mts { font-size: 10px; color: #7b8a99; }
  .mbody { font-size: 14px; line-height: 1.45; }
  .mbody :global(p) { margin: 0 0 .4em; }
  .mbody :global(p:last-child) { margin-bottom: 0; }
  .mbody :global(code) { background: rgba(255,255,255,.08); padding: 0 4px; border-radius: 3px; }
  .mbody :global(pre) { background: #0b0f14; padding: 8px; border-radius: 6px; overflow-x: auto; }
  .mbody :global(a) { color: #6fb6ff; }
  .pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .pill { background: transparent; border: 1px solid rgba(255,107,61,.5); color: #e6edf3; font-size: 12px; padding: 5px 11px; border-radius: 999px; }
  .empty { color: #7b8a99; text-align: center; margin-top: 24px; font-size: 13px; }
  .composer { flex: 0 0 auto; display: flex; gap: 8px; padding: 8px 10px; border-top: 1px solid #1c2733; background: #0d131a; }
  .composer textarea { flex: 1 1 auto; background: #0b0f14; border: 1px solid #243040; color: #e6edf3; border-radius: 18px; padding: 9px 12px; font: inherit; font-size: 14px; resize: none; max-height: 120px; }
  .snd { background: #ff6b3d; border: none; color: #1a1208; font-weight: 700; width: 40px; border-radius: 50%; font-size: 16px; }
  .snd:disabled { opacity: .5; }
</style>
