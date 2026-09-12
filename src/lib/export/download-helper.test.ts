import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadJsonFile } from './download-helper';

describe('downloadJsonFile', () => {
  const createObjectURLMock = vi.fn();
  const revokeObjectURLMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLMock.mockReturnValue('blob:mock-url'),
      revokeObjectURL: revokeObjectURLMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates blob, triggers download anchor click, and revokes object URL', () => {
    const realAnchor = document.createElement('a');
    const clickSpy = vi.spyOn(realAnchor, 'click').mockImplementation(() => {});
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(realAnchor);

    const appendChildSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node) => node);

    downloadJsonFile('test-export.json', { hello: 'world' });

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
  });
});
