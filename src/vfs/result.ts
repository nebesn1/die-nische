import type { VfsError } from "./errors";
import type { VfsState } from "./types";

export type VfsResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly error: VfsError;
    };

export type VfsMutationResult<T> =
  | {
      readonly ok: true;
      readonly state: VfsState;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly state: VfsState;
      readonly error: VfsError;
    };

export function ok<T>(value: T): VfsResult<T> {
  return { ok: true, value };
}

export function fail<T = never>(error: VfsError): VfsResult<T> {
  return { ok: false, error };
}

export function mutationOk<T>(state: VfsState, value: T): VfsMutationResult<T> {
  return { ok: true, state, value };
}

export function mutationFail<T = never>(state: VfsState, error: VfsError): VfsMutationResult<T> {
  return { ok: false, state, error };
}
