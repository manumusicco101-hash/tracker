import { describe, expect, it } from 'vitest';
import { expandOccurrences } from '../lib/occurrences';
import { createBackup, parseBackup, serializeBackup, summarizeBackup } from './backup';
import { OTHER_CATEGORY_ID } from './defaults';
import { createLocalRepositories, STORAGE_KEY } from './localRepositories';
import { migrate, SCHEMA_VERSION } from './migrations';
import { createInitialData } from './seed';
import { MemoryStore } from './storage';

const today = '2026-11-25';
const fresh = () => {
  const store = new MemoryStore();
  return { store, repos: createLocalRepositories(store, true, () => createInitialData(today, '2026-11-25T12:00:00.000Z')) };
};

describe('datos de ejemplo', () => {
  it('genera 15–20 gastos de los últimos 10 días con los casos pedidos', () => {
    const { expenses } = createInitialData(today);
    expect(expenses.length).toBeGreaterThanOrEqual(15);
    expect(expenses.length).toBeLessThanOrEqual(20);
    expect(expenses.every((e) => e.isSample)).toBe(true);
    expect(expenses.every((e) => e.date <= today && e.date >= '2026-11-15')).toBe(true);
    expect(expenses.filter((e) => e.currency !== 'ARS').length).toBeGreaterThanOrEqual(2);
    expect(expenses.filter((e) => e.kind === 'recurring')).toHaveLength(2);
    expect(expenses.filter((e) => e.kind === 'installments')).toHaveLength(2);
  });

  it('las ocurrencias de ejemplo se pueden calcular', () => {
    const data = createInitialData(today);
    expect(expandOccurrences(data.expenses, '2026-11-01', '2027-12-31', data.settings).length).toBeGreaterThan(18);
  });
});

