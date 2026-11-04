export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith(".css")) {
    return {
      format: "module",
      shortCircuit: true,
      url: "data:text/javascript,export default {}",
    };
  }
  return nextResolve(specifier, context);
}
