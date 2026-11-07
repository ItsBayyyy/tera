// No 0/O, 1/I/L, 5/S, 2/Z: codes are read aloud over the phone in noisy places.
export const CASE_CODE_ALPHABET = "34679ACDEFGHJKMNPQRTUVWXY";
const CODE_LENGTH = 6;

export function generateCaseCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CASE_CODE_ALPHABET[Math.floor(random() * CASE_CODE_ALPHABET.length)];
  }
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}
