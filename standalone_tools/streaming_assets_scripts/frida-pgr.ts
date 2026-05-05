// script from Yentis, see original instruction: https://discord.com/channels/1109243478325596250/1115067916342276146/1491569941013332068
import 'frida-il2cpp-bridge';

Il2Cpp.perform(() => {
  dumpBundleKey();
  // dumpLua();
  loadExternalLua();
  overrideMakeInitialUrl();
  overrideSetRequestHeader();
});

function loadExternalLua() {
  const assembly = Il2Cpp.domain.assembly('Assembly-CSharp');
  const xApplication = assembly.image.class('XApplication');
  const getDebug = xApplication.method('get_Debug');
  const setDebug = xApplication.method('set_Debug');

  getDebug.implementation = function () {
    const result = getDebug.invoke();
    if (result) setDebug.invoke(false);

    return result;
  };

  const xLuaEngine = assembly.image.class('XLuaEngine');
  const initLoader = xLuaEngine.method('InitLoader');

  initLoader.implementation = function () {
    setDebug.invoke(true);
    initLoader.invoke();
  };
}

function overrideSetRequestHeader() {
  const assembly = Il2Cpp.domain.assembly('UnityEngine.UnityWebRequestModule');
  const imageClass = assembly.image.class('UnityEngine.Networking.UnityWebRequest');
  const method = imageClass.method('SetRequestHeader');

  // @ts-ignore
  method.implementation = function (name: Il2Cpp.String, value: Il2Cpp.String) {
    if (!name.content || !value.content) {
      return method.invoke(name, value);
    }

    if (name.content.toLowerCase() === 'host') {
      console.log(`[SetRequestHeader] Rewriting Host: ${value.content} -> localhost`);
      return method.invoke(name, Il2Cpp.string('127.0.0.1'));
    }

    return method.invoke(name, value);
  };
}

function overrideMakeInitialUrl() {
  const assembly = Il2Cpp.domain.assembly('UnityEngine.UnityWebRequestModule');
  const imageClass = assembly.image.class('UnityEngineInternal.WebRequestUtils');
  const method = imageClass.method('MakeInitialUrl');

  // @ts-ignore
  method.implementation = function (targetUrl: Il2Cpp.String, localUrl) {
    const original = targetUrl.content;
    if (!original?.startsWith('http://') && !original?.startsWith('https://')) {
      return method.invoke(targetUrl, localUrl);
    }

    if (
      original.includes('127.0.0.1') ||
      original.includes('ipv4.icanhazip.com') ||
      original.includes('/event')
    ) {
      return method.invoke(targetUrl, localUrl);
    }

    const baseUrl = 'http://127.0.0.1:80';
    const shouldRedirect =
      original.includes('kurogame.net') ||
      original.includes('kurogame.com') ||
      original.includes('kurogame-service.com');

    if (!shouldRedirect) {
      return method.invoke(targetUrl, localUrl);
    }

    let newUrl = baseUrl;
    original
      .split('/')
      .splice(3)
      .forEach((segment) => {
        newUrl += '/' + segment;
      });

    console.log(`[MakeInitialUrl] Redirect: ${original} -> ${newUrl}`);
    return method.invoke(Il2Cpp.string(newUrl), localUrl);
  };
}

function dumpBundleKey() {
  const assembly = Il2Cpp.domain.assembly('UnityEngine.AssetBundleModule');
  const imageClass = assembly.image.class('UnityEngine.AssetBundle');
  const method = imageClass.method('SetAssetBundleDecryptKey');

  method.implementation = function (password) {
    console.log('SetAssetBundleKey called', password);
    return method.invoke(password);
  };
}

function dumpLua() {
  const assembly = Il2Cpp.domain.assembly('Assembly-CSharp');
  const imageClass = assembly.image.class('XLuaEngine');
  const method = imageClass.method<Il2Cpp.Array<number>>('LoadResource');

  // @ts-ignore
  method.implementation = function (path: Il2Cpp.String) {
    const bytes = method.invoke(path);
    const length = bytes.length;

    const uint8 = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      uint8[i] = bytes.get(i);
    }

    const data = utf8ArrayToString(uint8);
    // @ts-ignore
    File.writeAllText(`./lua/${path.content?.replaceAll('/', '_')}.lua`, data);

    return bytes;
  };
}

function utf8ArrayToString(bytes: Uint8Array): string {
  let out = '',
    i = 0,
    len = bytes.length;

  while (i < len) {
    let c = bytes[i++];
    if (c >> 4 <= 7) {
      out += String.fromCharCode(c);
    } else if (c >> 4 === 12 || c >> 4 === 13) {
      const c2 = bytes[i++];
      out += String.fromCharCode(((c & 0x1f) << 6) | (c2 & 0x3f));
    } else if (c >> 4 === 14) {
      const c2 = bytes[i++];
      const c3 = bytes[i++];
      out += String.fromCharCode(((c & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f));
    }
  }

  return out;
}
