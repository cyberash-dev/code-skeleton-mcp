/**
 * Sample JavaScript fixture.
 */
import { readFile } from 'node:fs/promises';
import defaultExport, { helper as aliased } from './helpers.js';
const node_path = require('node:path');

export const MAX_RETRIES = 3;

/** A user record. */
export class User {
  constructor(name) {
    this.name = name;
  }

  /** Return a greeting. */
  greet() {
    return `hi, ${this.name}`;
  }
}

/** Top-level function. */
export function topLevel(x, y = 0) {
  return x + y;
}

export const arrowAdd = (a, b) => a + b;
