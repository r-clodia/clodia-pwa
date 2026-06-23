import { authHeaders } from '$lib/auth.js';

const BASE = (import.meta.env.VITE_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

function jhead() {
  return { 'Content-Type': 'application/json', ...authHeaders() };
}

export function agentPfpUrl(name) {
  return `${BASE}/api/agents/${encodeURIComponent(name)}/pfp`;
}

export function channelFileUrl(tier, name, path) {
  return `${BASE}/topics/${encodeURIComponent(tier)}/${encodeURIComponent(name)}/download?path=${encodeURIComponent(path)}`;
}

export async function listTopics() {
  const r = await fetch(`${BASE}/topics`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return await r.json();
}

export async function listAgents() {
  const r = await fetch(`${BASE}/api/agents`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await r.text());
  const d = await r.json();
  return Array.isArray(d?.agents) ? d.agents : [];
}

/** Crea/riapre un DM (canale a 2) con l'agent. Ritorna {tier, name}. */
export async function openDm(other) {
  const r = await fetch(`${BASE}/clodia/dms`, {
    method: 'POST',
    headers: jhead(),
    body: JSON.stringify({ with: other })
  });
  if (!r.ok) throw new Error(await r.text());
  return await r.json();
}

export async function getChannel(tier, name) {
  const r = await fetch(`${BASE}/clodia/channels/${encodeURIComponent(tier)}/${encodeURIComponent(name)}`, {
    headers: authHeaders()
  });
  if (!r.ok) throw new Error(await r.text());
  return await r.json();
}

export async function getChannelMessages(tier, name) {
  const r = await fetch(`${BASE}/clodia/channels/${encodeURIComponent(tier)}/${encodeURIComponent(name)}/messages`, {
    headers: authHeaders()
  });
  if (!r.ok) throw new Error(await r.text());
  const d = await r.json();
  return Array.isArray(d?.messages) ? d.messages : [];
}

export async function postChannelMessage(tier, name, content) {
  const r = await fetch(`${BASE}/clodia/channels/${encodeURIComponent(tier)}/${encodeURIComponent(name)}/post`, {
    method: 'POST',
    headers: jhead(),
    body: JSON.stringify({ content })
  });
  if (!r.ok) throw new Error(await r.text());
  return await r.json();
}
