const secretPatterns = [/password\s*[:=]\s*.+/gi, /token\s*[:=]\s*.+/gi, /authorization\s*[:=]\s*.+/gi];

export function maskText(input: string): string {
  return secretPatterns.reduce((text, pattern) => text.replace(pattern, (match) => `${match.split(/[:=]/)[0]}: ***`), input);
}
