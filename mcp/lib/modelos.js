/**
 * modelos — el catálogo de proveedores y modelos de la casa.
 *
 * De dónde sale, y por qué así: el core monta el adaptador `llm-pi-ai` DORMIDO
 * (cero rutas) hasta que `settings.yaml` trae una sección `llm-pi-ai:`
 * (`dsh-base/cordis.patch.yml:100-108`). O sea: el catálogo de proveedores y
 * modelos del usuario ES ese documento. Leerlo aquí no duplica la lógica del
 * core — es leer la misma configuración que el core lee, igual que hace la web.
 *
 * Lo que este módulo NO hace: llamar a la red, adivinar modelos, ni inventarse
 * precios. Si un dato no está, se devuelve `null` y se dice.
 */
import { ajustesMcp, leerAjustes } from './casa.js';
import { estaEnElEntorno, faltaEnElEntorno } from './claves.js';

/** El id de la ruta nativa de DeepSeek en el core (medido en `dsh-sdk-jsonrpc-server/lib/index.js:118`). */
export const PROVEEDOR_NATIVO = 'deepseek-official';
/** Lo que la ruta nativa resuelve por defecto si el usuario no dice otra cosa. */
const CLAVE_NATIVA_POR_DEFECTO = 'DEEPSEEK_API_KEY';

/** Un objeto-mapa, o {}. */
function mapa(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? valor : {};
}

