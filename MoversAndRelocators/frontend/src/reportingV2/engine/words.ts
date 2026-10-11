/** Amount in words for receipts ({{WORDS(amount, currency)}}). INR uses lakh/crore grouping, other currencies thousand/million. */
const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const belowThousand = (n: number): string => [n >= 100 ? `${ones[Math.floor(n / 100)]} hundred` : '', n % 100 < 20 ? ones[n % 100] : `${tens[Math.floor(n % 100 / 10)]}${n % 10 ? `-${ones[n % 10]}` : ''}`].filter(Boolean).join(' ');
const wordsBelow = (n: number, currency: string): string => n < 1000 ? belowThousand(n) : amountInWords(n, currency).replace(/ only$/, '').toLowerCase();

export function amountInWords(amount: number, currency: string): string {
  const whole = Math.floor(amount), cents = Math.round((amount - whole) * 100);
  const groups: [number, string][] = currency === 'INR' ? [[10_000_000, 'crore'], [100_000, 'lakh'], [1000, 'thousand']] : [[1_000_000_000, 'billion'], [1_000_000, 'million'], [1000, 'thousand']];
  let rest = whole; const parts: string[] = [];
  for (const [size, name] of groups) { if (rest >= size) { parts.push(`${wordsBelow(Math.floor(rest / size), currency)} ${name}`); rest %= size; } }
  if (rest) { parts.push(belowThousand(rest)); }
  const words = parts.length ? parts.join(' ') : 'zero';
  return `${words[0].toUpperCase()}${words.slice(1)}${cents ? ` and ${cents}/100` : ''} only`;
}
