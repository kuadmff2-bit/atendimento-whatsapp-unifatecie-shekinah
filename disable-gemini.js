// Fail-safe operacional: enquanto a integração Gemini não for validada em produção,
// o Light ignora GEMINI_API_KEY e usa o GPT-OSS 120B pela Groq.
// Isso evita atrasos/falhas totais caso a chamada Gemini esteja indisponível ou incompatível.
if (process.env.GEMINI_API_KEY) {
  process.env.GEMINI_API_KEY = "";
  console.warn("🛟 Fail-safe ativo: Gemini temporariamente desativado; usando Groq GPT-OSS 120B.");
}
