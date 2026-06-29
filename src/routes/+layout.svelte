<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import { page } from '$app/stores';
  import { session, login, loginWithPairing, logout, restore } from '$lib/auth.js';

  let recovery = '';
  let remember = true;
  let pairing = '';
  let showMasterkey = false;
  let scanning = false;
  let video;
  let stream;
  let busy = false;
  let err = '';

  onMount(() => { restore(); });
  onDestroy(stopScan);

  async function doLogin() {
    if (busy) return;
    busy = true;
    err = '';
    try {
      await login(recovery.trim(), remember);
      recovery = '';
    } catch (e) {
      err = e?.message || String(e);
    } finally {
      busy = false;
    }
  }

  async function doPairing(value = pairing) {
    if (busy) return;
    busy = true;
    err = '';
    try {
      await loginWithPairing(value.trim());
      pairing = '';
      stopScan();
    } catch (e) {
      err = e?.message || String(e);
    } finally {
      busy = false;
    }
  }

  async function startScan() {
    err = '';
    if (!('BarcodeDetector' in window)) {
      err = 'Scanner QR non disponibile in questo browser. Incolla il pairing copiato dal web.';
      return;
    }
    try {
      scanning = true;
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      await tick();
      video.srcObject = stream;
      await video.play();
      const scan = async () => {
        if (!scanning) return;
        const codes = await detector.detect(video);
        const raw = codes?.[0]?.rawValue;
        if (raw) {
          pairing = raw;
          await doPairing(raw);
          return;
        }
        requestAnimationFrame(scan);
      };
      requestAnimationFrame(scan);
    } catch (e) {
      scanning = false;
      err = e?.message || 'Impossibile aprire la camera.';
    }
  }

  function stopScan() {
    scanning = false;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    if (video) video.srcObject = null;
  }

  $: path = $page.url.pathname;
  $: tab = path.startsWith('/agents') ? 'agents' : 'topics';
</script>

{#if !$session}
  <div class="login">
    <div class="login-card">
      <div class="brand"><span class="dot">●</span> Clodia</div>
      <p class="sub">Collega questa PWA dal web: Settings → Dispositivo PWA → Genera QR.</p>
      <div class="scan-box" class:active={scanning}>
        {#if scanning}
          <video bind:this={video} playsinline muted></video>
        {:else}
          <button class="scan-btn" on:click={startScan} disabled={busy}>Scansiona QR</button>
        {/if}
      </div>
      {#if scanning}
        <button class="secondary" on:click={stopScan}>Chiudi scanner</button>
      {/if}
      <textarea bind:value={pairing} rows="3" placeholder="oppure incolla il pairing copiato dal web" autocomplete="off"></textarea>
      <button class="primary" on:click={() => doPairing()} disabled={busy || !pairing.trim()}>
        {busy ? 'Collego…' : 'Collega dispositivo'}
      </button>
      <button class="link-btn" on:click={() => (showMasterkey = !showMasterkey)}>
        {showMasterkey ? 'Nascondi accesso masterkey' : 'Accesso con masterkey'}
      </button>
      {#if showMasterkey}
        <textarea bind:value={recovery} rows="4" placeholder="masterkey (pkcs8 base64)" autocomplete="off"></textarea>
        <label class="remember"><input type="checkbox" bind:checked={remember} /> Ricordami su questo dispositivo</label>
        <button class="primary muted-primary" on:click={doLogin} disabled={busy || !recovery.trim()}>
          {busy ? 'Accesso…' : 'Accedi con masterkey'}
        </button>
      {/if}
      {#if err}<div class="err">{err}</div>{/if}
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
  :global(*) { box-sizing: border-box; }
  :global(html, body) { margin: 0; width: 100%; max-width: 100%; height: 100%; overflow-x: hidden; background: #0b0f14; color: #e6edf3; font-family: -apple-system, system-ui, sans-serif; }
  :global(body) { overflow: hidden; }
  :global(input, textarea, select, button) { max-width: 100%; }
  :global(#svelte) { width: 100%; max-width: 100%; overflow-x: hidden; }
  .login { width: 100%; max-width: 100%; min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: 20px; overflow-x: hidden; }
  .login-card { width: min(420px, 100%); min-width: 0; background: #131a22; border: 1px solid #243040; border-radius: 14px; padding: 22px; display: flex; flex-direction: column; gap: 12px; }
  .brand { font-weight: 800; font-size: 18px; letter-spacing: .02em; }
  .brand .dot { color: #ff6b3d; }
  .sub { margin: 0; font-size: 13px; color: #9fb0c0; }
  textarea { width: 100%; min-width: 0; background: #0b0f14; border: 1px solid #243040; color: #e6edf3; border-radius: 8px; padding: 10px; font: inherit; font-size: 13px; resize: none; }
  .remember { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #9fb0c0; }
  .scan-box { width: 100%; aspect-ratio: 1; max-height: 320px; display: grid; place-items: center; border: 1px dashed #334155; border-radius: 8px; background: #0b0f14; overflow: hidden; }
  .scan-box.active { border-style: solid; }
  video { width: 100%; height: 100%; object-fit: cover; }
  .scan-btn, .secondary, .link-btn { background: transparent; border: 1px solid #243040; color: #e6edf3; border-radius: 8px; padding: 10px 12px; font: inherit; font-size: 13px; }
  .secondary { color: #9fb0c0; }
  .link-btn { border: 0; color: #9fb0c0; padding: 3px 0; text-align: left; }

  button.primary { background: #ff6b3d; border: none; color: #1a1208; font-weight: 700; padding: 11px; border-radius: 9px; font-size: 14px; }
  button.muted-primary { background: #243040; color: #e6edf3; }
  button.primary:disabled { opacity: .5; }

  .shell { width: 100%; max-width: 100%; height: 100vh; height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }
  .topbar { flex: 0 0 auto; min-width: 0; display: flex; align-items: center; gap: 10px; padding: max(10px, env(safe-area-inset-top)) 14px 10px; background: #0d131a; border-bottom: 1px solid #1c2733; }
  .topbar .brand { font-size: 15px; }
  .me { margin-left: auto; font-size: 12px; color: #9fb0c0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 40vw; }
  .logout { flex: 0 0 auto; background: transparent; border: 1px solid #243040; color: #9fb0c0; font-size: 12px; padding: 4px 10px; border-radius: 999px; }
  .content { flex: 1 1 auto; min-width: 0; min-height: 0; width: 100%; max-width: 100%; overflow-x: hidden; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .tabbar { flex: 0 0 auto; display: flex; background: #0d131a; border-top: 1px solid #1c2733; padding-bottom: env(safe-area-inset-bottom); }
  .tabbar a { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 9px 0 11px; color: #7b8a99; text-decoration: none; font-size: 11px; font-weight: 600; }
  .tabbar a.active { color: #ff6b3d; }
  .tabbar .ico { font-size: 18px; line-height: 1; }
</style>
