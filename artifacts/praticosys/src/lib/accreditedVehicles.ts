import type { Instructor } from '../types';

const normalizedName = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
const normalizedPlate = (value: string) => value.replace(/[^a-z0-9]/gi, '').toUpperCase();

/** One row per accredited vehicle, never the instructor's unaccredited plates. */
export function accreditedVehicles(instructors: Instructor[], name = '', plate = '') {
  const nameQuery = normalizedName(name);
  const plateQuery = normalizedPlate(plate);
  return instructors.flatMap(instructor =>
    (instructor.vehicles ?? [])
      .filter(vehicle => vehicle.procuracao === true &&
        normalizedName(instructor.name).includes(nameQuery) &&
        normalizedPlate(vehicle.plate ?? '').includes(plateQuery))
      .map(vehicle => ({
        instructorId: instructor.id, vehicleId: vehicle.id,
        name: instructor.name, plate: vehicle.plate, type: vehicle.type,
      })),
  ).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.plate.localeCompare(b.plate));
}
