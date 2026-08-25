import { plainToInstance } from 'class-transformer';
import { sanitizePlainText } from '../sanitize-text.util';
import { CreateCommentDto } from '../../../modules/board/dto/comment/create-comment.dto';
import { UpdateCommentDto } from '../../../modules/board/dto/comment/update-comment.dto';

describe('sanitizePlainText', () => {
  it('should strip script tags but keep their inner text', () => {
    expect(sanitizePlainText('<script>alert(1)</script>hello')).toBe(
      'alert(1)hello',
    );
  });

  it('should strip nested and mixed tags', () => {
    expect(
      sanitizePlainText('<div><b>bold</b> and <i>italic</i></div>'),
    ).toBe('bold and italic');
  });

  it('should strip tags that arrive via entity decoding', () => {
    expect(sanitizePlainText('&lt;img src=x onerror=alert(1)&gt;pwned')).toBe(
      'pwned',
    );
  });

  it('should preserve plain text with emoji', () => {
    expect(sanitizePlainText('Great job! 🎉 Ship it 🚀')).toBe(
      'Great job! 🎉 Ship it 🚀',
    );
  });

  it('should trim surrounding whitespace', () => {
    expect(sanitizePlainText('  hello world  ')).toBe('hello world');
  });

  it('should return empty string for input that is only markup', () => {
    expect(sanitizePlainText('<br/><hr />')).toBe('');
  });

  describe('comment DTO integration (tags stripped before reaching repositories)', () => {
    it('should sanitize content on CreateCommentDto transform', () => {
      const dto = plainToInstance(CreateCommentDto, {
        content: '<script>alert(1)</script>hello',
      });

      expect(dto.content).toBe('alert(1)hello');
    });

    it('should sanitize content on UpdateCommentDto transform (inherited)', () => {
      const dto = plainToInstance(UpdateCommentDto, {
        content: '  &lt;b&gt;bold&lt;/b&gt; text  ',
      });

      expect(dto.content).toBe('bold text');
    });
  });
});
