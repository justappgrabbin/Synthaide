import { parse } from '../vendor/acorn.mjs';

export function parseJavaScript(source, filename='input.js') {
  const base = {
    ecmaVersion: 'latest',
    allowHashBang: true,
    allowAwaitOutsideFunction: true,
    allowReturnOutsideFunction: true,
    locations: true,
    ranges: false
  };
  try {
    return { ast: parse(source, {...base, sourceType:'module'}), sourceType:'module', error:null };
  } catch (moduleError) {
    try {
      return { ast: parse(source, {...base, sourceType:'script'}), sourceType:'script', error:null };
    } catch (scriptError) {
      const e = new SyntaxError(`${filename}: ${scriptError.message}`);
      e.filename = filename;
      e.loc = scriptError.loc;
      e.moduleError = moduleError.message;
      throw e;
    }
  }
}
