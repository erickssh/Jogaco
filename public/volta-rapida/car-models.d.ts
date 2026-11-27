export const carModels: readonly { id: string; name: string; pixels: readonly [number, number] }[];
export const defaultModel: string;
export function isCarModel(value: unknown): value is string;
export function imageForModel(id: string, compact?: boolean): string;
export function sampleCarModels(count: number, excluded?: readonly string[]): string[];
export const maxLength: number;
export const maxWidth: number;
export function sizeForModel(id?: string): {
  width: number; length: number; halfWidth: number; halfLength: number;
  bumpers: readonly number[]; radius: number;
};
