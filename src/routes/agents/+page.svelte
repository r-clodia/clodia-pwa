<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { listAgents, openDm, agentPfpUrl } from '$lib/api.js';

  let agents = [];
  let loading = true;
  let error = '';
  let opening = '';
  let missing = {};

  async function load() {
    loading = true;
    try {
      agents = await listAgents();
      error = '';
    } catch (e) {
      error = e?.message || String(e);
    } finally {
      loading = false;
    }
  }

  async function open(a) {
    if (opening) return;
    opening = a.name;
    try {
      const dm = await openDm(a.name);
      await goto(`/channel/${dm.tier}/${dm.name}`);
    } catch (e) {
      error = e?.message || String(e);
      opening = '';
    }
  }

  function initials(a) {
    const s = (a.display_name || a.name || '?').trim();
    return s.slice(0, 2).toUpperCase();
  }

  onMount(load);
</script>

<svelte:head><title>Agents — Clodia</title></svelte:head>

<div class="head">
  <h1>Agents</h1>
  <p class="hint">Tocca un agente per aprire un canale (DM).</p>
</div>

{#if loading}
  <p class="muted">Caricamento…</p>
{:else if error}
  <div class="err">{error}</div>
{:else if agents.length === 0}
  <p class="muted">Nessun agente.</p>
{:else}
  <ul class="list">
    {#each agents as a (a.name)}
      <li>
        <button class="row" on:click={() => open(a)} disabled={opening === a.name}>
          <span class="ava">
            {#if !missing[a.name]}
              <img src={agentPfpUrl(a.name)} alt="" on:error={() => (missing = { ...missing, [a.name]: true })} />
            {:else}
              <span class="ini" style="background:{a.avatar_color || '#888'}">{initials(a)}</span>
            {/if}
          </span>
          <span class="info">
            <span class="name">{a.display_name || a.name}
              {#if a.type === 'super'}<span class="tag super">super</span>
              {:else if a.type === 'human'}<span class="tag human">human</span>{/if}
            </span>
            {#if a.description}<span class="desc">{a.description}</span>{/if}
          </span>
          <span class="chev">{opening === a.name ? '…' : '›'}</span>
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .head { padding: 14px 16px 6px; }
  h1 { margin: 0; font-size: 22px; }
  .hint { margin: 4px 0 0; color: #9fb0c0; font-size: 12px; }
  .muted { color: #9fb0c0; font-size: 13px; padding: 16px; }
  .err { color: #e85d75; font-size: 12px; padding: 12px 16px; }
  .list { list-style: none; margin: 0; padding: 6px 10px; display: flex; flex-direction: column; gap: 6px; }
  .row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: #131a22; border: 1px solid #243040; border-radius: 12px; color: #e6edf3; text-align: left; }
  .row:disabled { opacity: .6; }
  .ava img, .ini { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; display: grid; place-items: center; }
  .ini { color: #fff; font-weight: 700; font-size: 14px; }
  .info { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; }
  .name { font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 7px; }
  .desc { font-size: 12px; color: #9fb0c0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tag { font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 1px 6px; border-radius: 999px; }
  .tag.super { background: rgba(255,107,61,.2); color: #ff6b3d; }
  .tag.human { background: rgba(96,165,250,.2); color: #60a5fa; }
  .chev { color: #7b8a99; font-size: 20px; }
</style>
