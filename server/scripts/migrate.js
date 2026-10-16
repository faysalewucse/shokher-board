#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const schemaDir = path.join(rootDir, 'prisma/schema');
const bundledSchema = path.join(rootDir, 'schema.prisma');
const configFile = path.join(rootDir, 'prisma.config.ts');
const backupFile = path.join(rootDir, 'prisma.config.ts.bak');

console.log('🔄 Starting database migration...\n');

try {
  // Step 1: Bundle schema files
  console.log('📦 Bundling schema files...');
  const schemaFiles = fs.readdirSync(schemaDir).filter(f => f.endsWith('.prisma'));
  const bundledContent = schemaFiles.map(f => {
    const content = fs.readFileSync(path.join(schemaDir, f), 'utf8');
    return content;
  }).join('\n');

  fs.writeFileSync(bundledSchema, bundledContent);
  console.log('✅ Schema bundled successfully\n');

  // Step 2: Backup and disable prisma.config.ts
  if (fs.existsSync(configFile)) {
    console.log('🔧 Temporarily disabling prisma.config.ts...');
    fs.renameSync(configFile, backupFile);
    console.log('✅ Config file backed up\n');
  }

  // Step 3: Run prisma db push
  console.log('⚡ Pushing schema to database...');
  execSync('npx prisma db push --accept-data-loss', {
    cwd: rootDir,
    stdio: 'inherit'
  });
  console.log('\n✅ Database synced successfully\n');

  // Step 4: Restore prisma.config.ts
  if (fs.existsSync(backupFile)) {
    console.log('🔧 Restoring prisma.config.ts...');
    fs.renameSync(backupFile, configFile);
    console.log('✅ Config file restored\n');
  }

  // Step 5: Delete bundled schema
  console.log('🗑️  Cleaning up bundled schema...');
  fs.unlinkSync(bundledSchema);
  console.log('✅ Bundled schema deleted\n');

  console.log('🎉 Migration completed successfully!\n');

} catch (error) {
  console.error('\n❌ Migration failed:', error.message);

  // Cleanup on failure
  if (fs.existsSync(backupFile)) {
    console.log('🔧 Restoring config file...');
    fs.renameSync(backupFile, configFile);
  }

  if (fs.existsSync(bundledSchema)) {
    console.log('🗑️  Cleaning up bundled schema...');
    try {
      fs.unlinkSync(bundledSchema);
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  process.exit(1);
}
