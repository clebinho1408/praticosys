import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-ignore Frontend helper intentionally tested outside the scripts rootDir.
import { accreditedVehicles } from '../../artifacts/praticosys/src/lib/accreditedVehicles';
// @ts-ignore Frontend types.
import type { Instructor, Vehicle } from '../../artifacts/praticosys/src/types';

const vehicle = (id: string, type: Vehicle['type'], procuracao?: boolean, active = true): Vehicle => ({
  id, instructorId: 'fixture', type, plate: id, procuracao, active, brand: 'Teste', model: 'Teste',
});
const instructors: Instructor[] = [
  { id: 'jose', name: 'José da Silva', cpf: '', phone: '', plate: 'LEG0001', vehicles: [
    vehicle('ABC1D23', 'CAR', true), vehicle('MOT-1234', 'MOTO', true),
    vehicle('NOT0001', 'CAR', false), vehicle('OLD0001', 'MOTO'),
  ] },
  { id: 'ana', name: 'Ana Santos', cpf: '', phone: '', plate: '', vehicles: [vehicle('XYZ9A87', 'CAR', true, false)] },
  { id: 'no-vehicles', name: 'Sem veículos', cpf: '', phone: '', plate: 'LEG0002' },
  { id: 'unmarked', name: 'Sem credenciamento', cpf: '', phone: '', plate: '', vehicles: [vehicle('NON1234', 'CAR', false)] },
];

test('lists only marked cars and motorcycles with their own instructor and plate', () => {
  assert.deepEqual(accreditedVehicles(instructors).map(row => [row.name, row.plate]),
    [['Ana Santos', 'XYZ9A87'], ['José da Silva', 'ABC1D23'], ['José da Silva', 'MOT-1234']]);
});

test('name search ignores accents and letter case; plate search ignores separators', () => {
  assert.equal(accreditedVehicles(instructors, ' JOSE ').length, 2);
  assert.deepEqual(accreditedVehicles(instructors, '', ' mot1234 ').map(row => row.plate), ['MOT-1234']);
  assert.deepEqual(accreditedVehicles(instructors, '', 'abc-1d23').map(row => row.plate), ['ABC1D23']);
});

test('both filters combine, never revealing another unmarked plate or a legacy plate', () => {
  assert.equal(accreditedVehicles(instructors, 'ana', 'ABC').length, 0);
  assert.equal(accreditedVehicles(instructors, 'jose', 'NOT').length, 0);
  assert.equal(accreditedVehicles(instructors, '', 'LEG').length, 0);
  assert.equal(accreditedVehicles(instructors, 'jose', 'ABC').length, 1);
});

test('empty data and searches return safely without modifying the source', () => {
  const before = JSON.stringify(instructors);
  assert.deepEqual(accreditedVehicles([]), []);
  assert.deepEqual(accreditedVehicles(instructors, 'inexistente'), []);
  assert.equal(JSON.stringify(instructors), before);
});
