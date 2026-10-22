declare const actorBrand: unique symbol;
declare const userBrand: unique symbol;
declare const profileBrand: unique symbol;
declare const formDescBrand: unique symbol;

export type ActorId = number & { readonly [actorBrand]: true };
export type UserId = number & { readonly [userBrand]: true };
export type ProfileId = number & { readonly [profileBrand]: true };
export type FormDesc = string & { readonly [formDescBrand]: true };

function integer(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new TypeError(`Invalid ${label}`);
  }
  return value;
}
export function actorId(value: unknown): ActorId { return integer(value, 1, 0xffffffff, 'ActorId') as ActorId; }
// NetworkingInterface uses unsigned short; 0xffff is the offline sentinel.
export function userId(value: unknown): UserId { return integer(value, 0, 0xfffe, 'UserId') as UserId; }
export function profileId(value: unknown): ProfileId { return integer(value, 0, 0x7fffffff, 'ProfileId') as ProfileId; }
export function formDesc(value: unknown): FormDesc {
  if (typeof value !== 'string' || value.length > 260 || !/^[0-9a-f]+(?::[^:\/\\\x00-\x1f]+\.(?:esm|esp|esl))?$/i.test(value)) {
    throw new TypeError('Invalid FormDesc');
  }
  return value as FormDesc;
}
