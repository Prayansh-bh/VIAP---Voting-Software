import { prisma } from '../lib/prisma.js';

async function main() {
  const mandals = await prisma.mandal.findMany({ select: { name: true, constituency: { select: { name: true, code: true } } } });
  console.log('Mandals grouped by constituency:');
  const grouped: Record<string, string[]> = {};
  for (const m of mandals) {
    const cName = m.constituency?.name || 'No Constituency';
    grouped[cName] = (grouped[cName] || []).concat(m.name);
  }
  console.log(JSON.stringify(grouped, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma['$disconnect']());
