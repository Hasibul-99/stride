import 'vitest';

interface CustomMatchers<R = unknown> {
  toHaveNoViolations(): R;
}

/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
/* eslint-enable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
