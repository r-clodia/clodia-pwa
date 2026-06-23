# clodia-pwa — PWA mobile servita dal mini server Node (server.mjs).
# Stesso pattern di webui-v2: build SvelteKit (adapter-static → build/) e poi
# server.mjs serve gli statici + fa da proxy verso il backend (API_TARGET).
FROM node:18
WORKDIR /app

# Deps prima del codice per la cache dei layer.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Build same-origin: VITE_PUBLIC_API_BASE_URL non impostata → le chiamate sono
# relative e passano dal proxy di server.mjs (funziona via LAN e Tailscale).
RUN npm run build

# server.mjs legge PORT / API_TARGET / BUILD_DIR dall'ambiente.
ENV PORT=5173
ENV BUILD_DIR=build
EXPOSE 5173

CMD ["node", "server.mjs"]
