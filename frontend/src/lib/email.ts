/*
 * The email shape the client checks before sending (EP33). It is zod v4's
 * default email pattern, kept here so the browser does not ship a schema
 * library for one check; `email.test.ts` pins accepted and rejected shapes. The server
 * validates again — this only gives an early, localized message.
 */
const EMAIL =
  /^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

export const isEmail = (value: string) => EMAIL.test(value);
