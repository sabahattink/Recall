import { UsersService } from './users.service';

describe('UsersService', () => {
  it('returns a user by id', () => {
    const service = new UsersService();
    expect(service.findOne('1')).toEqual({ id: '1', name: 'Ada Lovelace' });
  });
});
