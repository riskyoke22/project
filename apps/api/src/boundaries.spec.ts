import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { ESLint } from 'eslint';
import * as path from 'path';
import * as fs from 'fs';

describe('Modular Monolith ESLint Boundaries Enforcement', () => {
  const apiRoot = path.resolve(__dirname, '..');
  const iamTempFile = path.resolve(__dirname, 'modules/iam/temp-iam.ts');
  const hrTempFile = path.resolve(__dirname, 'modules/hr/temp-hr.ts');
  const commonTempFile = path.resolve(__dirname, 'common/temp-common.ts');

  beforeAll(() => {
    // 1. Buat file sumber di modul IAM
    fs.writeFileSync(iamTempFile, 'export const iamService = () => "iam";\n');

    // 2. Buat file pelanggaran di common/ (mengimpor dari modul)
    fs.writeFileSync(
      commonTempFile,
      'import { iamService } from "../modules/iam/temp-iam";\nexport const helper = () => iamService();\n',
    );

    // 3. Buat file pelanggaran lintas modul (HR mengimpor langsung IAM)
    fs.writeFileSync(
      hrTempFile,
      'import { iamService } from "../iam/temp-iam";\nexport const hr = () => iamService();\n',
    );
  });

  afterAll(() => {
    // Bersihkan file sementara setelah pengujian
    if (fs.existsSync(iamTempFile)) fs.unlinkSync(iamTempFile);
    if (fs.existsSync(hrTempFile)) fs.unlinkSync(hrTempFile);
    if (fs.existsSync(commonTempFile)) fs.unlinkSync(commonTempFile);
  });

  const eslint = new ESLint({
    cwd: apiRoot,
  });

  it('harus menggagalkan lint jika common/ mengimpor dari modules/', async () => {
    const results = await eslint.lintFiles([commonTempFile]);
    const messages = results[0]?.messages || [];
    const boundaryError = messages.find((m) => m.ruleId === 'boundaries/element-types');

    expect(boundaryError).toBeDefined();
    expect(boundaryError?.message).toContain(
      'Pelanggaran modular monolith: common/ dilarang mengimpor dari modules/.',
    );
  });

  it('harus menggagalkan lint jika sebuah modul mengimpor langsung modul lain', async () => {
    const results = await eslint.lintFiles([hrTempFile]);
    const messages = results[0]?.messages || [];
    const boundaryError = messages.find((m) => m.ruleId === 'boundaries/element-types');

    expect(boundaryError).toBeDefined();
    expect(boundaryError?.message).toContain(
      "Pelanggaran modular monolith: modul 'hr' dilarang mengimpor langsung dari modul 'iam'",
    );
  });
});
