/** State returned by the signup server action so client useActionState
 * can render validation errors inline without losing form state to a
 * redirect-and-reload round-trip.
 *
 * This file is intentionally NOT a "use server" file — Next.js forbids
 * non-async-function exports from server-action files at runtime, so
 * the const and the type live here and are imported by both the action
 * module and the client form. */
export type SignupState = {
  error: string | null;
  /** Optional field to attach the error to (so the form can scroll/
   * highlight the relevant input). */
  field: string | null;
};

export const INITIAL_SIGNUP_STATE: SignupState = { error: null, field: null };
