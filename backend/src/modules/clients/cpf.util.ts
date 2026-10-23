export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

const dv = (digits: string, factor: number): number => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += parseInt(digits[i], 10) * factor--;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
};

export function validateCpf(cpf: string): boolean {
  const digits = normalizeCpf(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  const firstDv = dv(digits.slice(0, 9), 10);
  const secondDv = dv(digits.slice(0, 10), 11);
  return parseInt(digits[9], 10) === firstDv && parseInt(digits[10], 10) === secondDv;
}

export function maskCpf(cpf: string): string {
  const digits = normalizeCpf(cpf);
  if (digits.length !== 11) return cpf;
  return `***.***.${digits.slice(3, 6)}-**`;
}