/** Número finito, o null. */
function numero(valor) {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

/** Texto no vacío, o null. */
function texto(valor) {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : null;
}

/**
 * El catálogo completo de la casa.
 * @param {string} casa - la casa de RATACODE.
 * @returns {{proveedores: object[], modelos: object[], porDefecto: {provider: string|null, model: string|null}, avisos: string[]}}
 */
export function catalogo(casa) {
  const { documento, error } = leerAjustes(casa);
  const ajustes = ajustesMcp(casa);
  const avisos = [];
  if (error !== null) avisos.push(error);
  avisos.push(...ajustes.avisos);

  const proveedores = [];
  const modelos = [];

  // ── las rutas que declara el usuario (llm-pi-ai.providers) ────────────────
  const piAi = mapa(documento['llm-pi-ai']);
  const declarados = mapa(piAi.providers);
  for (const [id, perfilBruto] of Object.entries(declarados)) {
    const perfil = mapa(perfilBruto);
    const apiKeyEnv = texto(perfil.apiKeyEnv);
    const esta = apiKeyEnv === null ? null : estaEnElEntorno(apiKeyEnv);
    proveedores.push({
      id,
      nombre: texto(perfil.displayName) ?? id,
      api: texto(perfil.api),
      base_url: texto(perfil.baseURL),
      credencial: apiKeyEnv,
      tiene_clave: esta === true,
      falta: esta === false ? faltaEnElEntorno(apiKeyEnv) : null,
      declarado_por_el_usuario: true,
    });
    const lista = Array.isArray(perfil.models) ? perfil.models : [];
    for (const modeloBruto of lista) {
      const modelo = mapa(modeloBruto);
      const modelId = texto(modelo.id);
      if (modelId === null) {
        avisos.push('el proveedor «' + id + '» tiene un modelo sin id; lo salto');
        continue;
      }
      modelos.push(fichaModelo({ casa, ajustes, provider: id, modelo, modelId, tieneClave: esta === true }));
    }
  }

  // ── la ruta nativa de DeepSeek (siempre montada en el core) ───────────────
  const nativo = mapa(documento['llm-deepseek']);
  const claveNativa = texto(nativo.apiKeyEnv) ?? CLAVE_NATIVA_POR_DEFECTO;
  const estaNativa = estaEnElEntorno(claveNativa);
  proveedores.push({
    id: PROVEEDOR_NATIVO,
    nombre: texto(nativo.displayName) ?? 'DeepSeek (nativo)',
    api: texto(nativo.api),
    base_url: texto(nativo.baseURL),
    credencial: claveNativa,
    tiene_clave: estaNativa,
    falta: estaNativa ? null : faltaEnElEntorno(claveNativa),
    declarado_por_el_usuario: Object.keys(nativo).length > 0,
  });
  const modelosNativos = Array.isArray(nativo.models) ? nativo.models : [];
  for (const modeloBruto of modelosNativos) {
    const modelo = mapa(modeloBruto);
    const modelId = texto(modelo.id);
    if (modelId === null) continue;
    modelos.push(fichaModelo({ casa, ajustes, provider: PROVEEDOR_NATIVO, modelo, modelId, tieneClave: estaNativa }));
  }

  // ── el modelo por defecto de la casa ─────────────────────────────────────
  const porDefectoBruto = mapa(documento['agent-default-model']);
  const providerDefecto = texto(porDefectoBruto.provider);
  const modelDefecto = texto(porDefectoBruto.model);
  if (providerDefecto !== null && modelDefecto !== null) {
    for (const ficha of modelos) {
      ficha.es_por_defecto = ficha.provider === providerDefecto && ficha.model_id === modelDefecto;
    }
  } else {
    avisos.push('la casa no tiene `agent-default-model`: habrá que decir proveedor y modelo en cada tarea');
  }

  return {
    proveedores,
    modelos,
    porDefecto: { provider: providerDefecto, model: modelDefecto },
    avisos,
  };
}

/** Una ficha de modelo, con lo que se sabe y con null en lo que no. */
function fichaModelo({ casa, ajustes, provider, modelo, modelId, tieneClave }) {
  const capacidades = Array.isArray(modelo.input) ? modelo.input.filter((m) => typeof m === 'string') : null;
  return {
    name: texto(modelo.name) ?? modelId,
    provider,
    model_id: modelId,
    contexto: numero(modelo.contextWindow),
    max_tokens: numero(modelo.maxTokens),
    capacidades,
    coste: precioDe(ajustes.precios, provider, modelId),
    estado: tieneClave ? 'disponible' : 'sin_clave',
    es_por_defecto: false,
    descripcion: texto(modelo.description),
  };
}

/**
 * El precio declarado a mano en `mcp.precios`, si el humano lo puso.
 * El core no trae precios de texto (medido: `dsh-llm` sólo tiene precios de
 * imagen), así que o está aquí o se devuelve null. No se inventa nada.
 * @param {object} precios - la sección `mcp.precios`.
 * @param {string} provider - ruta del proveedor.
 * @param {string} modelId - id del modelo.
 * @returns {object|null} el precio tal cual lo declaró el humano, o null.
 */
function precioDe(precios, provider, modelId) {
  const porProveedor = precios[provider];
  if (porProveedor === null || typeof porProveedor !== 'object') return null;
  const entrada = porProveedor[modelId];
  if (entrada === null || typeof entrada !== 'object') return null;
  return { ...entrada, moneda: typeof entrada.moneda === 'string' ? entrada.moneda : 'EUR', origen: 'mcp.precios' };
}

/**
 * La credencial que necesita una ruta, y si está en el entorno.
 * Sirve para PARAR ANTES de arrancar nada cuando falta la clave, en vez de
 * dejar que el motor falle nueve segundos después con un error más oscuro.
 * @param {string} casa - la casa de RATACODE.
 * @param {string} provider - la ruta del proveedor.
 * @returns {{nombre: string, esta: boolean}|null} null si la ruta no declara credencial (entonces no se bloquea: no podemos saberlo).
 */
export function credencialDeProveedor(casa, provider) {
  const { documento } = leerAjustes(casa);
  if (provider === PROVEEDOR_NATIVO) {
    const nativo = mapa(documento['llm-deepseek']);
    const nombre = texto(nativo.apiKeyEnv) ?? CLAVE_NATIVA_POR_DEFECTO;
    return { nombre, esta: estaEnElEntorno(nombre) };
  }
  const perfil = mapa(mapa(documento['llm-pi-ai']).providers)[provider];
  if (perfil === null || typeof perfil !== 'object') return null;
  const nombre = texto(mapa(perfil).apiKeyEnv);
  if (nombre === null) return null;
  return { nombre, esta: estaEnElEntorno(nombre) };
}

/**
 * La ruta que se usará si el cliente no dice nada, y si se puede usar.
 * Sin routing oculto: esto sólo lee el modelo por defecto de la casa.
 * @param {string} casa - la casa de RATACODE.
 * @param {string|undefined} provider - lo que pidió el cliente.
 * @param {string|undefined} model - lo que pidió el cliente.
 * @returns {{provider: string, model: string, origen: 'peticion'|'por_defecto'}}
 */
export function resolverRuta(casa, provider, model) {
  const pedidoProvider = texto(provider);
  const pedidoModel = texto(model);
  if (pedidoProvider !== null && pedidoModel !== null) {
    return { provider: pedidoProvider, model: pedidoModel, origen: 'peticion' };
  }
  const { porDefecto } = catalogo(casa);
  if (pedidoProvider !== null && pedidoModel === null) {
    if (porDefecto.provider === pedidoProvider && porDefecto.model !== null) {
      return { provider: pedidoProvider, model: porDefecto.model, origen: 'por_defecto' };
    }
    throw new Error('me diste el proveedor «' + pedidoProvider + '» pero no el modelo, y el modelo por defecto de la casa es de otra ruta. Dime el modelo (mira list_models).');
  }
  if (pedidoProvider === null && pedidoModel !== null) {
    if (porDefecto.model === pedidoModel && porDefecto.provider !== null) {
      return { provider: porDefecto.provider, model: pedidoModel, origen: 'por_defecto' };
    }
    throw new Error('me diste el modelo «' + pedidoModel + '» pero no el proveedor, y el modelo por defecto de la casa es otro. Dime el proveedor (mira list_models).');
  }
  if (porDefecto.provider === null || porDefecto.model === null) {
    throw new Error('no me has dicho proveedor ni modelo, y la casa no tiene `agent-default-model`. Dime los dos (mira list_models).');
  }
  return { provider: porDefecto.provider, model: porDefecto.model, origen: 'por_defecto' };
}
