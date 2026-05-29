export function makePickupCode(customerName: string): string {
  const clean = customerName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, 'X');
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${clean}-${num}`;
}
