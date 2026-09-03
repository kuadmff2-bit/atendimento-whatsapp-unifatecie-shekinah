# Atendimento WhatsApp — UniFatecie e Shekinah

Chatbot de atendimento para um único número de WhatsApp. O cliente escolhe entre **UniFatecie** e **Centro Educacional Shekinah** e pode acessar:

- cursos e valores;
- solicitação de matrícula;
- financeiro e mensalidades;
- atendimento humano.

## Requisitos

- Node.js 18 ou mais recente;
- WhatsApp instalado no celular;
- computador conectado à internet enquanto o robô estiver funcionando.

## Instalação no Windows

Abra o terminal na pasta em que deseja guardar o projeto e execute:

```bash
git clone https://github.com/kuadmff2-bit/atendimento-whatsapp-unifatecie-shekinah.git
cd atendimento-whatsapp-unifatecie-shekinah
npm install
npm start
```

Na primeira execução, um QR Code aparecerá no terminal. No celular, abra o WhatsApp, entre em **Aparelhos conectados**, toque em **Conectar aparelho** e leia o QR Code.

## Iniciar novamente

Nas próximas vezes, entre na pasta do projeto e execute:

```bash
npm start
```

Para desligar o robô, pressione `Ctrl + C` no terminal.

## Erro de tempo esgotado ao abrir o navegador

O projeto detecta automaticamente o Google Chrome ou o Microsoft Edge instalado no Windows e aguarda até dois minutos pela inicialização. Isso melhora a compatibilidade com computadores Windows ARM64.

Se ainda aparecer `Timed out while waiting for the WS endpoint`:

1. feche completamente o Chrome e o Edge;
2. abra o Gerenciador de Tarefas e encerre processos restantes desses navegadores;
3. execute `npm install` novamente;
4. inicie com `npm start`.

Se o navegador estiver instalado em outro lugar, informe o caminho antes de iniciar:

```powershell
$env:CHROME_PATH="C:\caminho\para\chrome.exe"
npm start
```

## Receber atualizações

Quando houver uma alteração publicada, execute:

```bash
git pull
npm install
npm start
```

O `npm install` garante que qualquer dependência nova seja instalada.

## Comandos do cliente

- `oi`, `olá`, `bom dia`, `boa tarde` ou `boa noite`: inicia o atendimento;
- `menu`: interrompe o fluxo atual e volta ao começo;
- opções numéricas: navegam pelos menus.

Quando o cliente pede um atendente, o robô para de responder naquela conversa. Para voltar ao atendimento automático, o cliente pode digitar `menu`.

## Alterar informações

Os nomes, cursos e valores ficam no objeto `CONFIG`, no começo do arquivo `index.js`. Não é necessário alterar o restante da lógica.

## Segurança

As pastas `.wwebjs_auth` e `.wwebjs_cache` guardam dados locais da sessão e estão bloqueadas pelo `.gitignore`. Nunca envie essas pastas para o GitHub ou para outras pessoas.

Este projeto utiliza automação do WhatsApp Web por uma biblioteca não oficial. A Meta pode desconectar a sessão ou limitar contas que façam automações abusivas. Evite mensagens em massa e spam.
