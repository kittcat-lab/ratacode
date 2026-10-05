# Diseño: Taste Skill y Design Motion Principles
Verificado: 2026-10-05. Visto con mis ojos en la fuente: API de GitHub (api.github.com) y README en raw.githubusercontent.com. Acceso web: SÍ hubo.

## 1) Taste Skill
- URL: https://github.com/Leonxlnx/taste-skill
- Licencia: MIT (campo license de la API + enlace LICENSE del README).
- Tamaño: 36.833 KB según la API (~36 MB; la conversión a MB es mía — SOSPECHA leve).
- Último commit: ce26fc2 — 2026-09-26 09:01:50 UTC (merge PR #125, sponsors), rama main.
- Para qué: skills portables que dan "buen gusto" al agente y evitan UIs genéricas: layout, tipografía, motion; incluye también skills de generación de imágenes de referencia.
- Instalación (literal del README):
  `npx skills add https://github.com/Leonxlnx/taste-skill`
  `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"`
- Visto además: homepage tasteskill.dev; JavaScript; ~92.700 estrellas; para Claude Code, Cursor y Codex.

## 2) Design Motion Principles
- URL: https://github.com/kylezantos/design-motion-principles
- Licencia: MIT (API + sección License del README).
- Tamaño: 286 KB según la API.
- Último commit: 4a9ca87 — 2026-05-30 23:17:34 UTC ("docs: fix deprecated npx add-skill -> npx skills add in README"), rama main.
- Para qué: skill de motion design con dos modos: construir componentes con motion intencional o auditar animaciones existentes, ponderando tres "lentes" (Emil Kowalski, Jakub Krehel, Jhey Tompkins).
- Instalación (literal del README):
  `npx skills add kylezantos/design-motion-principles`
- Instalación manual (literal): clonar el repo y copiar skills/design-motion-principles a ~/.claude/skills/ (Cursor: ~/.cursor/skills/).
- Visto además: lenguaje HTML; ~1.200 estrellas; el propio README aclara que no está avalada por los diseñadores citados.

## Variantes encontradas (menos verificadas)
- LottieFiles/motion-design-skill: MIT, 34 KB, último push 2026-05-18; "principios de motion universales + principios Disney para agentes". Su README no lo abrí: orden de instalación = SOSPECHA.
- qzhansen/design-principles: fork sin licencia visible; descartado como fuente primaria.

## SOSPECHAS y límites
- No ejecuté ninguna instalación (prohibido por encargo): que los comandos funcionen hoy es SOSPECHA; certifico solo que son los que publican los README.
- "Último commit" = primer resultado de /repos/.../commits en la rama por defecto; no recorrí el histórico completo.
- Tamaño, estrellas y fechas son instantánea del día de la verificación; caducan.
- El README de taste-skill incluye bloques de patrocinio y enlaces de afiliado (Kimi, Fluxion...): ajenos a la instalación, los ignoré.
