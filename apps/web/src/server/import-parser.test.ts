import { describe, expect, it } from 'vitest';
import { parseImport } from './import-parser';

const validCsv = `title,summary,rights_status,source_url,verification_basis,provider,cloud_url
Open Docs,"An openly licensed documentation package",open_licensed,https://example.com/docs,Published under an explicit open license,baidu,https://pan.baidu.com/s/abc`;

describe('import parser', () => {
  it('parses valid CSV into the resource command shape', () => {
    const rows = parseImport('csv', validCsv);
    expect(rows[0]?.payload?.title).toBe('Open Docs');
    expect(rows[0]?.payload?.link.provider).toBe('baidu');
  });

  it('reports row validation failures without exposing the row body', () => {
    const rows = parseImport(
      'csv',
      validCsv.replace('https://pan.baidu.com/s/abc', 'javascript:x'),
    );
    expect(rows[0]?.errorCode).toBe('url_validation_error');
    expect(rows[0]?.errorDetail).not.toContain('javascript:x');
  });

  it('rejects malformed quoted CSV and markup without frontmatter', () => {
    expect(() => parseImport('csv', 'title\n"unterminated')).toThrow('csv_unclosed_quote');
    expect(() => parseImport('markdown', '<script>alert(1)</script>')).toThrow(
      'markdown_frontmatter_required',
    );
  });
});
