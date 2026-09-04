// Filtra o GeoJSON oficial de bairros do IBGE (Censo 2022, estado de Alagoas)
// para conter apenas os bairros de Maceió, mantendo somente nome + geometria.
// Fonte: https://dados.al.gov.br/catalogo/dataset/bairros-de-alagoas
//
// Uso: node scripts/build-bairros-geojson.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SOURCE = join(ROOT, 'research', 'bairros_al.geojson');
const OUTPUT_DIR = join(ROOT, 'public', 'data');
const OUTPUT = join(OUTPUT_DIR, 'bairros-maceio.geojson');
const MUNICIPIO = 'Maceió';

function main() {
  const raw = readFileSync(SOURCE, 'utf-8');
  const data = JSON.parse(raw);

  const features = data.features
    .filter(f => f.properties.NM_MUN === MUNICIPIO)
    .map(f => ({
      type: 'Feature',
      properties: { bairro: f.properties.NM_BAIRRO },
      geometry: f.geometry
    }));

  if (features.length === 0) {
    throw new Error(`Nenhum bairro encontrado para o município "${MUNICIPIO}". Verifique o arquivo de origem.`);
  }

  const output = { type: 'FeatureCollection', features };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(output));

  const sizeKb = (Buffer.byteLength(JSON.stringify(output)) / 1024).toFixed(0);
  console.log(`OK: ${features.length} bairros de ${MUNICIPIO} escritos em ${OUTPUT} (~${sizeKb} KB)`);
}

main();
