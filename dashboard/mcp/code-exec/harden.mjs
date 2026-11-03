// Pré-carregado (--import) no processo do sandbox, antes do código do agente.
// O modelo de permissões do Node NÃO cobre estas duas coisas (achadas pela bateria de segurança, bench/security.js):
//   - node:sqlite abre/cria qualquer arquivo SQLite ignorando --allow-fs-*
//   - process.kill pode sinalizar qualquer processo do mesmo usuário (inclusive o servidor MCP)
// Esta camada é "melhor esforço" dentro do mesmo processo; a barreira forte é o namespace de PID/rede/montagem (sandbox.js).
import { registerHooks } from 'node:module';

const BLOCKED = new Set(['sqlite', 'node:sqlite']);
const deny = (what) => Object.assign(new Error(`${what} é bloqueado no sandbox`), { code: 'ERR_ACCESS_DENIED' });

registerHooks({
  resolve(specifier, context, next) {
    if (BLOCKED.has(specifier)) throw deny(`O módulo ${specifier}`);
    return next(specifier, context);
  },
});

const getBuiltin = process.getBuiltinModule;
Object.defineProperty(process, 'getBuiltinModule', { value: (id) => { if (BLOCKED.has(id)) throw deny(`O módulo ${id}`); return getBuiltin.call(process, id); }, writable: false, configurable: false });

for (const name of ['kill', '_kill']) {
  Object.defineProperty(process, name, { value: () => { throw deny('process.kill'); }, writable: false, configurable: false });
}
