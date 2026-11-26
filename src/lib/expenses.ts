import type { Expense } from '../types';

/** Quita id y timestamps para pasarle el registro madre al repositorio. */
export function toNewExpense<E extends Expense>(e: E): Omit<E, 'id' | 'createdAt' | 'updatedAt'> {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = e;
  return rest;
}

/** Título de un gasto: la nota, o el nombre de la categoría si no tiene. */
export function expenseTitle(note: string | undefined, categoryName: string): string {
  return note?.trim() || categoryName;
}
