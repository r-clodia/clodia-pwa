// Auth PKI by-signature per la PWA (porting del flusso clodia-web):
// l'utente incolla la masterkey (recovery, pkcs8 base64); il browser firma un
// session token ckt1; /clodia/whoami identifica il principal dalla firma.
import { writable } from 'svelte/store';

const BASE = (import.meta.env.VITE_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
const LS_KEY = 'clodia_session';
const PREFIX = 'ckt1';
const AUD = 'keystore';
const DEFAULT_TTL = 12 * 3600;

let _current = load();
export const session = writable(_current);

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.token || (s.exp && s.exp * 1000 < Date.now())) {
      localStorage.removeItem(LS_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function b64urlBytes(b) {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlStr(str) {
  return b64urlBytes(new TextEncoder().encode(str));
}
function extractKeyB64(text) {
  const INVIS = /[\s\u00A0\u200B\u200C\u200D\uFEFF]+/g;
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(INVIS, ''))
    .filter((l) => l && !l.startsWith('-----') && /^[A-Za-z0-9+/_=-]+$/.test(l));
  const joined = lines.join('');
  return joined || text.replace(INVIS, '').replace(/[^A-Za-z0-9+/_=-]/g, '');
}
function bytesFromB64(b64) {
  const clean = b64.trim().replace(/-/g, '+').replace(/_/g, '/');
  const pad = clean + '='.repeat((4 - (clean.length % 4)) % 4);
  const s = atob(pad);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

async function signToken(principal, recoveryB64, ttlSeconds = DEFAULT_TTL) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto non disponibile (serve https o localhost)');
  }
  const pkcs8 = bytesFromB64(extractKeyB64(recoveryB64));
  const key = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'Ed25519' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;
  const payload = { agent: principal, execution_id: '', iat: now, exp, aud: AUD };
  const body = b64urlStr(JSON.stringify(payload));
  const sig = await crypto.subtle.sign({ name: 'Ed25519' }, key, new TextEncoder().encode(body));
  return { token: `${PREFIX}.${body}.${b64urlBytes(sig)}`, exp };
}

async function whoami(token) {
  const res = await fetch(`${BASE}/clodia/whoami`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  if (res.status === 401) throw new Error('Chiave non riconosciuta: nessun profilo corrisponde.');
  if (!res.ok) throw new Error(`Login non riuscita (HTTP ${res.status})`);
  return res.json();
}

const LS_REMEMBER = 'clodia_remember'; // { principal, mk } se "ricordami" attivo

export async function login(recoveryB64, remember = false) {
  if (!recoveryB64.trim()) throw new Error('Incolla la tua masterkey (recovery key)');
  const probe = await signToken('', recoveryB64, 600);
  const { principal } = await whoami(probe.token);
  const { token, exp } = await signToken(principal, recoveryB64);
  _current = { principal, token, exp };
  localStorage.setItem(LS_KEY, JSON.stringify(_current));
  // "Ricordami su questo dispositivo": salva la masterkey per ri-firmare il token
  // alla scadenza senza richiederla. Resta in localStorage di questo browser.
  if (remember) localStorage.setItem(LS_REMEMBER, JSON.stringify({ principal, mk: recoveryB64 }));
  session.set(_current);
}

/** Al boot: se la sessione è scaduta/assente ma "ricordami" è attivo, ri-firma un
 *  token dalla masterkey salvata — così non viene richiesta a ogni apertura. */
export async function restore() {
  if (_current) return _current;
  let r;
  try { r = JSON.parse(localStorage.getItem(LS_REMEMBER) || 'null'); } catch { r = null; }
  if (!r?.mk || !r?.principal) return null;
  try {
    const { token, exp } = await signToken(r.principal, r.mk);
    _current = { principal: r.principal, token, exp };
    localStorage.setItem(LS_KEY, JSON.stringify(_current));
    session.set(_current);
    return _current;
  } catch {
    return null;
  }
}

export function logout() {
  _current = null;
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem(LS_REMEMBER);
  session.set(null);
}

/** Header Authorization se la sessione è valida, altrimenti {}. */
export function authHeaders() {
  const s = _current && _current.exp * 1000 > Date.now() ? _current : null;
  return s ? { Authorization: `Bearer ${s.token}` } : {};
}
