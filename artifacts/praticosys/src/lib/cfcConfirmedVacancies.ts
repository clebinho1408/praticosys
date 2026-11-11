import { ExamType, RequestType, type Examiner, type ExamRequest } from '../types';

/** Fixed appointments show the current examiner's capacity, not the request's old quantities. */
export function confirmedVacancies(
  request: Pick<ExamRequest, 'requestType' | 'examinerId' | 'categoryQuantities' | 'examType' | 'intendedCategory' | 'schoolId'>,
  examiners: Examiner[],
): [string, number][] {
  if (request.requestType !== RequestType.FIXA) {
    return Object.entries(request.categoryQuantities ?? {});
  }
  const examiner = examiners.find(item => item.id === request.examinerId);
  if (!examiner) return [];
  const categories = request.intendedCategory?.split(',') ?? [];
  const firstLicense = request.examType !== ExamType.PCD &&
    !categories.some(category => ['C', 'D', 'E'].includes(category)) &&
    (categories.some(category => ['A', 'B'].includes(category)) || request.schoolId === 'CNH_BRASIL');
  const capacities: [string, number | null | undefined][] = [
    ['A', examiner.defaultMaxSlotsA],
    ['B', examiner.defaultMaxSlotsB],
    ['C/D/E', examiner.defaultMaxSlotsMudanca],
  ];
  // An explicit zero is a configured capacity; absent values are not invented.
  return capacities.filter((entry): entry is [string, number] =>
    entry[1] != null && (!firstLicense || entry[0] !== 'C/D/E'));
}
