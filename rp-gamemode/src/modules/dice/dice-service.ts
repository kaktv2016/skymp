import { randomInt } from 'node:crypto';

export type DiceRng = (minInclusive: number, maxExclusive: number) => number;

/** Server-only dice; no chat, player state or shared random state. */
export class DiceService {
  constructor(private readonly rng: DiceRng = randomInt) {}

  roll(sides = 20): number {
    if (!Number.isInteger(sides) || sides < 2 || sides > 100) {
      throw new RangeError('Dice sides must be an integer from 2 to 100');
    }
    const result = this.rng(1, sides + 1);
    if (!Number.isInteger(result) || result < 1 || result > sides) {
      throw new RangeError('Dice RNG returned an invalid result');
    }
    return result;
  }
}
