const launchers = {};

export function registerLauncher(name, fn) {
  launchers[name] = fn;
}

export function launch(name, arg) {
  const fn = launchers[name];
  if (!fn) return null;
  return fn(arg || {});
}
