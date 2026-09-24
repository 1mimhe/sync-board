import { parseMentionedEmails } from '../mention-parser.util';

describe('mention-parser.util', () => {
  it('should extract unique lowercase emails', () => {
    const result = parseMentionedEmails(
      'Hi @User@Example.COM and @user@example.com plus @other@test.org',
    );
    expect(result).toEqual(['user@example.com', 'other@test.org']);
  });

  it('should return empty array when no mentions', () => {
    expect(parseMentionedEmails('no emails here')).toEqual([]);
  });
});
