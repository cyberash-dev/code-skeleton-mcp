/**
 * Sample TypeScript fixture for outline tests.
 */
import { readFile } from 'node:fs/promises';
import type { Buffer } from 'node:buffer';
import * as path from 'node:path';
import defaultExport, { helper as aliased } from './helpers.js';

export const MAX_RETRIES = 3;
const _internalFlag = true;

export type UserID = string;

export interface Greeter {
  greet(): string;
}

/** A user record. */
export class User implements Greeter {
  static total = 0;

  constructor(public readonly name: string) {}

  /** Return a greeting. */
  greet(): string {
    return `hi, ${this.name}`;
  }

  private _secret(): void {
    return;
  }
}

/** Top-level function. */
export function topLevel(x: number, y = 0): number {
  return x + y;
}

export const arrowAdd = (a: number, b: number): number => a + b;

function _internal(): void {
  return;
}
