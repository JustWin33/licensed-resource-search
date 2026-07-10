import { normalizeCloudDriveUrl, validatePublicHttpsUrl } from '@platform/cloud-drives';
import { createResourceSchema, type CreateResourceInput } from './resource-input';

const MAX_BYTES = 1024 * 1024;
const MAX_ROWS = 200;

export type ParsedImportRow = {
  rowNumber: number;
  payload?: CreateResourceInput;
  errorCode?: string;
  errorDetail?: string;
};

function parseCsv(content: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index]!;
    if (quoted) {
      if (character === '"' && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"' && field.length === 0) quoted = true;
    else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = '';
    } else field += character;
  }
  if (quoted) throw new Error('csv_unclosed_quote');
  row.push(field.replace(/\r$/, ''));
  if (row.some((value) => value.trim())) rows.push(row);
  const header = rows.shift()?.map((value) => value.trim().toLowerCase());
  if (!header?.length || new Set(header).size !== header.length)
    throw new Error('csv_header_invalid');
  return rows.map((values) =>
    Object.fromEntries(header.map((name, index) => [name, values[index]?.trim() ?? ''])),
  );
}

function parseMarkdown(content: string): Array<Record<string, string>> {
  const documents = content.split(/\n<!--\s*resource\s*-->\n/i);
  return documents.map((document) => {
    const match = document.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/);
    if (!match) throw new Error('markdown_frontmatter_required');
    const record: Record<string, string> = {};
    for (const line of match[1]!.split(/\r?\n/)) {
      if (!line.trim() || line.trimStart().startsWith('#')) continue;
      const separator = line.indexOf(':');
      if (separator <= 0) throw new Error('markdown_frontmatter_invalid');
      const key = line.slice(0, separator).trim().toLowerCase();
      const value = line
        .slice(separator + 1)
        .trim()
        .replace(/^(['"])(.*)\1$/, '$2');
      if (record[key] !== undefined) throw new Error('markdown_duplicate_key');
      record[key] = value;
    }
    if (!record.summary && match[2]?.trim()) record.summary = match[2].trim();
    return record;
  });
}

function optional(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

function asBoolean(value: string | undefined): boolean {
  return ['1', 'true', 'yes', '是'].includes(value?.trim().toLowerCase() ?? '');
}

function mapRecord(record: Record<string, string>): unknown {
  return {
    title: record.title,
    summary: record.summary,
    ownerType: optional(record.owner_type) ?? 'authorized_submitter',
    rightsStatus: record.rights_status,
    categoryIds: [],
    tagIds: [],
    source: {
      url: record.source_url,
      name: optional(record.source_name) ?? '导入来源',
      type: optional(record.source_type) ?? 'other',
    },
    authorization: {
      licenseName: optional(record.license_name),
      licenseVersion: optional(record.license_version),
      licenseUrl: optional(record.license_url),
      verificationBasis: record.verification_basis,
      allowsCommercialPromotion: asBoolean(record.allows_commercial_promotion),
      startsAt: optional(record.starts_at),
      endsAt: optional(record.ends_at),
    },
    link: {
      provider: record.provider,
      url: record.cloud_url,
      passcode: optional(record.passcode),
      isPrimary: true,
    },
  };
}

export function parseImport(format: 'csv' | 'markdown', content: string): ParsedImportRow[] {
  if (Buffer.byteLength(content, 'utf8') > MAX_BYTES) throw new Error('import_too_large');
  const records = format === 'csv' ? parseCsv(content) : parseMarkdown(content);
  if (records.length === 0) throw new Error('import_empty');
  if (records.length > MAX_ROWS) throw new Error('import_row_limit');
  return records.map((record, index) => {
    const result = createResourceSchema.safeParse(mapRecord(record));
    if (result.success) {
      try {
        const sourceValidation = validatePublicHttpsUrl(new URL(result.data.source.url));
        if (!sourceValidation.ok) throw new Error(sourceValidation.reason);
        if (result.data.link.provider === 'generic') {
          const linkValidation = validatePublicHttpsUrl(new URL(result.data.link.url));
          if (!linkValidation.ok) throw new Error(linkValidation.reason);
        } else {
          normalizeCloudDriveUrl(new URL(result.data.link.url), result.data.link.provider);
        }
        return { rowNumber: index + 1, payload: result.data };
      } catch (error) {
        return {
          rowNumber: index + 1,
          errorCode: 'url_validation_error',
          errorDetail: error instanceof Error ? error.message : 'invalid_url',
        };
      }
    }
    return {
      rowNumber: index + 1,
      errorCode: 'validation_error',
      errorDetail: result.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join('.')}:${issue.code}`)
        .join(','),
    };
  });
}
