// webpack alias target for `chalk`. The engine only uses chalk for
// Engine#text() debug rendering and deprecation warnings, so a chainable
// identity proxy keeps the bundle free of chalk and its dependencies.
const identity = s => s;
const handler = { get: () => proxy, apply: (_t, _this, [s]) => String(s) };
const proxy = new Proxy(identity, handler);
module.exports = proxy;
module.exports.default = proxy;
