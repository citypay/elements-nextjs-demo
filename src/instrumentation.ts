/** Next.js runs this before serving requests. See LIBRARY-NOTES.md. */
export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // SDK 2.2.0 logs authentication/request bodies via console.debug with no opt-out.
    // Suppress ALL server debug output; info/warn/error remain available.
    // Remove this workaround only after upgrading to a verified upstream fix.
    console.debug = () => {};
  }
}
