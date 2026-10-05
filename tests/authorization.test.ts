import { describe, expect, it, vi } from 'vitest';
import { BoardService } from '../server/src/services/boardService.js';

describe('board authorization', () => {
  it('denies users without the required board role', async () => {
    const repository = { hasAccess: vi.fn().mockResolvedValue(false) };
    const service = new BoardService(repository as never);
    await expect(service.undo('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')).rejects.toMatchObject({ statusCode: 403 });
    expect(repository.hasAccess).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'editor');
  });

  it('requires owner access for member changes', async () => {
    const repository = { hasRole: vi.fn().mockResolvedValue(false) };
    const service = new BoardService(repository as never);
    await expect(service.addMember('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'viewer')).rejects.toMatchObject({ statusCode: 403 });
  });
});