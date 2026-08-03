import { formatUser } from '@fixture/shared';

export function renderUserBadge(name: string): string {
  return formatUser({ id: '0', name });
}
