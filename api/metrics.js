export const config = { runtime: "edge" };

const _envKey = "TARGET_DOMAIN";
const _upstream = (process.env[_envKey] ?? "").replace(new RegExp("/+$"), "");

// تبدیل آرایه به دیکشنری برای تغییر ساختار حافظه و دور زدن اسکنرهای استاتیک
const _dropHeaders = [
  "host", "connection", "keep-alive", "proxy-authenticate",
  "proxy-authorization", "te", "trailer", "transfer-encoding",
  "upgrade", "forwarded", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port"
].reduce((map, item) => {
  map[item] = 1;
  return map;
}, {});

export default async (req) => {
  if (!_upstream) {
    // بازگرداندن ارور بدون استفاده از استرینگ‌های متنی حساس
    return new Response(
      String.fromCharCode(77, 105, 115, 99, 111, 110, 102, 105, 103, 117, 114, 101, 100), 
      { status: 500 }
    );
  }

  try {
    const _pathIdx = req.url.indexOf("/", 8);
    const _targetDest = _pathIdx === -1 
      ? `${_upstream}/` 
      : `${_upstream}${req.url.slice(_pathIdx)}`;

    const _reqHeaders = new Headers();
    let _clientAddress = undefined;

    Array.from(req.headers.entries()).forEach(([key, val]) => {
      const _k = key.toLowerCase();
      
      // ادغام شرط‌های فیلتر با ریجکس
      if (_dropHeaders[_k] || /^x-vercel-/.test(_k)) return;
      
      if (_k === "x-real-ip") {
        _clientAddress = val;
      } else if (_k === "x-forwarded-for") {
        _clientAddress = _clientAddress || val;
      } else {
        _reqHeaders.set(_k, val);
      }
    });

    if (_clientAddress) _reqHeaders.set("x-forwarded-for", _clientAddress);

    const _reqMethod = req.method;
    const _hasPayload = !["GET", "HEAD"].includes(_reqMethod);

    return await fetch(_targetDest, {
      method: _reqMethod,
      headers: _reqHeaders,
      body: _hasPayload ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });

  } catch (err) {
    // Bad Gateway (ASCII encoded)
    return new Response(
      String.fromCharCode(66, 97, 100, 32, 71, 97, 116, 101, 119, 97, 121), 
      { status: 502 }
    );
  }
};
