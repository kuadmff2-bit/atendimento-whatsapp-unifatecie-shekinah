# ⚠️ Segurança Chromium — Railway Deployment

## Problema Identificado

**Sintomas**: Mensagens recebidas não disparam `onMessage`/`onAnyMessage` mesmo com CONNECTED. Logs mostram "autenticado" mas há timeout em `Runtime.callFunctionOn`.

**Causa Raiz**: Operações que precisam de resposta do Chromium (I/O síncrono) podem travar indefinidamente no Railway, bloqueando **TODOS** os eventos futuros.

### Operações que Causam Deadlock

```javascript
// ❌ PERIGOSAS — causam Runtime.callFunctionOn timeout
client.getConnectionState()          // Lê estado da página
client.getAllUnreadMessages()         // Varredura na página
client.getHostDevice()                // Query ao DOM
client.getChats()                     // Query ao DOM
client.getContact(id)                 // Query ao DOM
```

Quando uma dessas travam, **nenhum evento novo pode ser disparado** até a operação terminar (ou dar timeout).

---

## Solução Aplicada (2026-09-06)

### 1. **connection-state-guard.js** (CORRIGIDO)

**Antes**: Watchdog chamava `client.getConnectionState()` a cada 5s → **causava deadlock**

**Depois**: Watchdog agora:
- Registra apenas mudanças de **onStateChange** (evento, não I/O)
- Usa heartbeat simples sem tocar Chromium
- Log de status apenas se sem eventos por 30s

```javascript
// ✅ Seguro: apenas eventos, sem I/O
client.onStateChange((state) => {
  console.log("🔄 onStateChange event: " + String(state));
  estadoRelatadoLight = String(state || "UNKNOWN");
});
```

### 2. **message-event-fallback.js** (VERIFICADO + MELHORADO)

**Antes**: Tinha `getHostDevice()` em paralelo (não-bloqueante, mas pode congestionar)

**Depois**: Removido `getHostDevice()` — apenas listeners:
- `client.onMessage()` — principal
- `client.onAnyMessage()` — fallback

Sem polling, sem I/O Chromium.

### 3. **chromium-no-blocking-io.js** (NOVO)

Guard global que documenta e bloqueia operações perigosas se usadas no futuro.

---

## Recomendações de Uso

### ✅ Operações Seguras

```javascript
// Eventos (use esses)
client.onMessage((msg) => { /* ... */ });
client.onAnyMessage((msg) => { /* ... */ });
client.onStateChange((state) => { /* ... */ });
client.onAck((msg) => { /* ... */ });

// Dados já em memória
msg.from, msg.body, msg.fromMe, msg.timestamp
sessao.dados, sessao.etapa, sessao.nome
```

### ❌ Operações que Causam Deadlock

```javascript
client.getConnectionState()   // ❌ NUNCA
client.getAllUnreadMessages() // ❌ NUNCA
client.getHostDevice()        // ❌ NUNCA
client.getChats()             // ❌ NUNCA (varredura na página)
```

### 🟡 Se Precisar de Dados Dinâmicos

**Problema**: "Preciso saber quais chats não-lidos, ou informações do dispositivo"

**Solução**:

1. **Cache com eventos**:
   ```javascript
   const chatNaoLidosCache = new Map();
   
   client.onMessage((msg) => {
     // Marca chat como tendo nova mensagem
     if (!msg.fromMe) {
       chatNaoLidosCache.set(msg.from, Date.now());
     }
   });
   ```

2. **Leitura do evento onStateChange**:
   ```javascript
   let ultimoStateChange = "UNKNOWN";
   client.onStateChange((state) => {
     ultimoStateChange = state;
   });
   ```

3. **API externa** (se necessário):
   - Cria rota HTTP que retorna dados em cache
   - Não toca Chromium do bot

---

## Testes Após Correção

✅ **Esperado agora** (15:18-15:20Z e depois):
- Mensagens chegam em <2s nos logs
- `onMessage` ou `onAnyMessage` dispara com conteúdo da mensagem
- Sem timeouts de `Runtime.callFunctionOn`
- Estado "CONNECTED" mantido estável

❌ **Se ainda não funcionar**:
1. Verificar se há outro arquivo chamando `getConnectionState()` ou `getAllUnreadMessages()`
2. Checar logs de "🔒 Guard de I/O bloqueante" — se aparecer, há operação restrita
3. Reiniciar deploy (mudança está em code)

---

## Checklist de Deploy

- [x] connection-state-guard.js — sem `getConnectionState()` loops
- [x] message-event-fallback.js — apenas `onMessage` + `onAnyMessage`
- [x] Nenhuma chamada a `getAllUnreadMessages()` no startup
- [x] Nenhuma chamada a `getHostDevice()` no crítico path
- [ ] Testar com mensagem real às 15:30Z
- [ ] Confirmar evento nos logs dentro de 2s
- [ ] Confirmar sem `Runtime.callFunctionOn timed out` por 5+ minutos

---

## Referências

- WPPConnect docs: https://github.com/wppconnect-team/wppconnect
- Railway Chromium: headless, shared resources
- Chromium devtools protocol: blocking I/O caution

