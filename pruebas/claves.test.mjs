#!/usr/bin/env node
/**
 * PRUEBA DE LAS CLAVES FUERA DEL HIJO · parte de `npm test`.
 *
 * El motor (panel, headless y tareas del MCP) arranca SIN las variables de
 * claves: las de fábrica y las `apiKeyEnv` que declare la casa, se escriban
 * como se escriban (en Windows el entorno no distingue mayúsculas). Antes, el
 * CLI comparaba en mayúsculas pero guardaba el nombre de la casa tal cual: una
 * `apiKeyEnv: mi_clave` se colaba en el hijo.
 *
 * Uso: node pruebas/claves.test.mjs
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { entornoDelMotorSinClaves } from '../mcp/lib/claves.js';

let cuantas = 0;
const fallos = [];
function comprobar(condicion, queja) {
  cuantas += 1;
  if (!condicion) fallos.push(queja);
  process.stdout.write((condicion ? 'OK   ' : 'MAL  ') + '  ' + queja + '\n');
}

const casa = mkdtempSync(join(tmpdir(), 'ratacode-claves-'));
try {
  writeFileSync(join(casa, 'settings.yaml'), [
    'llm-pi-ai:',
    '  providers:',
    '    propio:',
    '      apiKeyEnv: mi_clave_propia',
    '    otro:',
    "      apiKeyEnv: 'OTRA_CLAVE'   # con comentario",
    '',
  ].join('\r\n'));

  const entorno = entornoDelMotorSinClaves(casa, {
    PATH: 'x',
    DSH_HOME: casa,
    openrouter_api_key: 'secreto-1',
    MI_CLAVE_PROPIA: 'secreto-2',
    mi_clave_propia: 'secreto-3',
    OTRA_CLAVE: 'secreto-4',
  });
  const valores = Object.values(entorno);

  comprobar(!valores.some((v) => String(v).startsWith('secreto-')), 'ninguna clave llega al hijo');
  comprobar(entorno.PATH === 'x' && entorno.DSH_HOME === casa, 'lo demás del entorno se conserva');
} finally {
  rmSync(casa, { recursive: true, force: true });
}

if (fallos.length > 0) {
  process.stdout.write('\nROJO · ' + fallos.length + ' de ' + cuantas + ' comprobaciones fallan.\n');
  process.exit(1);
}
process.stdout.write('\nVERDE · las claves no pasan al motor: ' + cuantas + ' comprobaciones.\n');
