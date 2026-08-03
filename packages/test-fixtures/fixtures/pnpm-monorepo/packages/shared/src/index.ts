export interface User {
  id: string;
  name: string;
}

export function formatUser(user: User): string {
  return `${user.name} (${user.id})`;
}
