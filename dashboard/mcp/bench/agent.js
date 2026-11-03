'use strict';
/*
 * Agente de teste: um LLM real (llama-server local, API compatível com OpenAI) dirige um servidor MCP pelo cliente real.
 * O prompt de sistema é IDÊNTICO para os dois servidores: a única diferença é o conjunto de ferramentas que o MCP anuncia.
 *
 * Mede, por execução: tokens de entrada/saída REAIS (usage do llama-server, tokenizer do modelo), passos, chamadas de ferramenta,
 * bytes devolvidos ao contexto, pico de contexto e tempo.
 *   LLM_URL    padrão http://127.0.0.1:8080
 */
const LLM = process.env.LLM_URL || 'http://127.0.0.1:8080';

const SYSTEM = 'Você é um assistente de análise de dados financeiros. Use as ferramentas disponíveis para obter os dados e responda com precisão; '
  + 'não invente valores. Os valores monetários dos dados estão em bilhões de USD. Quando tiver a resposta, responda em português, de forma curta e direta, com os números pedidos.';

const toOpenAI = (tools) => tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } }));

async function chat(body, timeoutMs = 600000) {
  const res = await fetch(`${LLM}/v1/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'local', ...body }), signal: AbortSignal.timeout(timeoutMs) });
  const j = await res.json();
  if (!res.ok) throw Object.assign(new Error(j.error?.message || `HTTP ${res.status}`), { overflow: /context|exceed/i.test(j.error?.message || '') });
  return j;
}

// tokens que as definições de ferramentas ocupam no contexto, medidos pelo próprio servidor (com e sem ferramentas)
async function toolDefTokens(tools, opts) {
  const base = { messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: 'Olá' }], max_tokens: 1, temperature: 0, chat_template_kwargs: { enable_thinking: false }, ...opts };
  const [a, b] = await Promise.all([chat(base), chat({ ...base, tools: toOpenAI(tools) })]);
  return b.usage.prompt_tokens - a.usage.prompt_tokens;
}

async function runAgent(client, question, { maxSteps = 12, thinking = false, temperature = 0.6, maxTokens = 6000 } = {}) {
  const tools = toOpenAI(client.tools);
  const messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: question }];
  const steps = [];
  const t0 = performance.now();
  let answer = '', error = null;

  for (let i = 0; i < maxSteps; i++) {
    let r;
    const ts = performance.now();
    try {
      r = await chat({ messages, tools, tool_choice: 'auto', temperature, top_p: 0.95, max_tokens: maxTokens, chat_template_kwargs: { enable_thinking: thinking } });
    } catch (e) { error = e.overflow ? 'context_overflow' : `llm: ${e.message.slice(0, 120)}`; break; }
    const m = r.choices[0].message;
    const step = { promptTokens: r.usage.prompt_tokens, cachedTokens: r.usage.prompt_tokens_details?.cached_tokens || 0, completionTokens: r.usage.completion_tokens, llmMs: performance.now() - ts, calls: [],
      finish: r.choices[0].finish_reason, contentLen: (m.content || '').length, reasoningTail: (m.reasoning_content || '').slice(-400) };
    steps.push(step);
    if (r.choices[0].finish_reason === 'length') { error = 'max_tokens'; answer = m.content || ''; break; }

    if (!m.tool_calls?.length) { answer = (m.content || '').trim(); break; }
    messages.push({ role: 'assistant', content: m.content || '', tool_calls: m.tool_calls });
    for (const tc of m.tool_calls) {
      let args = {};
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* o servidor devolve o erro de validação */ }
      const res = await client.call(tc.function.name, args);
      step.calls.push({ name: tc.function.name, sentBytes: res.sentBytes, receivedBytes: res.receivedBytes, isError: res.isError, ms: res.ms, args: JSON.stringify(args).slice(0, 1500), result: res.text.slice(0, 400) });
      messages.push({ role: 'tool', tool_call_id: tc.id, content: res.text });
    }
    if (i === maxSteps - 1) error = 'max_steps';
  }

  const sum = (f) => steps.reduce((s, x) => s + f(x), 0);
  return {
    answer, error, steps: steps.length,
    toolCalls: sum((s) => s.calls.length), toolErrors: sum((s) => s.calls.filter((c) => c.isError).length),
    inputTokens: sum((s) => s.promptTokens), newInputTokens: sum((s) => s.promptTokens - s.cachedTokens), outputTokens: sum((s) => s.completionTokens),
    peakContext: Math.max(0, ...steps.map((s) => s.promptTokens)), toolResultBytes: sum((s) => s.calls.reduce((a, c) => a + c.receivedBytes, 0)),
    ms: Math.round(performance.now() - t0), trace: steps,
  };
}

module.exports = { runAgent, toolDefTokens, SYSTEM, LLM };
