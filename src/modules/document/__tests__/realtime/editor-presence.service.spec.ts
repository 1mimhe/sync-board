import { EditorPresenceService } from '../../realtime/editor-presence.service';
import { COLLABORATOR_COLORS } from '../../../board/realtime/ws-events.constants';
import type { EditorInfo } from '../../interfaces/document.interfaces';

const DOC = '00000000-0000-4000-8000-000000000001';

function info(userId: string, color: string): EditorInfo {
  return { userId, displayName: `User ${userId}`, avatarUrl: null, color };
}

describe('EditorPresenceService', () => {
  let service: EditorPresenceService;

  beforeEach(() => {
    service = new EditorPresenceService();
  });

  it('adds, lists and removes editors; clears the document map when empty', () => {
    service.addEditor(DOC, 'sock-1', info('u-1', '#E11D48'));
    service.addEditor(DOC, 'sock-2', info('u-2', '#2563EB'));

    expect(service.getEditors(DOC)).toHaveLength(2);

    const removed = service.removeEditor(DOC, 'sock-1');
    expect(removed).toEqual(info('u-1', '#E11D48'));
    expect(service.getEditors(DOC)).toHaveLength(1);

    service.removeEditor(DOC, 'sock-2');
    expect(service.getEditors(DOC)).toEqual([]);
  });

  it('returns null when removing from an unknown document or socket', () => {
    expect(service.removeEditor(DOC, 'sock-404')).toBeNull();
    service.addEditor(DOC, 'sock-1', info('u-1', '#E11D48'));
    expect(service.removeEditor(DOC, 'sock-404')).toBeNull();
  });

  it('getEditors returns an empty array for unknown documents', () => {
    expect(service.getEditors(DOC)).toEqual([]);
  });

  describe('assignColor', () => {
    it('assigns a palette color and reuses it for the same user', () => {
      const first = service.assignColor(DOC, 'u-1');
      expect(COLLABORATOR_COLORS).toContain(first as never);

      service.addEditor(DOC, 'sock-1', info('u-1', first));
      expect(service.assignColor(DOC, 'u-1')).toBe(first);
    });

    it('skips colors already taken by current editors', () => {
      const first = service.assignColor(DOC, 'u-1');
      service.addEditor(DOC, 'sock-1', info('u-1', first));
      const second = service.assignColor(DOC, 'u-2');

      expect(second).not.toBe(first);
      expect(COLLABORATOR_COLORS).toContain(second as never);
    });

    it('falls back to a golden-ratio HSL hue when the palette is exhausted', () => {
      COLLABORATOR_COLORS.forEach((color, i) => {
        service.addEditor(DOC, `sock-${i}`, info(`u-${i}`, color));
      });

      const fallback = service.assignColor(DOC, 'u-new');
      expect(fallback).toMatch(/^hsl\(\d+, 75%, 50%\)$/);
    });
  });
});
