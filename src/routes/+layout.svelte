<script>
  import { page } from '$app/stores';
  import { session, login, logout } from '$lib/auth.js';

  let recovery = '';
  let busy = false;
  let err = '';

  async function doLogin() {
    if (busy) return;
    busy = true;
    err = '';
    try {
      await login(recovery.trim());
      recovery = '';
    } catch (e) {
      err = e?.message || String(e);
    } finally {
      busy = false;
    }
  }

  $: path = $page.url.pathname;
  $: tab = path.startsWith('/agents') ? 'agents' : 'topics';
</script>

{#if !$session}
  <div class="login">
    <div class="login-card">
      <div class="brand"><span class="dot">●</span> Clodia</div>
      <p class="sub">Incolla la tua <strong>masterkey</strong> (recovery key) per accedere.</p>
      <textarea bind:value={recovery} rows="4" placeholder="masterkey (pkcs8 base64)" autocomplete="off"></textarea>
      {#if err}<div class="err">{err}</div>{/if}
      <button class="primary" on:click={doLogin} disabled={busy || !recovery.trim()}>
        {busy ? 'Accesso…' : 'Accedi'}
      </button>
    </div>
  </div>
{:else}
  <div class="shell">
    <header class="topbar">
      <span class="brand"><span class="dot">●</span> Clodia</span>
      <span class="me">{$session.principal}</span>
      <button class="logout" on:click={logout} aria-label="Esci">Esci</button>
    </header>

    <main class="content">
      <slot />
    </main>

    <nav class="tabbar">
      <a href="/" class:active={tab === 'topics'}>
        <span class="ico">#</span><span>Topics</span>
      </a>
      <a href="/agents" class:active={tab === 'agents'}>
        <span class="ico">☺</span><span>Agents</span>
      </a>
    </nav>
  </div>
{/if}

<style>
  :global(html, body) { margin: 0; height: 100%; background: #0b0f14; color: #e6edf3; font-family: -apple-system, system-ui, sans-serif; }
  :global(body) { overflow: hidden; }
  .login { min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: 20px; box-sizing: border-box; }
  .login-card { width: min(420px, 100%); background: #131a22; border: 1px solid #243040; border-radius: 14px; padding: 22px; display: flex; flex-direction: column; gap: 12px; }
  .brand { font-weight: 800; font-size: 18px; letter-spacing: .02em; }
  .brand .dot { color: #ff6b3d; }
  .sub { margin: 0; font-size: 13px; color: #9fb0c0; }
  textarea { background: #0b0f14; border: 1px solid #243040; color: #e6edf3; border-radius: 8px; padding: 10px; font: inherit; font-size: 13px; resize: none; }
  .err { color: #e85d75; font-size: 12px; }
  button.primary { background: #ff6b3d; border: none; color: #1a1208; font-weight: 700; padding: 11px; border-radius: 9px; font-size: 14px; }
  button.primary:disabled { opacity: .5; }

  .shell { height: 100vh; height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }
  .topbar { flex: 0 0 auto; display: flex; align-items: center; gap: 10px; padding: max(10px, env(safe-area-inset-top)) 14px 10px; background: #0d131a; border-bottom: 1px solid #1c2733; }
  .topbar .brand { font-size: 15px; }
  .me { margin-left: auto; font-size: 12px; color: #9fb0c0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 40vw; }
  .logout { flex: 0 0 auto; background: transparent; border: 1px solid #243040; color: #9fb0c0; font-size: 12px; padding: 4px 10px; border-radius: 999px; }
  .content { flex: 1 1 auto; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .tabbar { flex: 0 0 auto; display: flex; background: #0d131a; border-top: 1px solid #1c2733; padding-bottom: env(safe-area-inset-bottom); }
  .tabbar a { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 9px 0 11px; color: #7b8a99; text-decoration: none; font-size: 11px; font-weight: 600; }
  .tabbar a.active { color: #ff6b3d; }
  .tabbar .ico { font-size: 18px; line-height: 1; }
</style>
