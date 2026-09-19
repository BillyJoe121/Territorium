const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

console.log(`Verificando ${files.length} migraciones en: ${migrationsDir}\n`);

let hasError = false;
const timestamps = new Set();
let prevTimestamp = '';

files.forEach((file, index) => {
  const match = file.match(/^(\d{14})_(.+)\.sql$/);
  if (!match) {
    console.error(`❌ [FORMATO INVÁLIDO] ${file}: El nombre no cumple con el formato YYYYMMDDHHMMSS_nombre.sql`);
    hasError = true;
    return;
  }

  const [_, timestamp, name] = match;

  if (timestamps.has(timestamp)) {
    console.error(`❌ [TIMESTAMP DUPLICADO] ${file}: El timestamp ${timestamp} ya existe.`);
    hasError = true;
  }
  timestamps.add(timestamp);

  if (prevTimestamp && timestamp <= prevTimestamp) {
    console.error(`❌ [ORDEN CRONOLÓGICO INVÁLIDO] ${file}: ${timestamp} no es posterior a ${prevTimestamp}`);
    hasError = true;
  }
  prevTimestamp = timestamp;

  const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  if (content.trim().length === 0) {
    console.error(`❌ [MIGRACIÓN VACÍA] ${file}`);
    hasError = true;
    return;
  }

  // Basic SQL sanity checks
  const ddlKeywords = ['create table', 'create or replace function', 'alter table', 'insert into', 'create index', 'create trigger'];
  const hasDdl = ddlKeywords.some(kw => content.toLowerCase().includes(kw));
  if (!hasDdl) {
    console.warn(`⚠️ [ADVERTENCIA] ${file}: No contiene sentencias DDL comunes.`);
  }

  console.log(`✅ [${index + 1}/${files.length}] ${timestamp} — ${name} (${(content.length / 1024).toFixed(1)} KB)`);
});

if (hasError) {
  console.error('\n❌ La verificación de migraciones falló.');
  process.exit(1);
} else {
  console.log(`\n🎉 Todas las ${files.length} migraciones son válidas, secuenciales y libres de colisiones.`);
  process.exit(0);
}