describe('repositorios locales', () => {
  it('siembra en el primer uso y persiste en una sola clave', async () => {
    const { store, repos } = fresh();
    expect(await repos.expenses.list()).toHaveLength(18);
    const stored = JSON.parse(store.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('crea, actualiza, elimina y restaura', async () => {
    const { repos } = fresh();
    const created = await repos.expenses.create({
      kind: 'single',
      amountCents: 1000,
      currency: 'ARS',
      rateAtCreation: { ARS: 1, USD: 1450, EUR: 1700 },
      categoryId: 'ocio',
      paymentMethod: 'cash',
      date: today,
    });
    const updated = await repos.expenses.update(created.id, { ...created, kind: 'single', amountCents: 2000 });
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.amountCents).toBe(2000);
    const removed = await repos.expenses.remove(created.id);
    expect(removed?.id).toBe(created.id);
    await repos.expenses.restore(removed!);
    expect((await repos.expenses.list()).some((e) => e.id === created.id)).toBe(true);
  });

  it('"Borrar datos de ejemplo" elimina solo isSample', async () => {
    const { repos } = fresh();
    await repos.expenses.create({
      kind: 'single',
      amountCents: 1000,
      currency: 'ARS',
      rateAtCreation: { ARS: 1, USD: 1450, EUR: 1700 },
      categoryId: 'ocio',
      paymentMethod: 'cash',
      date: today,
    });
    expect(await repos.expenses.removeSamples()).toBe(18);
    expect(await repos.expenses.list()).toHaveLength(1);
  });

  it('eliminar una categoría exige reasignar sus gastos y "Otros" no se borra', async () => {
    const { repos } = fresh();
    await expect(repos.categories.remove('ocio')).rejects.toThrow();
    const moved = await repos.expenses.reassignCategory('ocio', OTHER_CATEGORY_ID);
    expect(moved).toBe(3);
    await repos.categories.remove('ocio');
    expect((await repos.categories.list()).some((c) => c.id === 'ocio')).toBe(false);
    await expect(repos.categories.remove(OTHER_CATEGORY_ID)).rejects.toThrow();
  });
});

describe('backup', () => {
  it('exporta e importa sin perder datos', async () => {
    const { repos } = fresh();
    const file = await repos.backup.exportAll();
    const parsed = parseBackup(serializeBackup(file));
    expect(parsed.data).toEqual(file.data);
    expect(summarizeBackup(parsed).expenses).toBe(18);
  });

  it('rechaza archivos inválidos o de una versión más nueva', () => {
    expect(() => parseBackup('no es json')).toThrow('JSON');
    expect(() => parseBackup('{"app":"otra"}')).toThrow('backup');
    const data = createInitialData(today);
    const { schemaVersion: _v, ...content } = data;
    const newer = { ...createBackup(content), schemaVersion: SCHEMA_VERSION + 1 };
    expect(() => parseBackup(JSON.stringify(newer))).toThrow('más nueva');
    const broken = createBackup(content);
    (broken.data.expenses[0] as { amountCents: unknown }).amountCents = 'mucho';
    expect(() => parseBackup(JSON.stringify(broken))).toThrow('amountCents');
  });

  it('repara gastos con categorías inexistentes', () => {
    const data = createInitialData(today);
    data.expenses[0].categoryId = 'no-existe';
    expect(migrate(data).expenses[0].categoryId).toBe(OTHER_CATEGORY_ID);
  });
});

describe('migración v1 → v2 (cotizaciones en vivo)', () => {
  /** Datos como los guardaba la v1: sin autoSource, sin quotes y sin openOnLaunch. */
  function makeV1Content() {
    const { schemaVersion: _v, ...content } = createInitialData(today);
    const v1 = JSON.parse(JSON.stringify(content)) as {
      settings: { rates: Array<Record<string, unknown>>; quotes?: unknown; quickAdd: Record<string, unknown> };
    };
    for (const rate of v1.settings.rates) delete rate.autoSource;
    delete v1.settings.quotes;
    delete v1.settings.quickAdd.openOnLaunch;
    v1.settings.rates.push({ id: 'mi-cotizacion', currency: 'USD', label: 'Mía', arsPerUnit: 1700, isDefault: false, updatedAt: '2026-11-01T12:00:00.000Z' });
    return v1;
  }

  it('las cotizaciones de fábrica pasan a seguirse en vivo y las propias quedan manuales', () => {
    const migrated = migrate({ ...makeV1Content(), schemaVersion: 1 });
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    const auto = migrated.settings.rates.filter((r) => r.autoSource).map((r) => [r.id, r.autoSource]);
    expect(auto.sort()).toEqual([
      ['eur-oficial', 'eur-oficial'],
      ['usd-mep', 'usd-mep'],
      ['usd-oficial', 'usd-oficial'],
      ['usd-tarjeta', 'usd-tarjeta'],
    ]);
    expect(migrated.settings.rates.find((r) => r.id === 'mi-cotizacion')?.autoSource).toBeNull();
    expect(migrated.settings.quotes).toEqual({ autoUpdate: true, lastSyncAt: null, provider: null });
    expect(migrated.settings.quickAdd.openOnLaunch).toBe(false);
  });

  it('un backup exportado con la v1 se puede importar', () => {
    const backup = { app: 'gastos-tracker', schemaVersion: 1, exportedAt: '2026-11-25T12:00:00.000Z', data: makeV1Content() };
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.data.settings.quotes.autoUpdate).toBe(true);
    expect(parsed.data.settings.rates.find((r) => r.id === 'usd-oficial')?.autoSource).toBe('usd-oficial');
    expect(summarizeBackup(parsed).expenses).toBe(18);
  });

  it('datos ya en v2 con una fuente inválida o de otra moneda la dejan manual', () => {
    const { schemaVersion: _v, ...content } = createInitialData(today);
    const broken = JSON.parse(JSON.stringify(content)) as { settings: { rates: Array<Record<string, unknown>> } };
    broken.settings.rates[0].autoSource = 'eur-oficial'; // usd-oficial con fuente de euro
    broken.settings.rates[1].autoSource = 'no-existe';
    const migrated = migrate({ ...broken, schemaVersion: SCHEMA_VERSION });
    expect(migrated.settings.rates[0].autoSource).toBeNull();
    expect(migrated.settings.rates[1].autoSource).toBeNull();
    expect(migrated.settings.rates[2].autoSource).toBe('usd-tarjeta');
  });

  it('los ajustes de cotización y de carga rápida sobreviven a un guardado y una lectura', async () => {
    const { repos } = fresh();
    await repos.settings.update({
      quotes: { autoUpdate: false, lastSyncAt: '2026-11-25T15:00:00.000Z', provider: 'bluelytics' },
      quickAdd: { lastCategoryId: 'ocio', lastPaymentMethod: 'credit', openOnLaunch: true },
    });
    const file = await repos.backup.exportAll();
    const roundTrip = parseBackup(serializeBackup(file));
    expect(roundTrip.data.settings.quotes).toEqual({ autoUpdate: false, lastSyncAt: '2026-11-25T15:00:00.000Z', provider: 'bluelytics' });
    expect(roundTrip.data.settings.quickAdd.openOnLaunch).toBe(true);
  });
});
